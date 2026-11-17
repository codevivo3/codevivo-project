import type { NeonQueryFunction } from '@neondatabase/serverless';
import type {
  ClaimedContactNotification,
  ContactOutboxRepository,
} from './outbox-core';

type ClaimedRow = {
  attempt_count: number;
  event_id: string;
  event_type: ClaimedContactNotification['eventType'];
  idempotency_key: string;
  inquiry_id: string;
  locale: ClaimedContactNotification['locale'];
  message: string;
  submitted_email: string;
  submitted_name: string;
};

export function createNeonContactOutboxRepository(
  getDatabase: () => NeonQueryFunction<false, false>,
): ContactOutboxRepository {
  return {
    async claimEligible(input) {
      const sql = getDatabase();
      const rows = await sql`
        WITH exhausted AS (
          UPDATE contact.notification_outbox
          SET
            delivery_status = 'failed',
            next_attempt_at = NULL,
            last_error_code = 'claim-expired-max-attempts'
          WHERE attempt_count >= ${input.maxAttempts}
            AND (
              delivery_status = 'pending'
              OR (
                delivery_status = 'failed'
                AND next_attempt_at IS NOT NULL
              )
              OR (
                delivery_status = 'processing'
                AND last_attempt_at <= ${input.leaseExpiredBefore.toISOString()}::timestamptz
              )
            )
          RETURNING id
        ),
        eligible AS MATERIALIZED (
          SELECT notification_outbox.id
          FROM contact.notification_outbox notification_outbox
          WHERE notification_outbox.attempt_count < ${input.maxAttempts}
            AND (
              (
                notification_outbox.delivery_status = 'pending'
                AND (
                  notification_outbox.next_attempt_at IS NULL
                  OR notification_outbox.next_attempt_at <= now()
                )
              )
              OR (
                notification_outbox.delivery_status = 'failed'
                AND notification_outbox.next_attempt_at <= now()
              )
              OR (
                notification_outbox.delivery_status = 'processing'
                AND notification_outbox.last_attempt_at <=
                  ${input.leaseExpiredBefore.toISOString()}::timestamptz
              )
            )
          ORDER BY
            COALESCE(
              notification_outbox.next_attempt_at,
              notification_outbox.created_at
            ),
            notification_outbox.created_at
          FOR UPDATE SKIP LOCKED
          LIMIT ${input.batchSize}
        ),
        claimed AS (
          UPDATE contact.notification_outbox notification_outbox
          SET
            delivery_status = 'processing',
            attempt_count = notification_outbox.attempt_count + 1,
            last_attempt_at = now(),
            next_attempt_at = NULL,
            last_error_code = NULL
          FROM eligible
          WHERE notification_outbox.id = eligible.id
          RETURNING
            notification_outbox.id,
            notification_outbox.inquiry_id,
            notification_outbox.event_type,
            notification_outbox.idempotency_key,
            notification_outbox.attempt_count
        )
        SELECT
          claimed.id AS event_id,
          claimed.inquiry_id,
          claimed.event_type,
          claimed.idempotency_key,
          claimed.attempt_count,
          inquiries.submitted_name,
          inquiries.submitted_email,
          inquiries.locale,
          inquiries.message,
          (SELECT count(*) FROM exhausted) AS exhausted_count
        FROM claimed
        INNER JOIN contact.inquiries inquiries
          ON inquiries.id = claimed.inquiry_id
        ORDER BY claimed.id
      ` as ClaimedRow[];

      return rows.map((row) => ({
        attemptCount: row.attempt_count,
        email: row.submitted_email,
        eventId: row.event_id,
        eventType: row.event_type,
        idempotencyKey: row.idempotency_key,
        inquiryId: row.inquiry_id,
        locale: row.locale,
        message: row.message,
        name: row.submitted_name,
      }));
    },

    async markDelivered(input) {
      const sql = getDatabase();
      const rows = await sql`
        UPDATE contact.notification_outbox
        SET
          delivery_status = 'sent',
          delivered_at = now(),
          provider_message_id = ${input.providerMessageId},
          next_attempt_at = NULL,
          last_error_code = NULL
        WHERE id = ${input.eventId}::uuid
          AND delivery_status = 'processing'
          AND attempt_count = ${input.attemptCount}
        RETURNING id
      `;
      return rows.length === 1;
    },

    async markFailed(input) {
      const sql = getDatabase();
      const rows = await sql`
        UPDATE contact.notification_outbox
        SET
          delivery_status = 'failed',
          next_attempt_at = ${input.nextAttemptAt?.toISOString() ?? null}::timestamptz,
          delivered_at = NULL,
          provider_message_id = NULL,
          last_error_code = ${input.errorCode}
        WHERE id = ${input.eventId}::uuid
          AND delivery_status = 'processing'
          AND attempt_count = ${input.attemptCount}
        RETURNING id
      `;
      return rows.length === 1;
    },
  };
}
