DO $block$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM discovery.project_briefs
    WHERE state = 'submitted'
  ) THEN
    RAISE EXCEPTION
      'migration 0004 requires existing submitted briefs to be reviewed';
  END IF;
END
$block$;

ALTER TABLE discovery.project_briefs
  ADD COLUMN submission_idempotency_id uuid,
  ADD COLUMN submission_payload_hash bytea,
  ADD CONSTRAINT project_briefs_submission_idempotency_valid CHECK (
    (
      state = 'draft'
      AND submission_idempotency_id IS NULL
      AND submission_payload_hash IS NULL
    )
    OR
    (
      state = 'submitted'
      AND submission_idempotency_id IS NOT NULL
      AND submission_payload_hash IS NOT NULL
      AND octet_length(submission_payload_hash) = 32
    )
  );

ALTER TABLE discovery.notification_outbox
  ADD COLUMN provider_message_id text,
  ADD CONSTRAINT notification_provider_message_id_valid CHECK (
    provider_message_id IS NULL OR length(btrim(provider_message_id)) > 0
  ),
  ADD CONSTRAINT notification_provider_delivery_state_valid CHECK (
    (delivery_status = 'sent' AND provider_message_id IS NOT NULL)
    OR (delivery_status <> 'sent' AND provider_message_id IS NULL)
  );

CREATE UNIQUE INDEX project_briefs_submission_idempotency_idx
  ON discovery.project_briefs (submission_idempotency_id)
  WHERE submission_idempotency_id IS NOT NULL;

CREATE FUNCTION discovery.submit_project_brief(
  p_session_hash bytea,
  p_expected_revision bigint,
  p_submission_id uuid,
  p_payload_hash bytea,
  p_answers jsonb,
  p_locale varchar,
  p_schema_version text,
  p_submission_reference text,
  p_outbox_id uuid
)
RETURNS TABLE (
  outcome text,
  brief_id uuid,
  revision bigint,
  submission_reference text,
  submitted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_brief_id uuid;
  v_invitation_id uuid;
  v_revision bigint;
  v_state varchar(20);
  v_submission_id uuid;
  v_submission_hash bytea;
  v_submission_reference text;
  v_submitted_at timestamptz;
BEGIN
  IF
    p_session_hash IS NULL
    OR octet_length(p_session_hash) <> 32
    OR p_expected_revision < 0
    OR p_submission_id IS NULL
    OR p_payload_hash IS NULL
    OR octet_length(p_payload_hash) <> 32
    OR jsonb_typeof(p_answers) <> 'object'
    OR p_locale NOT IN ('en', 'it')
    OR p_schema_version <> '2.0'
    OR p_submission_reference IS NULL
    OR length(btrim(p_submission_reference)) = 0
    OR p_outbox_id IS NULL
  THEN
    RAISE EXCEPTION 'invalid final submission arguments'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT invitations.id
  INTO v_invitation_id
  FROM discovery.sessions AS sessions
  INNER JOIN discovery.invitations AS invitations
    ON invitations.id = sessions.invitation_id
  WHERE sessions.credential_hash = p_session_hash
    AND sessions.invalidated_at IS NULL
    AND sessions.expires_at > statement_timestamp()
    AND invitations.revoked_at IS NULL
    AND invitations.expires_at > statement_timestamp()
    AND sessions.token_generation = invitations.token_generation
  LIMIT 1
  FOR UPDATE OF invitations;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'unauthorized'::text, NULL::uuid, NULL::bigint,
      NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT
    briefs.id,
    briefs.revision,
    briefs.state,
    briefs.submission_idempotency_id,
    briefs.submission_payload_hash,
    briefs.submission_reference,
    briefs.submitted_at
  INTO
    v_brief_id,
    v_revision,
    v_state,
    v_submission_id,
    v_submission_hash,
    v_submission_reference,
    v_submitted_at
  FROM discovery.project_briefs AS briefs
  WHERE briefs.invitation_id = v_invitation_id
  FOR UPDATE OF briefs;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'missing'::text, NULL::uuid, NULL::bigint,
      NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_state = 'submitted' THEN
    IF v_submission_id = p_submission_id AND v_submission_hash = p_payload_hash THEN
      RETURN QUERY SELECT 'replayed'::text, v_brief_id, v_revision,
        v_submission_reference, v_submitted_at;
    ELSE
      RETURN QUERY SELECT 'mutation_conflict'::text, v_brief_id, v_revision,
        NULL::text, NULL::timestamptz;
    END IF;
    RETURN;
  END IF;

  IF v_revision <> p_expected_revision THEN
    RETURN QUERY SELECT 'conflict'::text, v_brief_id, v_revision,
      NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  UPDATE discovery.project_briefs AS briefs
  SET
    answers = p_answers,
    locale = p_locale,
    schema_version = p_schema_version,
    revision = briefs.revision + 1,
    current_step = 7,
    highest_step_reached = 7,
    editing_state = '{}'::jsonb,
    state = 'submitted',
    submission_reference = p_submission_reference,
    submitted_at = statement_timestamp(),
    submission_idempotency_id = p_submission_id,
    submission_payload_hash = p_payload_hash
  WHERE briefs.id = v_brief_id
  RETURNING briefs.revision, briefs.submission_reference, briefs.submitted_at
  INTO v_revision, v_submission_reference, v_submitted_at;

  UPDATE discovery.invitations AS invitations
  SET lifecycle_status = 'submitted'
  WHERE invitations.id = v_invitation_id;

  INSERT INTO discovery.notification_outbox (
    id,
    brief_id,
    event_type,
    idempotency_key
  ) VALUES (
    p_outbox_id,
    v_brief_id,
    'project_brief_submitted',
    'discovery.project_brief_submitted:' || v_brief_id::text
  );

  RETURN QUERY SELECT 'submitted'::text, v_brief_id, v_revision,
    v_submission_reference, v_submitted_at;
END
$function$;

ALTER FUNCTION discovery.submit_project_brief(
  bytea,
  bigint,
  uuid,
  bytea,
  jsonb,
  varchar,
  text,
  text,
  uuid
) OWNER TO codevivo_discovery_migration;

REVOKE ALL ON FUNCTION discovery.submit_project_brief(
  bytea,
  bigint,
  uuid,
  bytea,
  jsonb,
  varchar,
  text,
  text,
  uuid
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION discovery.submit_project_brief(
  bytea,
  bigint,
  uuid,
  bytea,
  jsonb,
  varchar,
  text,
  text,
  uuid
) TO codevivo_discovery_runtime;

CREATE FUNCTION discovery.claim_notification_events(
  p_batch_size integer,
  p_lease_expired_before timestamptz,
  p_max_attempts integer
)
RETURNS TABLE (
  event_id uuid,
  brief_id uuid,
  event_type text,
  idempotency_key text,
  attempt_count integer,
  submission_reference text,
  submitted_at timestamptz,
  client_name text,
  client_email text,
  locale varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF
    p_batch_size < 1
    OR p_batch_size > 100
    OR p_lease_expired_before IS NULL
    OR p_max_attempts < 1
    OR p_max_attempts > 20
  THEN
    RAISE EXCEPTION 'invalid notification claim arguments'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE discovery.notification_outbox AS outbox
  SET
    delivery_status = 'failed',
    next_attempt_at = NULL,
    last_error = 'claim-expired-max-attempts'
  WHERE outbox.event_type = 'project_brief_submitted'
    AND outbox.attempt_count >= p_max_attempts
    AND (
      outbox.delivery_status = 'pending'
      OR (
        outbox.delivery_status = 'failed'
        AND outbox.next_attempt_at IS NOT NULL
      )
      OR (
        outbox.delivery_status = 'processing'
        AND outbox.last_attempt_at <= p_lease_expired_before
      )
    );

  RETURN QUERY
  WITH eligible AS MATERIALIZED (
    SELECT outbox.id
    FROM discovery.notification_outbox AS outbox
    WHERE outbox.event_type = 'project_brief_submitted'
      AND outbox.attempt_count < p_max_attempts
      AND (
        (
          outbox.delivery_status = 'pending'
          AND (
            outbox.next_attempt_at IS NULL
            OR outbox.next_attempt_at <= statement_timestamp()
          )
        )
        OR (
          outbox.delivery_status = 'failed'
          AND outbox.next_attempt_at <= statement_timestamp()
        )
        OR (
          outbox.delivery_status = 'processing'
          AND outbox.last_attempt_at <= p_lease_expired_before
        )
      )
    ORDER BY COALESCE(outbox.next_attempt_at, outbox.created_at), outbox.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size
  ),
  claimed AS (
    UPDATE discovery.notification_outbox AS outbox
    SET
      delivery_status = 'processing',
      attempt_count = outbox.attempt_count + 1,
      last_attempt_at = statement_timestamp(),
      next_attempt_at = NULL,
      last_error = NULL
    FROM eligible
    WHERE outbox.id = eligible.id
    RETURNING
      outbox.id,
      outbox.brief_id,
      outbox.event_type,
      outbox.idempotency_key,
      outbox.attempt_count
  )
  SELECT
    claimed.id,
    claimed.brief_id,
    claimed.event_type,
    claimed.idempotency_key,
    claimed.attempt_count,
    briefs.submission_reference,
    briefs.submitted_at,
    invitations.client_name,
    invitations.client_email,
    briefs.locale
  FROM claimed
  INNER JOIN discovery.project_briefs AS briefs
    ON briefs.id = claimed.brief_id
  INNER JOIN discovery.invitations AS invitations
    ON invitations.id = briefs.invitation_id
  WHERE briefs.state = 'submitted'
  ORDER BY claimed.id;
END
$function$;

CREATE FUNCTION discovery.mark_notification_delivered(
  p_event_id uuid,
  p_attempt_count integer,
  p_provider_message_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_updated_count integer;
BEGIN
  IF
    p_event_id IS NULL
    OR p_attempt_count < 1
    OR p_provider_message_id IS NULL
    OR length(btrim(p_provider_message_id)) = 0
  THEN
    RAISE EXCEPTION 'invalid notification delivery arguments'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE discovery.notification_outbox AS outbox
  SET
    delivery_status = 'sent',
    delivered_at = statement_timestamp(),
    provider_message_id = p_provider_message_id,
    next_attempt_at = NULL,
    last_error = NULL
  WHERE outbox.id = p_event_id
    AND outbox.event_type = 'project_brief_submitted'
    AND outbox.delivery_status = 'processing'
    AND outbox.attempt_count = p_attempt_count;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count = 1;
END
$function$;

CREATE FUNCTION discovery.mark_notification_failed(
  p_event_id uuid,
  p_attempt_count integer,
  p_error_code text,
  p_next_attempt_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_updated_count integer;
BEGIN
  IF
    p_event_id IS NULL
    OR p_attempt_count < 1
    OR p_error_code IS NULL
    OR length(btrim(p_error_code)) = 0
  THEN
    RAISE EXCEPTION 'invalid notification failure arguments'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE discovery.notification_outbox AS outbox
  SET
    delivery_status = 'failed',
    delivered_at = NULL,
    provider_message_id = NULL,
    next_attempt_at = p_next_attempt_at,
    last_error = p_error_code
  WHERE outbox.id = p_event_id
    AND outbox.event_type = 'project_brief_submitted'
    AND outbox.delivery_status = 'processing'
    AND outbox.attempt_count = p_attempt_count;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count = 1;
END
$function$;

ALTER FUNCTION discovery.claim_notification_events(integer, timestamptz, integer)
  OWNER TO codevivo_discovery_migration;
ALTER FUNCTION discovery.mark_notification_delivered(uuid, integer, text)
  OWNER TO codevivo_discovery_migration;
ALTER FUNCTION discovery.mark_notification_failed(uuid, integer, text, timestamptz)
  OWNER TO codevivo_discovery_migration;

REVOKE ALL ON FUNCTION discovery.claim_notification_events(integer, timestamptz, integer)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION discovery.mark_notification_delivered(uuid, integer, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION discovery.mark_notification_failed(uuid, integer, text, timestamptz)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION discovery.claim_notification_events(integer, timestamptz, integer)
  TO codevivo_discovery_runtime;
GRANT EXECUTE ON FUNCTION discovery.mark_notification_delivered(uuid, integer, text)
  TO codevivo_discovery_runtime;
GRANT EXECUTE ON FUNCTION discovery.mark_notification_failed(uuid, integer, text, timestamptz)
  TO codevivo_discovery_runtime;

REVOKE INSERT ON discovery.notification_outbox
  FROM codevivo_discovery_runtime;
REVOKE UPDATE (
  delivery_status,
  attempt_count,
  next_attempt_at,
  last_attempt_at,
  delivered_at,
  last_error
) ON discovery.notification_outbox FROM codevivo_discovery_runtime;

GRANT ALL PRIVILEGES ON FUNCTION discovery.submit_project_brief(
  bytea,
  bigint,
  uuid,
  bytea,
  jsonb,
  varchar,
  text,
  text,
  uuid
) TO codevivo_discovery_migration;

GRANT ALL PRIVILEGES ON FUNCTION discovery.claim_notification_events(
  integer,
  timestamptz,
  integer
) TO codevivo_discovery_migration;
GRANT ALL PRIVILEGES ON FUNCTION discovery.mark_notification_delivered(
  uuid,
  integer,
  text
) TO codevivo_discovery_migration;
GRANT ALL PRIVILEGES ON FUNCTION discovery.mark_notification_failed(
  uuid,
  integer,
  text,
  timestamptz
) TO codevivo_discovery_migration;
