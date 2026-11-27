import type { NeonQueryFunction } from '@neondatabase/serverless';
import type {
  ClaimedDiscoveryNotification,
  DiscoveryOutboxRepository,
} from './notification-outbox-core';

type ClaimedRow = {
  attempt_count: number | string;
  brief_id: string;
  client_email: string;
  client_name: string;
  event_id: string;
  event_type: string;
  idempotency_key: string;
  locale: string;
  submission_reference: string;
  submitted_at: Date | string;
};

function mapClaim(row: ClaimedRow): ClaimedDiscoveryNotification {
  if (
    row.event_type !== 'project_brief_submitted'
    || !['en', 'it'].includes(row.locale)
    || !row.submission_reference
  ) {
    throw new Error('Unexpected Discovery notification claim');
  }
  return {
    attemptCount: Number(row.attempt_count),
    briefId: row.brief_id,
    clientEmail: row.client_email,
    clientName: row.client_name,
    eventId: row.event_id,
    eventType: row.event_type,
    idempotencyKey: row.idempotency_key,
    locale: row.locale as 'en' | 'it',
    submissionReference: row.submission_reference,
    submittedAt: new Date(row.submitted_at),
  };
}

export function createDiscoveryNotificationOutboxRepository(
  getDatabase: () => NeonQueryFunction<false, false>,
): DiscoveryOutboxRepository {
  return {
    async claimEligible(input) {
      const sql = getDatabase();
      const rows = await sql`
        SELECT *
        FROM discovery.claim_notification_events(
          ${input.batchSize}::integer,
          ${input.leaseExpiredBefore.toISOString()}::timestamptz,
          ${input.maxAttempts}::integer
        )
      ` as ClaimedRow[];
      return rows.map(mapClaim);
    },

    async markDelivered(input) {
      const sql = getDatabase();
      const [row] = await sql`
        SELECT discovery.mark_notification_delivered(
          ${input.eventId}::uuid,
          ${input.attemptCount}::integer,
          ${input.providerMessageId}::text
        ) AS updated
      ` as Array<{ updated: boolean }>;
      return row?.updated === true;
    },

    async markFailed(input) {
      const sql = getDatabase();
      const [row] = await sql`
        SELECT discovery.mark_notification_failed(
          ${input.eventId}::uuid,
          ${input.attemptCount}::integer,
          ${input.errorCode}::text,
          ${input.nextAttemptAt?.toISOString() ?? null}::timestamptz
        ) AS updated
      ` as Array<{ updated: boolean }>;
      return row?.updated === true;
    },
  };
}
