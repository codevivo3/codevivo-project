import type { NeonQueryFunction } from '@neondatabase/serverless';
import type { DiscoverySubmission } from './submission-contract';

type SubmissionRow = {
  outcome:
    | 'conflict'
    | 'missing'
    | 'mutation_conflict'
    | 'replayed'
    | 'submitted'
    | 'unauthorized';
  brief_id: string | null;
  revision: number | string | null;
  submission_reference: string | null;
  submitted_at: Date | string | null;
};

export type DiscoverySubmissionResult = {
  briefId: string;
  reference: string;
  revision: number;
  submittedAt: Date;
};

export type DiscoverySubmissionOutcome =
  | { outcome: 'replayed' | 'submitted'; submission: DiscoverySubmissionResult }
  | { outcome: 'conflict'; revision: number }
  | { outcome: 'missing' | 'mutation-conflict' | 'unauthorized' };

export interface DiscoverySubmissionRepository {
  submit(input: {
    outboxId: string;
    sessionHash: Buffer;
    submission: DiscoverySubmission;
    submissionReference: string;
  }): Promise<DiscoverySubmissionOutcome>;
}

function mapRow(row: SubmissionRow | undefined): DiscoverySubmissionOutcome {
  if (!row || row.outcome === 'unauthorized') return { outcome: 'unauthorized' };
  if (row.outcome === 'missing') return { outcome: 'missing' };
  if (row.outcome === 'mutation_conflict') return { outcome: 'mutation-conflict' };
  if (row.outcome === 'conflict') {
    return { outcome: 'conflict', revision: Number(row.revision ?? 0) };
  }
  if (
    !row.brief_id ||
    row.revision === null ||
    !row.submission_reference ||
    !row.submitted_at
  ) {
    return { outcome: 'unauthorized' };
  }
  return {
    outcome: row.outcome,
    submission: {
      briefId: row.brief_id,
      reference: row.submission_reference,
      revision: Number(row.revision),
      submittedAt: new Date(row.submitted_at),
    },
  };
}

export function createDiscoverySubmissionRepository(
  getDatabase: () => NeonQueryFunction<false, false>,
): DiscoverySubmissionRepository {
  return {
    async submit(input) {
      const sql = getDatabase();
      const { submission } = input;
      const rows = (await sql`
        SELECT *
        FROM discovery.submit_project_brief(
          ${input.sessionHash}::bytea,
          ${submission.expectedRevision}::bigint,
          ${submission.submissionId}::uuid,
          decode(${submission.payloadHash}, 'hex'),
          ${submission.answers}::jsonb,
          ${submission.locale}::varchar,
          ${submission.schemaVersion}::text,
          ${input.submissionReference}::text,
          ${input.outboxId}::uuid
        )
      `) as SubmissionRow[];
      return mapRow(rows[0]);
    },
  };
}
