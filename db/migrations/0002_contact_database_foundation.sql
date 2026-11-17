CREATE TABLE contact.privacy_notice_versions (
  version text NOT NULL,
  locale varchar(2) NOT NULL,
  notice_url text NOT NULL,
  privacy_contact_email text NOT NULL,
  effective_at timestamptz NOT NULL,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (version, locale),
  CONSTRAINT privacy_notice_version_present CHECK (
    length(btrim(version)) BETWEEN 1 AND 100
  ),
  CONSTRAINT privacy_notice_locale_valid CHECK (locale IN ('en', 'it')),
  CONSTRAINT privacy_notice_url_present CHECK (
    length(btrim(notice_url)) > 0 AND notice_url = btrim(notice_url)
  ),
  CONSTRAINT privacy_notice_contact_email_present CHECK (
    length(btrim(privacy_contact_email)) BETWEEN 3 AND 200
    AND privacy_contact_email = btrim(privacy_contact_email)
  ),
  CONSTRAINT privacy_notice_retirement_valid CHECK (
    retired_at IS NULL OR retired_at >= effective_at
  )
);

CREATE TABLE contact.contacts (
  id uuid PRIMARY KEY,
  display_name text NOT NULL,
  email text NOT NULL,
  normalized_email text NOT NULL UNIQUE,
  last_meaningful_interaction_at timestamptz NOT NULL,
  retention_policy_version text NOT NULL,
  retention_review_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contacts_display_name_valid CHECK (
    length(btrim(display_name)) BETWEEN 1 AND 100
  ),
  CONSTRAINT contacts_email_valid CHECK (
    length(btrim(email)) BETWEEN 1 AND 200 AND email = btrim(email)
  ),
  CONSTRAINT contacts_normalized_email_valid CHECK (
    length(normalized_email) BETWEEN 1 AND 200
    AND normalized_email = lower(btrim(normalized_email))
  ),
  CONSTRAINT contacts_retention_policy_present CHECK (
    length(btrim(retention_policy_version)) > 0
  ),
  CONSTRAINT contacts_retention_review_valid CHECK (
    retention_review_at >= last_meaningful_interaction_at
  )
);

CREATE INDEX contacts_retention_review_idx
  ON contact.contacts (retention_review_at);
CREATE INDEX contacts_last_interaction_idx
  ON contact.contacts (last_meaningful_interaction_at);

CREATE TABLE contact.inquiries (
  id uuid PRIMARY KEY,
  contact_id uuid NOT NULL
    REFERENCES contact.contacts (id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL UNIQUE,
  payload_hash bytea NOT NULL,
  submitted_name text NOT NULL,
  submitted_email text NOT NULL,
  locale varchar(2) NOT NULL,
  message text NOT NULL,
  privacy_notice_version text NOT NULL,
  privacy_notice_locale varchar(2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inquiries_payload_hash_length CHECK (
    octet_length(payload_hash) = 32
  ),
  CONSTRAINT inquiries_submitted_name_valid CHECK (
    length(btrim(submitted_name)) BETWEEN 1 AND 100
  ),
  CONSTRAINT inquiries_submitted_email_valid CHECK (
    length(btrim(submitted_email)) BETWEEN 1 AND 200
    AND submitted_email = btrim(submitted_email)
  ),
  CONSTRAINT inquiries_locale_valid CHECK (locale IN ('en', 'it')),
  CONSTRAINT inquiries_message_valid CHECK (
    length(btrim(message)) BETWEEN 20 AND 5000
  ),
  CONSTRAINT inquiries_privacy_locale_matches CHECK (
    privacy_notice_locale = locale
  ),
  CONSTRAINT inquiries_privacy_notice_fk FOREIGN KEY (
    privacy_notice_version,
    privacy_notice_locale
  ) REFERENCES contact.privacy_notice_versions (version, locale)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE INDEX inquiries_contact_id_created_at_idx
  ON contact.inquiries (contact_id, created_at DESC);
CREATE INDEX inquiries_created_at_idx
  ON contact.inquiries (created_at);

CREATE TABLE contact.notification_outbox (
  id uuid PRIMARY KEY,
  inquiry_id uuid NOT NULL
    REFERENCES contact.inquiries (id) ON DELETE CASCADE,
  event_type varchar(40) NOT NULL,
  delivery_status varchar(20) NOT NULL DEFAULT 'pending',
  idempotency_key text NOT NULL UNIQUE,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  provider_message_id text,
  last_error_code varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_outbox_event_type_valid CHECK (
    event_type IN ('internal_alert', 'visitor_acknowledgement')
  ),
  CONSTRAINT contact_outbox_delivery_status_valid CHECK (
    delivery_status IN ('pending', 'processing', 'sent', 'failed')
  ),
  CONSTRAINT contact_outbox_idempotency_key_present CHECK (
    length(btrim(idempotency_key)) BETWEEN 1 AND 200
  ),
  CONSTRAINT contact_outbox_attempt_count_nonnegative CHECK (
    attempt_count >= 0
  ),
  CONSTRAINT contact_outbox_delivery_state_valid CHECK (
    (delivery_status = 'sent' AND delivered_at IS NOT NULL)
    OR (delivery_status <> 'sent' AND delivered_at IS NULL)
  ),
  CONSTRAINT contact_outbox_provider_state_valid CHECK (
    delivery_status = 'sent' OR provider_message_id IS NULL
  ),
  UNIQUE (inquiry_id, event_type)
);

CREATE INDEX contact_outbox_delivery_idx
  ON contact.notification_outbox (
    delivery_status,
    next_attempt_at,
    created_at
  );
CREATE INDEX contact_outbox_inquiry_id_idx
  ON contact.notification_outbox (inquiry_id);

CREATE FUNCTION contact.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$function$;

CREATE FUNCTION contact.prevent_inquiry_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'contact inquiries are immutable'
    USING ERRCODE = 'check_violation';
END
$function$;

CREATE FUNCTION contact.prevent_sent_outbox_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.delivery_status = 'sent' THEN
    RAISE EXCEPTION 'sent contact notification events are immutable'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER privacy_notice_versions_updated_at
BEFORE UPDATE ON contact.privacy_notice_versions
FOR EACH ROW EXECUTE FUNCTION contact.set_updated_at();

CREATE TRIGGER contacts_updated_at
BEFORE UPDATE ON contact.contacts
FOR EACH ROW EXECUTE FUNCTION contact.set_updated_at();

CREATE TRIGGER inquiries_immutable
BEFORE UPDATE ON contact.inquiries
FOR EACH ROW EXECUTE FUNCTION contact.prevent_inquiry_update();

CREATE TRIGGER contact_outbox_updated_at
BEFORE UPDATE ON contact.notification_outbox
FOR EACH ROW EXECUTE FUNCTION contact.set_updated_at();

CREATE TRIGGER contact_outbox_sent_final
BEFORE UPDATE ON contact.notification_outbox
FOR EACH ROW EXECUTE FUNCTION contact.prevent_sent_outbox_update();

REVOKE ALL ON ALL TABLES IN SCHEMA contact FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA contact FROM PUBLIC;

GRANT SELECT, INSERT ON contact.contacts TO codevivo_contact_runtime;
GRANT UPDATE (
  display_name,
  email,
  last_meaningful_interaction_at,
  retention_policy_version,
  retention_review_at
) ON contact.contacts TO codevivo_contact_runtime;
GRANT SELECT, INSERT ON contact.inquiries TO codevivo_contact_runtime;
GRANT SELECT ON contact.privacy_notice_versions TO codevivo_contact_runtime;
GRANT SELECT, INSERT ON contact.notification_outbox
  TO codevivo_contact_runtime;
GRANT UPDATE (
  delivery_status,
  attempt_count,
  next_attempt_at,
  last_attempt_at,
  delivered_at,
  provider_message_id,
  last_error_code
) ON contact.notification_outbox TO codevivo_contact_runtime;

GRANT SELECT, DELETE ON contact.contacts TO codevivo_discovery_admin;
GRANT SELECT, DELETE ON contact.inquiries TO codevivo_discovery_admin;
GRANT SELECT ON contact.privacy_notice_versions TO codevivo_discovery_admin;
GRANT SELECT, DELETE ON contact.notification_outbox
  TO codevivo_discovery_admin;
GRANT UPDATE (
  delivery_status,
  attempt_count,
  next_attempt_at,
  last_attempt_at,
  delivered_at,
  provider_message_id,
  last_error_code
) ON contact.notification_outbox TO codevivo_discovery_admin;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA contact
  TO codevivo_discovery_migration;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA contact
  TO codevivo_discovery_migration;

ALTER DEFAULT PRIVILEGES FOR ROLE codevivo_discovery_migration
IN SCHEMA contact REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE codevivo_discovery_migration
IN SCHEMA contact REVOKE ALL ON FUNCTIONS FROM PUBLIC;
