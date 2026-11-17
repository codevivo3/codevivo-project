import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { neon } from '@neondatabase/serverless';
import {
  ContactNotificationDeliveryError,
  createContactOutboxDispatcher,
  type ClaimedContactNotification,
  type ContactNotificationSender,
} from '../../src/lib/contact/outbox-core';
import { createNeonContactOutboxRepository } from '../../src/lib/contact/outbox-repository-core';
import {
  createContactInquiryRepository,
  createNeonContactPersistence,
} from '../../src/lib/contact/repository-core';

const liveEnabled = process.env.CONTACT_OUTBOX_LIVE_ALLOW === '1';
const skipReason = liveEnabled
  ? false
  : 'Set CONTACT_OUTBOX_LIVE_ALLOW=1 only for a verified disposable database';

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required live-test variable: ${name}`);
  return value;
}

function verifiedUrl(
  variable: string,
  expectedHost: string,
  expectedRole: string,
): string {
  const value = requiredEnvironment(variable);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid live-test database URL: ${variable}`);
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== expectedHost ||
    url.hostname.includes('-pooler.') ||
    url.pathname !== '/neondb' ||
    decodeURIComponent(url.username) !== expectedRole
  ) {
    throw new Error(`Live-test database identity mismatch: ${variable}`);
  }
  return value;
}

test('Contact outbox live behavior', { skip: skipReason }, async (t) => {
  const expectedHost = requiredEnvironment('CONTACT_OUTBOX_LIVE_EXPECTED_HOST');
  if (
    !/^ep-[a-z0-9-]+\.c-[0-9]+\.eu-central-1\.aws\.neon\.tech$/u.test(
      expectedHost,
    )
  ) {
    throw new Error('Live-test expected host is not an approved direct endpoint');
  }

  const runtime = neon(verifiedUrl(
    'CONTACT_DATABASE_URL',
    expectedHost,
    'codevivo_contact_runtime',
  ));
  const admin = neon(verifiedUrl(
    'DISCOVERY_ADMIN_DATABASE_URL',
    expectedHost,
    'codevivo_discovery_admin',
  ));
  const migration = neon(verifiedUrl(
    'DISCOVERY_MIGRATION_DATABASE_URL',
    expectedHost,
    'codevivo_discovery_migration',
  ));
  const inquiryRepository = createContactInquiryRepository(
    createNeonContactPersistence(() => runtime),
  );
  const outboxRepository = createNeonContactOutboxRepository(() => runtime);
  const runId = randomUUID();
  const emailPrefix = `m3a1b3-${runId}`;
  const privacyVersion = `m3a1b3-test-${runId}`;

  await migration`
    INSERT INTO contact.privacy_notice_versions (
      version,
      locale,
      notice_url,
      privacy_contact_email,
      effective_at
    ) VALUES (
      ${privacyVersion},
      ${'en'},
      ${'https://example.invalid/privacy-test'},
      ${'privacy@codevivo.dev'},
      now() - interval '1 minute'
    )
  `;

  const createInquiry = async (label: string) => inquiryRepository.acceptInquiry({
    email: `${emailPrefix}-${label}@example.invalid`,
    idempotencyKey: randomUUID(),
    locale: 'en',
    message: `Synthetic Phase 3 outbox verification inquiry for ${label}.`,
    name: 'M3A.1b Phase 3 verification',
    privacyNoticeVersion: privacyVersion,
  });

  const eventsFor = async (inquiryId: string) => {
    const rows = await admin`
      SELECT
        id,
        event_type,
        idempotency_key,
        attempt_count,
        delivery_status
      FROM contact.notification_outbox
      WHERE inquiry_id = ${inquiryId}::uuid
      ORDER BY event_type
    `;
    return rows as Array<{
      attempt_count: number;
      delivery_status: string;
      event_type: ClaimedContactNotification['eventType'];
      id: string;
      idempotency_key: string;
    }>;
  };

  try {
    await t.test('restricted runtime permissions remain isolated', async () => {
      const [privileges] = await runtime`
        SELECT
          current_user AS role,
          has_schema_privilege(current_user, 'contact', 'USAGE')
            AS contact_usage,
          has_schema_privilege(current_user, 'contact', 'CREATE')
            AS contact_create,
          has_schema_privilege(current_user, 'discovery', 'USAGE')
            AS discovery_usage,
          has_table_privilege(
            current_user,
            'contact.notification_outbox',
            'UPDATE'
          ) AS outbox_update
      `;
      assert.deepEqual(privileges, {
        role: 'codevivo_contact_runtime',
        contact_usage: true,
        contact_create: false,
        discovery_usage: false,
        outbox_update: false,
      });
      const [columnPrivileges] = await runtime`
        SELECT
          has_column_privilege(
            current_user,
            'contact.notification_outbox',
            'delivery_status',
            'UPDATE'
          ) AS delivery_update,
          has_column_privilege(
            current_user,
            'contact.notification_outbox',
            'attempt_count',
            'UPDATE'
          ) AS attempt_update
      `;
      assert.deepEqual(columnPrivileges, {
        delivery_update: true,
        attempt_update: true,
      });
      await assert.rejects(runtime`SELECT count(*) FROM discovery.invitations`);
    });

    await t.test('concurrent workers claim one eligible event exactly once', async () => {
      const inquiry = await createInquiry('concurrent-claim');
      const events = await eventsFor(inquiry.inquiryId);
      const internal = events.find((value) => value.event_type === 'internal_alert');
      const acknowledgement = events.find(
        (value) => value.event_type === 'visitor_acknowledgement',
      );
      assert.ok(internal && acknowledgement);
      await admin`
        UPDATE contact.notification_outbox
        SET next_attempt_at = now() + interval '1 day'
        WHERE id = ${acknowledgement.id}::uuid
      `;

      const claimInput = {
        batchSize: 1,
        leaseExpiredBefore: new Date(Date.now() - 10 * 60 * 1_000),
        maxAttempts: 5,
      };
      const claims = await Promise.all([
        outboxRepository.claimEligible(claimInput),
        outboxRepository.claimEligible(claimInput),
      ]);
      assert.equal(claims.flat().length, 1);
      assert.equal(claims.flat()[0].eventId, internal.id);
      assert.equal(claims.flat()[0].attemptCount, 1);
      assert.equal(await outboxRepository.markDelivered({
        attemptCount: 1,
        eventId: internal.id,
        providerMessageId: 'mock-concurrent-claim',
      }), true);
    });

    await t.test('expired in-flight lease is recoverable and stale worker loses', async () => {
      const inquiry = await createInquiry('lease-expiration');
      const events = await eventsFor(inquiry.inquiryId);
      const internal = events.find((value) => value.event_type === 'internal_alert');
      const acknowledgement = events.find(
        (value) => value.event_type === 'visitor_acknowledgement',
      );
      assert.ok(internal && acknowledgement);
      await admin`
        UPDATE contact.notification_outbox
        SET next_attempt_at = now() + interval '1 day'
        WHERE id = ${acknowledgement.id}::uuid
      `;

      let providerStartedResolve: (() => void) | undefined;
      const providerStarted = new Promise<void>((resolve) => {
        providerStartedResolve = resolve;
      });
      let releaseProvider: (() => void) | undefined;
      const providerRelease = new Promise<void>((resolve) => {
        releaseProvider = resolve;
      });
      const firstKeys: string[] = [];
      const firstWorker = createContactOutboxDispatcher(
        outboxRepository,
        {
          async send(value) {
            firstKeys.push(value.idempotencyKey);
            providerStartedResolve?.();
            await providerRelease;
            return { providerMessageId: 'mock-first-worker' };
          },
        },
        { batchSize: 1 },
      );
      const firstRun = firstWorker.dispatchBatch();
      await providerStarted;

      // A successful NOWAIT lock while the provider is blocked proves the
      // claim transaction ended before network delivery began.
      await migration`
        SELECT id
        FROM contact.notification_outbox
        WHERE id = ${internal.id}::uuid
        FOR UPDATE NOWAIT
      `;

      const reclaimed = await outboxRepository.claimEligible({
        batchSize: 1,
        leaseExpiredBefore: new Date(Date.now() + 60_000),
        maxAttempts: 5,
      });
      assert.equal(reclaimed.length, 1);
      assert.equal(reclaimed[0].eventId, internal.id);
      assert.equal(reclaimed[0].attemptCount, 2);
      assert.equal(reclaimed[0].idempotencyKey, firstKeys[0]);
      assert.equal(await outboxRepository.markDelivered({
        attemptCount: 2,
        eventId: internal.id,
        providerMessageId: 'mock-recovery-worker',
      }), true);

      releaseProvider?.();
      const firstSummary = await firstRun;
      assert.equal(firstSummary.sent, 0);
      assert.equal(firstSummary.staleClaims, 1);
    });

    await t.test('temporary failure schedules a retry', async () => {
      const inquiry = await createInquiry('temporary-failure');
      const events = await eventsFor(inquiry.inquiryId);
      await admin`
        UPDATE contact.notification_outbox
        SET next_attempt_at = now() + interval '1 day'
        WHERE inquiry_id = ${inquiry.inquiryId}::uuid
          AND event_type = 'visitor_acknowledgement'
      `;
      const dispatcher = createContactOutboxDispatcher(
        outboxRepository,
        {
          async send() {
            throw new ContactNotificationDeliveryError(
              'temporary-provider-failure',
            );
          },
        },
        { batchSize: 1 },
      );
      const summary = await dispatcher.dispatchBatch();
      assert.equal(summary.retriesScheduled, 1);
      const internal = events.find((value) => value.event_type === 'internal_alert');
      assert.ok(internal);
      const [state] = await admin`
        SELECT
          delivery_status,
          attempt_count,
          next_attempt_at > now() AS retry_in_future,
          last_error_code
        FROM contact.notification_outbox
        WHERE id = ${internal.id}::uuid
      `;
      assert.deepEqual(state, {
        delivery_status: 'failed',
        attempt_count: 1,
        retry_in_future: true,
        last_error_code: 'temporary-provider-failure',
      });
    });

    await t.test('permanent failure and retry exhaustion are terminal', async () => {
      const permanentInquiry = await createInquiry('permanent-failure');
      const exhaustedInquiry = await createInquiry('retry-exhaustion');
      await admin`
        UPDATE contact.notification_outbox
        SET next_attempt_at = now() + interval '1 day'
        WHERE inquiry_id IN (
          ${permanentInquiry.inquiryId}::uuid,
          ${exhaustedInquiry.inquiryId}::uuid
        )
          AND event_type = 'visitor_acknowledgement'
      `;
      await admin`
        UPDATE contact.notification_outbox
        SET attempt_count = 4
        WHERE inquiry_id = ${exhaustedInquiry.inquiryId}::uuid
          AND event_type = 'internal_alert'
      `;

      const permanentEvent = (await eventsFor(permanentInquiry.inquiryId))
        .find((value) => value.event_type === 'internal_alert');
      assert.ok(permanentEvent);
      const permanentClaim = await outboxRepository.claimEligible({
        batchSize: 1,
        leaseExpiredBefore: new Date(Date.now() - 10 * 60 * 1_000),
        maxAttempts: 5,
      });
      assert.equal(permanentClaim[0].eventId, permanentEvent.id);
      assert.equal(await outboxRepository.markFailed({
        attemptCount: permanentClaim[0].attemptCount,
        errorCode: 'permanent-provider-failure',
        eventId: permanentClaim[0].eventId,
        nextAttemptAt: null,
      }), true);

      const exhaustedEvent = (await eventsFor(exhaustedInquiry.inquiryId))
        .find((value) => value.event_type === 'internal_alert');
      assert.ok(exhaustedEvent);
      const exhaustedClaim = await outboxRepository.claimEligible({
        batchSize: 1,
        leaseExpiredBefore: new Date(Date.now() - 10 * 60 * 1_000),
        maxAttempts: 5,
      });
      assert.equal(exhaustedClaim[0].eventId, exhaustedEvent.id);
      assert.equal(exhaustedClaim[0].attemptCount, 5);
      assert.equal(await outboxRepository.markFailed({
        attemptCount: exhaustedClaim[0].attemptCount,
        errorCode: 'temporary-provider-failure',
        eventId: exhaustedClaim[0].eventId,
        nextAttemptAt: null,
      }), true);

      const terminal = await admin`
        SELECT delivery_status, next_attempt_at
        FROM contact.notification_outbox
        WHERE id IN (
          ${permanentEvent.id}::uuid,
          ${exhaustedEvent.id}::uuid
        )
        ORDER BY id
      `;
      assert.equal(terminal.length, 2);
      assert.ok(terminal.every((value) =>
        value.delivery_status === 'failed' && value.next_attempt_at === null));
    });

    await t.test('internal and acknowledgement outcomes remain independent', async () => {
      const inquiry = await createInquiry('independent-events');
      const sender: ContactNotificationSender = {
        async send(value) {
          if (value.eventType === 'visitor_acknowledgement') {
            throw new ContactNotificationDeliveryError(
              'permanent-provider-failure',
            );
          }
          return { providerMessageId: 'mock-independent-internal' };
        },
      };
      const summary = await createContactOutboxDispatcher(
        outboxRepository,
        sender,
        { batchSize: 2, concurrency: 2 },
      ).dispatchBatch();
      assert.equal(summary.sent, 1);
      assert.equal(summary.permanentFailures, 1);

      const states = await admin`
        SELECT event_type, delivery_status
        FROM contact.notification_outbox
        WHERE inquiry_id = ${inquiry.inquiryId}::uuid
        ORDER BY event_type
      `;
      assert.deepEqual(states, [
        { event_type: 'internal_alert', delivery_status: 'sent' },
        {
          event_type: 'visitor_acknowledgement',
          delivery_status: 'failed',
        },
      ]);
    });
  } finally {
    await admin`
      DELETE FROM contact.contacts
      WHERE normalized_email LIKE ${`${emailPrefix}-%`}
    `;
    await migration`
      DELETE FROM contact.privacy_notice_versions
      WHERE version = ${privacyVersion} AND locale = 'en'
    `;
  }

  const [cleanup] = await migration`
    SELECT
      (SELECT count(*)::int FROM contact.contacts
        WHERE normalized_email LIKE ${`${emailPrefix}-%`}) AS contacts,
      (SELECT count(*)::int FROM contact.inquiries
        WHERE submitted_email ILIKE ${`${emailPrefix}-%`}) AS inquiries,
      (SELECT count(*)::int FROM contact.privacy_notice_versions
        WHERE version = ${privacyVersion}) AS privacy_versions,
      (SELECT count(*)::int
        FROM contact.notification_outbox notification_outbox
        LEFT JOIN contact.inquiries inquiries
          ON inquiries.id = notification_outbox.inquiry_id
        WHERE inquiries.id IS NULL) AS orphaned_events
  `;
  assert.deepEqual(cleanup, {
    contacts: 0,
    inquiries: 0,
    privacy_versions: 0,
    orphaned_events: 0,
  });
});
