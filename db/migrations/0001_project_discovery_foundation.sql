CREATE TABLE discovery.invitations (
  id uuid PRIMARY KEY,
  token_hash bytea NOT NULL UNIQUE,
  token_generation integer NOT NULL DEFAULT 1,
  client_name text NOT NULL,
  client_email text NOT NULL,
  preferred_locale varchar(2) NOT NULL DEFAULT 'en',
  lifecycle_status varchar(20) NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revocation_reason text,
  replaced_at timestamptz,
  CONSTRAINT invitations_token_hash_length CHECK (octet_length(token_hash) = 32),
  CONSTRAINT invitations_token_generation_positive CHECK (token_generation > 0),
  CONSTRAINT invitations_client_name_present CHECK (length(btrim(client_name)) > 0),
  CONSTRAINT invitations_client_email_present CHECK (length(btrim(client_email)) > 0),
  CONSTRAINT invitations_locale_valid CHECK (preferred_locale IN ('en', 'it')),
  CONSTRAINT invitations_lifecycle_valid CHECK (
    lifecycle_status IN ('pending', 'in_progress', 'submitted')
  ),
  CONSTRAINT invitations_expiry_valid CHECK (expires_at > created_at),
  CONSTRAINT invitations_revocation_valid CHECK (
    revoked_at IS NULL OR revoked_at >= created_at
  ),
  CONSTRAINT invitations_revocation_reason_valid CHECK (
    revoked_at IS NOT NULL OR revocation_reason IS NULL
  )
);

CREATE INDEX invitations_client_email_idx
  ON discovery.invitations (lower(client_email));
CREATE INDEX invitations_expires_at_idx
  ON discovery.invitations (expires_at);
CREATE INDEX invitations_effective_status_idx
  ON discovery.invitations (lifecycle_status, revoked_at, expires_at);

CREATE TABLE discovery.sessions (
  id uuid PRIMARY KEY,
  credential_hash bytea NOT NULL UNIQUE,
  invitation_id uuid NOT NULL
    REFERENCES discovery.invitations (id) ON DELETE CASCADE,
  token_generation integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  invalidated_at timestamptz,
  invalidation_reason text,
  CONSTRAINT sessions_credential_hash_length CHECK (
    octet_length(credential_hash) = 32
  ),
  CONSTRAINT sessions_token_generation_positive CHECK (token_generation > 0),
  CONSTRAINT sessions_expiry_valid CHECK (expires_at > created_at),
  CONSTRAINT sessions_invalidation_valid CHECK (
    invalidated_at IS NULL OR invalidated_at >= created_at
  ),
  CONSTRAINT sessions_invalidation_reason_valid CHECK (
    invalidated_at IS NOT NULL OR invalidation_reason IS NULL
  )
);

CREATE INDEX sessions_invitation_id_idx
  ON discovery.sessions (invitation_id);
CREATE INDEX sessions_expires_at_idx
  ON discovery.sessions (expires_at);

CREATE TABLE discovery.project_briefs (
  id uuid PRIMARY KEY,
  invitation_id uuid NOT NULL UNIQUE
    REFERENCES discovery.invitations (id) ON DELETE CASCADE,
  schema_version text NOT NULL,
  locale varchar(2) NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision bigint NOT NULL DEFAULT 0,
  last_mutation_id uuid,
  state varchar(20) NOT NULL DEFAULT 'draft',
  submission_reference text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  CONSTRAINT project_briefs_schema_version_present CHECK (
    length(btrim(schema_version)) > 0
  ),
  CONSTRAINT project_briefs_locale_valid CHECK (locale IN ('en', 'it')),
  CONSTRAINT project_briefs_answers_object CHECK (jsonb_typeof(answers) = 'object'),
  CONSTRAINT project_briefs_revision_nonnegative CHECK (revision >= 0),
  CONSTRAINT project_briefs_state_valid CHECK (state IN ('draft', 'submitted')),
  CONSTRAINT project_briefs_submission_state_valid CHECK (
    (
      state = 'draft'
      AND submission_reference IS NULL
      AND submitted_at IS NULL
    )
    OR
    (
      state = 'submitted'
      AND submission_reference IS NOT NULL
      AND submitted_at IS NOT NULL
    )
  )
);

CREATE INDEX project_briefs_state_updated_at_idx
  ON discovery.project_briefs (state, updated_at);
CREATE INDEX project_briefs_submitted_at_idx
  ON discovery.project_briefs (submitted_at)
  WHERE submitted_at IS NOT NULL;

CREATE TABLE discovery.notification_outbox (
  id uuid PRIMARY KEY,
  brief_id uuid NOT NULL
    REFERENCES discovery.project_briefs (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  delivery_status varchar(20) NOT NULL DEFAULT 'pending',
  idempotency_key text NOT NULL UNIQUE,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_event_type_present CHECK (
    length(btrim(event_type)) > 0
  ),
  CONSTRAINT notification_status_valid CHECK (
    delivery_status IN ('pending', 'processing', 'sent', 'failed')
  ),
  CONSTRAINT notification_idempotency_key_present CHECK (
    length(btrim(idempotency_key)) > 0
  ),
  CONSTRAINT notification_attempt_count_nonnegative CHECK (attempt_count >= 0),
  CONSTRAINT notification_delivery_state_valid CHECK (
    (delivery_status = 'sent' AND delivered_at IS NOT NULL)
    OR (delivery_status <> 'sent' AND delivered_at IS NULL)
  )
);

CREATE INDEX notification_outbox_delivery_idx
  ON discovery.notification_outbox (delivery_status, next_attempt_at, created_at);
CREATE INDEX notification_outbox_brief_id_idx
  ON discovery.notification_outbox (brief_id);

CREATE FUNCTION discovery.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$function$;

CREATE FUNCTION discovery.prevent_revoked_invitation_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'revoked invitations are immutable'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$function$;

CREATE FUNCTION discovery.prevent_submitted_brief_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.state = 'submitted' THEN
    RAISE EXCEPTION 'submitted project briefs are immutable'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER invitations_updated_at
BEFORE UPDATE ON discovery.invitations
FOR EACH ROW EXECUTE FUNCTION discovery.set_updated_at();

CREATE TRIGGER invitations_revocation_final
BEFORE UPDATE ON discovery.invitations
FOR EACH ROW EXECUTE FUNCTION discovery.prevent_revoked_invitation_update();

CREATE TRIGGER project_briefs_updated_at
BEFORE UPDATE ON discovery.project_briefs
FOR EACH ROW EXECUTE FUNCTION discovery.set_updated_at();

CREATE TRIGGER project_briefs_submission_immutable
BEFORE UPDATE ON discovery.project_briefs
FOR EACH ROW EXECUTE FUNCTION discovery.prevent_submitted_brief_update();

CREATE TRIGGER notification_outbox_updated_at
BEFORE UPDATE ON discovery.notification_outbox
FOR EACH ROW EXECUTE FUNCTION discovery.set_updated_at();

REVOKE ALL ON ALL TABLES IN SCHEMA discovery FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA discovery FROM PUBLIC;

GRANT SELECT ON discovery.invitations TO codevivo_discovery_runtime;
GRANT UPDATE (lifecycle_status) ON discovery.invitations
  TO codevivo_discovery_runtime;
GRANT SELECT, INSERT ON discovery.sessions TO codevivo_discovery_runtime;
GRANT SELECT, INSERT ON discovery.project_briefs TO codevivo_discovery_runtime;
GRANT UPDATE (
  answers,
  revision,
  last_mutation_id,
  state,
  submission_reference,
  submitted_at
) ON discovery.project_briefs TO codevivo_discovery_runtime;
GRANT SELECT, INSERT ON discovery.notification_outbox
  TO codevivo_discovery_runtime;
GRANT UPDATE (
  delivery_status,
  attempt_count,
  next_attempt_at,
  last_attempt_at,
  delivered_at,
  last_error
) ON discovery.notification_outbox TO codevivo_discovery_runtime;

GRANT SELECT, INSERT, UPDATE, DELETE ON discovery.invitations
  TO codevivo_discovery_admin;
GRANT SELECT, DELETE ON discovery.sessions TO codevivo_discovery_admin;
GRANT UPDATE (invalidated_at, invalidation_reason)
  ON discovery.sessions TO codevivo_discovery_admin;
GRANT SELECT, DELETE ON discovery.project_briefs
  TO codevivo_discovery_admin;
GRANT SELECT, DELETE ON discovery.notification_outbox
  TO codevivo_discovery_admin;
GRANT UPDATE (
  delivery_status,
  attempt_count,
  next_attempt_at,
  last_attempt_at,
  delivered_at,
  last_error
) ON discovery.notification_outbox TO codevivo_discovery_admin;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA discovery
  TO codevivo_discovery_migration;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA discovery
  TO codevivo_discovery_migration;

ALTER DEFAULT PRIVILEGES FOR ROLE codevivo_discovery_migration
IN SCHEMA discovery REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE codevivo_discovery_migration
IN SCHEMA discovery REVOKE ALL ON FUNCTIONS FROM PUBLIC;
