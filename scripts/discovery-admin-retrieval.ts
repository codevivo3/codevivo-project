import type { NeonQueryFunction } from '@neondatabase/serverless';

export type SubmittedBriefExport = {
  answers: Record<string, unknown>;
  client: { email: string; name: string };
  locale: 'en' | 'it';
  schemaVersion: string;
  submissionReference: string;
  submittedAt: string;
};

type SubmittedBriefRow = {
  answers: Record<string, unknown>;
  client_email: string;
  client_name: string;
  locale: 'en' | 'it';
  schema_version: string;
  submission_reference: string;
  submitted_at: Date | string;
};

export function validateSubmissionReference(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^CV-\d{4}-[A-F0-9]{12}$/u.test(normalized)) {
    throw new Error('Invalid Project Discovery submission reference');
  }
  return normalized;
}

export async function retrieveSubmittedBrief(
  sql: NeonQueryFunction<false, false>,
  reference: string,
): Promise<SubmittedBriefExport> {
  const normalized = validateSubmissionReference(reference);
  const rows = await sql`
    SELECT
      briefs.submission_reference,
      briefs.submitted_at,
      briefs.schema_version,
      briefs.locale,
      briefs.answers,
      invitations.client_name,
      invitations.client_email
    FROM discovery.project_briefs AS briefs
    INNER JOIN discovery.invitations AS invitations
      ON invitations.id = briefs.invitation_id
    WHERE briefs.submission_reference = ${normalized}
      AND briefs.state = 'submitted'
    LIMIT 1
  ` as SubmittedBriefRow[];
  const row = rows[0];
  if (!row) throw new Error('Submitted Project Discovery brief not found');
  return {
    answers: row.answers,
    client: { email: row.client_email, name: row.client_name },
    locale: row.locale,
    schemaVersion: row.schema_version,
    submissionReference: row.submission_reference,
    submittedAt: new Date(row.submitted_at).toISOString(),
  };
}
