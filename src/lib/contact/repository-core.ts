import { createHash, randomUUID } from 'node:crypto';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import {
  normalizeContactEmail,
  validateContactSubmission,
  type ContactLocale,
} from './validation';

export const CONTACT_RETENTION_POLICY_VERSION =
  'inactive-prospect-12-months-provisional';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type ContactRepositoryErrorCode =
  | 'database-unavailable'
  | 'idempotency-conflict'
  | 'internal-failure'
  | 'privacy-notice-unavailable'
  | 'validation-failed';

const safeErrorMessages: Record<ContactRepositoryErrorCode, string> = {
  'database-unavailable': 'Contact persistence is temporarily unavailable',
  'idempotency-conflict': 'The submission key was already used',
  'internal-failure': 'Contact persistence failed',
  'privacy-notice-unavailable': 'Approved privacy information is unavailable',
  'validation-failed': 'The contact inquiry is invalid',
};

export class ContactRepositoryError extends Error {
  readonly code: ContactRepositoryErrorCode;

  constructor(code: ContactRepositoryErrorCode) {
    super(safeErrorMessages[code]);
    this.name = 'ContactRepositoryError';
    this.code = code;
  }
}

export interface AcceptContactInquiryInput {
  email: string;
  idempotencyKey: string;
  locale: ContactLocale;
  message: string;
  name: string;
  privacyNoticeVersion: string;
}

export interface ContactInquiryPersistenceResult {
  contactId: string;
  createdAt: Date;
  inquiryId: string;
  replayed: boolean;
}

export interface ContactInquiryRepository {
  acceptInquiry(
    input: AcceptContactInquiryInput,
  ): Promise<ContactInquiryPersistenceResult>;
}

type PersistenceOutcome =
  | 'conflict'
  | 'created'
  | 'internal_failure'
  | 'privacy_unavailable'
  | 'replayed';

type PersistenceRow = {
  contact_id: string | null;
  created_at: string | Date | null;
  inquiry_id: string | null;
  outcome: PersistenceOutcome;
};

interface PreparedContactInquiry {
  acknowledgementEventId: string;
  contactId: string;
  email: string;
  idempotencyKey: string;
  inquiryId: string;
  internalEventId: string;
  locale: ContactLocale;
  message: string;
  name: string;
  normalizedEmail: string;
  payloadHash: string;
  privacyNoticeVersion: string;
}

export type ContactPersistenceOperation = (
  input: PreparedContactInquiry,
) => Promise<PersistenceRow>;

function payloadHash(input: {
  email: string;
  locale: ContactLocale;
  message: string;
  name: string;
  normalizedEmail: string;
  privacyNoticeVersion: string;
}): string {
  const canonicalPayload = JSON.stringify([
    1,
    input.name,
    input.email,
    input.normalizedEmail,
    input.locale,
    input.message,
    input.privacyNoticeVersion,
  ]);

  return createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
}

function isDatabaseUnavailable(error: unknown): boolean {
  let candidate: unknown = error;

  for (let depth = 0; depth < 3 && candidate instanceof Error; depth += 1) {
    const coded = candidate as Error & { code?: unknown; cause?: unknown };
    const code = typeof coded.code === 'string' ? coded.code : '';
    if (
      code.startsWith('08') ||
      [
        'CONTACT_DATABASE_UNAVAILABLE',
        'ECONNABORTED',
        'ECONNREFUSED',
        'ECONNRESET',
        'ENETUNREACH',
        'ENOTFOUND',
        'ETIMEDOUT',
      ].includes(code)
    ) {
      return true;
    }
    candidate = coded.cause;
  }

  return false;
}

function validatePrivacyNoticeVersion(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const version = value.trim();
  return version.length >= 1 && version.length <= 100 ? version : null;
}

export function createContactInquiryRepository(
  persist: ContactPersistenceOperation,
  createId: () => string = randomUUID,
): ContactInquiryRepository {
  return {
    async acceptInquiry(input) {
      const validation = validateContactSubmission(input);
      if (!validation.success || !uuidPattern.test(input.idempotencyKey)) {
        throw new ContactRepositoryError('validation-failed');
      }

      const privacyNoticeVersion = validatePrivacyNoticeVersion(
        input.privacyNoticeVersion,
      );
      if (!privacyNoticeVersion) {
        throw new ContactRepositoryError('privacy-notice-unavailable');
      }

      const prepared: PreparedContactInquiry = {
        ...validation.data,
        acknowledgementEventId: createId(),
        contactId: createId(),
        idempotencyKey: input.idempotencyKey.toLowerCase(),
        inquiryId: createId(),
        internalEventId: createId(),
        normalizedEmail: normalizeContactEmail(validation.data.email),
        payloadHash: payloadHash({
          ...validation.data,
          normalizedEmail: normalizeContactEmail(validation.data.email),
          privacyNoticeVersion,
        }),
        privacyNoticeVersion,
      };

      let row: PersistenceRow;
      try {
        row = await persist(prepared);
      } catch (error) {
        throw new ContactRepositoryError(
          isDatabaseUnavailable(error)
            ? 'database-unavailable'
            : 'internal-failure',
        );
      }

      if (row.outcome === 'conflict') {
        throw new ContactRepositoryError('idempotency-conflict');
      }
      if (row.outcome === 'privacy_unavailable') {
        throw new ContactRepositoryError('privacy-notice-unavailable');
      }
      if (
        row.outcome === 'internal_failure' ||
        !row.contact_id ||
        !row.inquiry_id ||
        !row.created_at
      ) {
        throw new ContactRepositoryError('internal-failure');
      }

      return {
        contactId: row.contact_id,
        createdAt: new Date(row.created_at),
        inquiryId: row.inquiry_id,
        replayed: row.outcome === 'replayed',
      };
    },
  };
}

export function createNeonContactPersistence(
  getDatabase: () => NeonQueryFunction<false, false>,
): ContactPersistenceOperation {
  return async (input) => {
    const sql = getDatabase();
    const transactionResults = await sql.transaction([
      sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${input.idempotencyKey}::text, 713917)
        )
      `,
      sql`
        WITH existing AS MATERIALIZED (
          SELECT
            inquiries.id AS inquiry_id,
            inquiries.contact_id,
            inquiries.created_at,
            encode(inquiries.payload_hash, 'hex') AS payload_hash,
            (
              SELECT count(*)::int
              FROM contact.notification_outbox
              WHERE notification_outbox.inquiry_id = inquiries.id
            ) AS event_count
          FROM contact.inquiries
          WHERE inquiries.idempotency_key = ${input.idempotencyKey}::uuid
        ),
        privacy AS MATERIALIZED (
          SELECT 1
          FROM contact.privacy_notice_versions
          WHERE version = ${input.privacyNoticeVersion}
            AND locale = ${input.locale}
            AND effective_at <= now()
            AND (retired_at IS NULL OR retired_at > now())
        ),
        contact_row AS (
          INSERT INTO contact.contacts (
            id,
            display_name,
            email,
            normalized_email,
            last_meaningful_interaction_at,
            retention_policy_version,
            retention_review_at
          )
          SELECT
            ${input.contactId}::uuid,
            ${input.name},
            ${input.email},
            ${input.normalizedEmail},
            now(),
            ${CONTACT_RETENTION_POLICY_VERSION},
            now() + interval '12 months'
          FROM privacy
          WHERE NOT EXISTS (SELECT 1 FROM existing)
          ON CONFLICT (normalized_email) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            email = EXCLUDED.email,
            last_meaningful_interaction_at = EXCLUDED.last_meaningful_interaction_at,
            retention_policy_version = EXCLUDED.retention_policy_version,
            retention_review_at = EXCLUDED.retention_review_at
          RETURNING id
        ),
        new_inquiry AS (
          INSERT INTO contact.inquiries (
            id,
            contact_id,
            idempotency_key,
            payload_hash,
            submitted_name,
            submitted_email,
            locale,
            message,
            privacy_notice_version,
            privacy_notice_locale
          )
          SELECT
            ${input.inquiryId}::uuid,
            contact_row.id,
            ${input.idempotencyKey}::uuid,
            decode(${input.payloadHash}, 'hex'),
            ${input.name},
            ${input.email},
            ${input.locale},
            ${input.message},
            ${input.privacyNoticeVersion},
            ${input.locale}
          FROM contact_row
          RETURNING id, contact_id, created_at
        ),
        new_events AS (
          INSERT INTO contact.notification_outbox (
            id,
            inquiry_id,
            event_type,
            idempotency_key
          )
          SELECT
            ${input.internalEventId}::uuid,
            new_inquiry.id,
            'internal_alert',
            'contact:' || new_inquiry.id::text || ':internal'
          FROM new_inquiry
          UNION ALL
          SELECT
            ${input.acknowledgementEventId}::uuid,
            new_inquiry.id,
            'visitor_acknowledgement',
            'contact:' || new_inquiry.id::text || ':acknowledgement'
          FROM new_inquiry
          RETURNING inquiry_id
        ),
        created AS MATERIALIZED (
          SELECT
            new_inquiry.id AS inquiry_id,
            new_inquiry.contact_id,
            new_inquiry.created_at,
            (SELECT count(*)::int FROM new_events) AS event_count
          FROM new_inquiry
        )
        SELECT
          CASE
            WHEN EXISTS (SELECT 1 FROM existing)
              AND (SELECT payload_hash FROM existing) <> ${input.payloadHash}
              THEN 'conflict'
            WHEN EXISTS (SELECT 1 FROM existing)
              AND (SELECT event_count FROM existing) = 2
              THEN 'replayed'
            WHEN EXISTS (SELECT 1 FROM existing)
              THEN 'internal_failure'
            WHEN NOT EXISTS (SELECT 1 FROM privacy)
              THEN 'privacy_unavailable'
            WHEN EXISTS (SELECT 1 FROM created)
              AND (SELECT event_count FROM created) = 2
              THEN 'created'
            ELSE 'internal_failure'
          END AS outcome,
          COALESCE(
            (SELECT contact_id FROM existing),
            (SELECT contact_id FROM created)
          ) AS contact_id,
          COALESCE(
            (SELECT inquiry_id FROM existing),
            (SELECT inquiry_id FROM created)
          ) AS inquiry_id,
          COALESCE(
            (SELECT created_at FROM existing),
            (SELECT created_at FROM created)
          ) AS created_at
      `,
    ]);

    const rows = transactionResults[1] as PersistenceRow[];
    return rows[0] ?? {
      contact_id: null,
      created_at: null,
      inquiry_id: null,
      outcome: 'internal_failure',
    };
  };
}
