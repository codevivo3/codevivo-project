ALTER TABLE discovery.invitations
  ADD COLUMN prefill_schema_version text NOT NULL DEFAULT '2.0',
  ADD COLUMN prefill_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT invitations_prefill_schema_version_present CHECK (
    length(btrim(prefill_schema_version)) > 0
  ),
  ADD CONSTRAINT invitations_prefill_answers_object CHECK (
    jsonb_typeof(prefill_answers) = 'object'
  );

DO $block$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM discovery.project_briefs
    WHERE last_mutation_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'migration 0003 requires legacy last_mutation_id values to be reviewed';
  END IF;
END
$block$;

ALTER TABLE discovery.project_briefs
  ADD COLUMN current_step smallint NOT NULL DEFAULT 1,
  ADD COLUMN highest_step_reached smallint NOT NULL DEFAULT 1,
  ADD COLUMN last_mutation_hash bytea,
  ADD COLUMN editing_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN retention_review_at timestamptz,
  ADD CONSTRAINT project_briefs_current_step_valid CHECK (
    current_step BETWEEN 1 AND 7
  ),
  ADD CONSTRAINT project_briefs_highest_step_valid CHECK (
    highest_step_reached BETWEEN 1 AND 7
    AND highest_step_reached >= current_step
  ),
  ADD CONSTRAINT project_briefs_mutation_metadata_valid CHECK (
    (last_mutation_id IS NULL AND last_mutation_hash IS NULL)
    OR (
      last_mutation_id IS NOT NULL
      AND last_mutation_hash IS NOT NULL
      AND octet_length(last_mutation_hash) = 32
    )
  ),
  ADD CONSTRAINT project_briefs_editing_state_object CHECK (
    jsonb_typeof(editing_state) = 'object'
  ),
  ADD CONSTRAINT project_briefs_retention_review_valid CHECK (
    retention_review_at IS NULL OR retention_review_at >= created_at
  );

CREATE INDEX project_briefs_retention_review_idx
  ON discovery.project_briefs (retention_review_at)
  WHERE retention_review_at IS NOT NULL;

CREATE TABLE discovery.invitation_inquiry_links (
  invitation_id uuid PRIMARY KEY
    REFERENCES discovery.invitations (id) ON DELETE CASCADE,
  inquiry_id uuid NOT NULL
    REFERENCES contact.inquiries (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  copied_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  associated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitation_inquiry_links_copied_fields_valid CHECK (
    copied_fields <@ ARRAY['email']::text[]
    AND cardinality(copied_fields) <= 1
  )
);

CREATE INDEX invitation_inquiry_links_inquiry_id_idx
  ON discovery.invitation_inquiry_links (inquiry_id);

REVOKE ALL ON discovery.invitation_inquiry_links FROM PUBLIC;

GRANT SELECT, INSERT, DELETE ON discovery.invitation_inquiry_links
  TO codevivo_discovery_admin;

GRANT ALL PRIVILEGES ON discovery.invitation_inquiry_links
  TO codevivo_discovery_migration;

GRANT UPDATE (
  locale,
  current_step,
  highest_step_reached,
  last_mutation_hash,
  editing_state
) ON discovery.project_briefs TO codevivo_discovery_runtime;

REVOKE UPDATE (state, submission_reference, submitted_at)
  ON discovery.project_briefs FROM codevivo_discovery_runtime;