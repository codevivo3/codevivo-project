import type { NeonQueryFunction } from '@neondatabase/serverless';
import type { DiscoveryQuestionnaireAnswers } from './questionnaire-core';
import {
  validateDiscoveryDraftAnswers,
  validateDiscoveryDraftEditingState,
  type DiscoveryDraftEditingState,
  type DiscoveryDraftMutation,
  type DiscoveryDraftOutcome,
  type DiscoveryDraftSnapshot,
} from './draft-contract';

type DraftRow = {
  answers: DiscoveryQuestionnaireAnswers | null;
  brief_id: string | null;
  current_step: number | null;
  editing_state: DiscoveryDraftEditingState | null;
  highest_step_reached: number | null;
  locale: 'en' | 'it' | null;
  outcome:
    | 'available'
    | 'conflict'
    | 'created'
    | 'missing'
    | 'mutation_conflict'
    | 'replayed'
    | 'submitted'
    | 'unauthorized'
    | 'updated';
  revision: number | string | null;
  schema_version: string | null;
  submission_reference?: string | null;
  submitted_at?: Date | string | null;
  updated_at: Date | string | null;
};

type CurrentDraftRow = DraftRow & {
  authorized: boolean;
  last_mutation_hash: string | null;
  last_mutation_id: string | null;
  state: 'draft' | 'submitted' | null;
};

export interface DiscoveryDraftRepository {
  initialize(input: {
    briefId: string;
    defaultAnswers: DiscoveryQuestionnaireAnswers;
    locale: 'en' | 'it';
    retentionDays: number;
    sessionHash: Buffer;
  }): Promise<DiscoveryDraftOutcome>;
  read(input: { sessionHash: Buffer }): Promise<DiscoveryDraftOutcome>;
  update(input: {
    mutation: DiscoveryDraftMutation;
    sessionHash: Buffer;
  }): Promise<DiscoveryDraftOutcome>;
}

function mapRow(row: DraftRow | undefined): DiscoveryDraftOutcome {
  if (!row) return { outcome: 'unauthorized' };
  const outcome =
    row.outcome === 'mutation_conflict' ? 'mutation-conflict' : row.outcome;
  if (
    outcome === 'missing' ||
    outcome === 'mutation-conflict' ||
    outcome === 'unauthorized'
  ) {
    return { outcome };
  }
  if (outcome === 'submitted') {
    if (row.revision === null || !row.submission_reference || !row.submitted_at) {
      return { outcome: 'unauthorized' };
    }
    return {
      outcome,
      submission: {
        reference: row.submission_reference,
        revision: Number(row.revision),
        submittedAt: new Date(row.submitted_at),
      },
    };
  }
  if (
    !row.brief_id ||
    !row.answers ||
    !row.locale ||
    row.current_step === null ||
    row.highest_step_reached === null ||
    row.revision === null ||
    !row.schema_version ||
    !row.updated_at
  ) {
    return { outcome: 'unauthorized' };
  }
  const draft: DiscoveryDraftSnapshot = {
    answers: validateDiscoveryDraftAnswers(row.answers),
    briefId: row.brief_id,
    currentStep: row.current_step as DiscoveryDraftSnapshot['currentStep'],
    editingState: validateDiscoveryDraftEditingState(row.editing_state ?? {}),
    highestStepReached:
      row.highest_step_reached as DiscoveryDraftSnapshot['highestStepReached'],
    locale: row.locale,
    revision: Number(row.revision),
    schemaVersion: row.schema_version,
    updatedAt: new Date(row.updated_at),
  };
  return { outcome, draft } as DiscoveryDraftOutcome;
}

export function createDiscoveryDraftRepository(
  getDatabase: () => NeonQueryFunction<false, false>,
): DiscoveryDraftRepository {
  return {
    async initialize(input) {
      const sql = getDatabase();
      const rows = (await sql`
        WITH authorized AS MATERIALIZED (
          SELECT
            invitations.id AS invitation_id,
            invitations.expires_at,
            invitations.prefill_answers
          FROM discovery.sessions
          INNER JOIN discovery.invitations
            ON invitations.id = sessions.invitation_id
          WHERE sessions.credential_hash = ${input.sessionHash}
            AND sessions.invalidated_at IS NULL
            AND sessions.expires_at > now()
            AND invitations.revoked_at IS NULL
            AND invitations.expires_at > now()
            AND sessions.token_generation = invitations.token_generation
          LIMIT 1
          FOR UPDATE OF invitations
        ),
        inserted AS (
          INSERT INTO discovery.project_briefs (
            id,
            invitation_id,
            schema_version,
            locale,
            answers,
            current_step,
            highest_step_reached,
            editing_state,
            retention_review_at
          )
          SELECT
            ${input.briefId}::uuid,
            authorized.invitation_id,
            ${'2.0'},
            ${input.locale},
            ${input.defaultAnswers}::jsonb || authorized.prefill_answers,
            1,
            1,
            '{}'::jsonb,
            authorized.expires_at + (${input.retentionDays}::text || ' days')::interval
          FROM authorized
          ON CONFLICT (invitation_id) DO NOTHING
                    RETURNING project_briefs.*
        ),
        selected AS MATERIALIZED (
          SELECT * FROM inserted
          UNION ALL
          SELECT project_briefs.*
          FROM discovery.project_briefs
          INNER JOIN authorized
            ON authorized.invitation_id = project_briefs.invitation_id
          WHERE NOT EXISTS (SELECT 1 FROM inserted)
          LIMIT 1
        )
        SELECT
          CASE
            WHEN NOT EXISTS (SELECT 1 FROM authorized) THEN 'unauthorized'
            WHEN (SELECT state FROM selected) = 'submitted' THEN 'submitted'
            WHEN EXISTS (SELECT 1 FROM inserted) THEN 'created'
            ELSE 'available'
          END AS outcome,
          selected.id AS brief_id,
          selected.schema_version,
          selected.locale,
          selected.answers,
          selected.revision,
          selected.current_step,
          selected.highest_step_reached,
          selected.editing_state,
          selected.submission_reference,
          selected.submitted_at,
          selected.updated_at
        FROM (SELECT 1) AS singleton
        LEFT JOIN selected ON true
      `) as DraftRow[];
      const mapped = mapRow(rows[0]);
      // A concurrent initializer may win the unique-key race after this
      // statement's snapshot was established. Re-read under a fresh snapshot;
      // authorization is independently checked again by read().
      if (
        mapped.outcome === 'unauthorized' &&
        rows[0]?.outcome === 'available'
      ) {
        return createDiscoveryDraftRepository(() => sql).read({
          sessionHash: input.sessionHash,
        });
      }
      return mapped;
    },

    async read(input) {
      const sql = getDatabase();
      const rows = (await sql`
        WITH authorized AS MATERIALIZED (
          SELECT invitations.id AS invitation_id
          FROM discovery.sessions
          INNER JOIN discovery.invitations
            ON invitations.id = sessions.invitation_id
          WHERE sessions.credential_hash = ${input.sessionHash}
            AND sessions.invalidated_at IS NULL
            AND sessions.expires_at > now()
            AND invitations.revoked_at IS NULL
            AND invitations.expires_at > now()
            AND sessions.token_generation = invitations.token_generation
          LIMIT 1
        ),
        selected AS MATERIALIZED (
          SELECT project_briefs.*
          FROM discovery.project_briefs
          INNER JOIN authorized
            ON authorized.invitation_id = project_briefs.invitation_id
        )
        SELECT
          CASE
            WHEN NOT EXISTS (SELECT 1 FROM authorized) THEN 'unauthorized'
            WHEN NOT EXISTS (SELECT 1 FROM selected) THEN 'missing'
            WHEN (SELECT state FROM selected) = 'submitted' THEN 'submitted'
            ELSE 'available'
          END AS outcome,
          selected.id AS brief_id,
          selected.schema_version,
          selected.locale,
          selected.answers,
          selected.revision,
          selected.current_step,
          selected.highest_step_reached,
          selected.editing_state,
          selected.submission_reference,
          selected.submitted_at,
          selected.updated_at
        FROM (SELECT 1) AS singleton
        LEFT JOIN selected ON true
      `) as DraftRow[];
      return mapRow(rows[0]);
    },

    async update(input) {
      const sql = getDatabase();
      const { mutation } = input;
      const transactionResults = await sql.transaction([
        sql`
          SELECT invitations.id AS invitation_id
          FROM discovery.sessions
          INNER JOIN discovery.invitations
            ON invitations.id = sessions.invitation_id
          WHERE sessions.credential_hash = ${input.sessionHash}
            AND sessions.invalidated_at IS NULL
            AND sessions.expires_at > now()
            AND invitations.revoked_at IS NULL
            AND invitations.expires_at > now()
            AND sessions.token_generation = invitations.token_generation
          LIMIT 1
          FOR UPDATE OF invitations
        `,
        sql`
          WITH authorized AS MATERIALIZED (
            SELECT invitations.id AS invitation_id
            FROM discovery.sessions
            INNER JOIN discovery.invitations
              ON invitations.id = sessions.invitation_id
            WHERE sessions.credential_hash = ${input.sessionHash}
              AND sessions.invalidated_at IS NULL
              AND sessions.expires_at > now()
              AND invitations.revoked_at IS NULL
              AND invitations.expires_at > now()
              AND sessions.token_generation = invitations.token_generation
            LIMIT 1
          )
          UPDATE discovery.project_briefs
          SET
            locale = ${mutation.locale},
            answers = ${mutation.answers}::jsonb,
            revision = revision + 1,
            last_mutation_id = ${mutation.mutationId}::uuid,
            last_mutation_hash = decode(${mutation.mutationHash}, 'hex'),
            current_step = ${mutation.currentStep},
            highest_step_reached = ${mutation.highestStepReached},
            editing_state = ${mutation.editingState}::jsonb
          FROM authorized
          WHERE project_briefs.invitation_id = authorized.invitation_id
            AND project_briefs.state = 'draft'
            AND project_briefs.revision = ${mutation.baseRevision}
            AND project_briefs.last_mutation_id IS DISTINCT FROM ${mutation.mutationId}::uuid
          RETURNING
            project_briefs.id AS brief_id,
            project_briefs.schema_version,
            project_briefs.locale,
            project_briefs.answers,
            project_briefs.revision,
            project_briefs.current_step,
            project_briefs.highest_step_reached,
            project_briefs.editing_state,
            project_briefs.updated_at
        `,
        sql`
          WITH authorized AS MATERIALIZED (
            SELECT invitations.id AS invitation_id
            FROM discovery.sessions
            INNER JOIN discovery.invitations
              ON invitations.id = sessions.invitation_id
            WHERE sessions.credential_hash = ${input.sessionHash}
              AND sessions.invalidated_at IS NULL
              AND sessions.expires_at > now()
              AND invitations.revoked_at IS NULL
              AND invitations.expires_at > now()
              AND sessions.token_generation = invitations.token_generation
            LIMIT 1
          ),
          selected AS MATERIALIZED (
            SELECT project_briefs.*
            FROM discovery.project_briefs
            INNER JOIN authorized
              ON authorized.invitation_id = project_briefs.invitation_id
          )
          SELECT
            EXISTS (SELECT 1 FROM authorized) AS authorized,
            selected.id AS brief_id,
            selected.schema_version,
            selected.locale,
            selected.answers,
            selected.revision,
            selected.current_step,
            selected.highest_step_reached,
            selected.editing_state,
            selected.updated_at,
            selected.state,
            selected.submission_reference,
            selected.submitted_at,
            selected.last_mutation_id,
            encode(selected.last_mutation_hash, 'hex') AS last_mutation_hash
          FROM (SELECT 1) AS singleton
          LEFT JOIN selected ON true
        `,
      ]);

      const authorized = transactionResults[0] as { invitation_id: string }[];
      const updated = transactionResults[1] as DraftRow[];
      const current = (transactionResults[2] as CurrentDraftRow[])[0];
      if (authorized.length === 0 || current?.authorized !== true) {
        return { outcome: 'unauthorized' };
      }
      if (!current.brief_id) return { outcome: 'missing' };
      if (current.state === 'submitted') {
        return mapRow({ ...current, outcome: 'submitted' });
      }
      if (updated[0]) return mapRow({ ...updated[0], outcome: 'updated' });
      if (current.last_mutation_id === mutation.mutationId) {
        return mapRow({
          ...current,
          outcome:
            current.last_mutation_hash === mutation.mutationHash
              ? 'replayed'
              : 'mutation_conflict',
        });
      }
      return mapRow({ ...current, outcome: 'conflict' });
    },
  };
}
