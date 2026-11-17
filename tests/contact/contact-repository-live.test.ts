import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { neon } from '@neondatabase/serverless';
import {
  ContactRepositoryError,
  createContactInquiryRepository,
  createNeonContactPersistence,
} from '../../src/lib/contact/repository-core';

const liveEnabled = process.env.CONTACT_REPOSITORY_LIVE_ALLOW === '1';
const skipReason = liveEnabled
  ? false
  : 'Set CONTACT_REPOSITORY_LIVE_ALLOW=1 only for a verified disposable database';

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
    url.protocol !== 'postgres:' &&
    url.protocol !== 'postgresql:'
  ) {
    throw new Error(`Invalid live-test database scheme: ${variable}`);
  }
  if (
    url.hostname !== expectedHost ||
    url.hostname.includes('-pooler.') ||
    url.pathname !== '/neondb' ||
    decodeURIComponent(url.username) !== expectedRole
  ) {
    throw new Error(`Live-test database identity mismatch: ${variable}`);
  }

  return value;
}

test('Contact repository live behavior', { skip: skipReason }, async (t) => {
  const expectedHost = requiredEnvironment(
    'CONTACT_REPOSITORY_LIVE_EXPECTED_HOST',
  );
  if (
    !/^ep-[a-z0-9-]+\.c-[0-9]+\.eu-central-1\.aws\.neon\.tech$/u.test(
      expectedHost,
    )
  ) {
    throw new Error('Live-test expected host is not an approved direct endpoint');
  }

  const runtimeUrl = verifiedUrl(
    'CONTACT_DATABASE_URL',
    expectedHost,
    'codevivo_contact_runtime',
  );
  const adminUrl = verifiedUrl(
    'DISCOVERY_ADMIN_DATABASE_URL',
    expectedHost,
    'codevivo_discovery_admin',
  );
  const migrationUrl = verifiedUrl(
    'DISCOVERY_MIGRATION_DATABASE_URL',
    expectedHost,
    'codevivo_discovery_migration',
  );

  const runtime = neon(runtimeUrl);
  const admin = neon(adminUrl);
  const migration = neon(migrationUrl);
  const repository = createContactInquiryRepository(
    createNeonContactPersistence(() => runtime),
  );
  const runId = randomUUID();
  const emailPrefix = `m3a1b2-${runId}`;
  const privacyVersion = `m3a1b2-test-${runId}`;
  const noticeUrl = 'https://example.invalid/privacy-test';

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
      ${noticeUrl},
      ${'privacy@codevivo.dev'},
      now() - interval '1 minute'
    )
  `;

  const inquiry = (
    key: string,
    suffix: string,
    message = 'A synthetic live repository verification inquiry message.',
  ) => ({
    email: `${emailPrefix}-${suffix}@example.invalid`,
    idempotencyKey: key,
    locale: 'en' as const,
    message,
    name: 'M3A.1b Phase 2 verification',
    privacyNoticeVersion: privacyVersion,
  });

  try {
    await t.test('restricted runtime permissions remain isolated', async () => {
      const [privileges] = await runtime`
        SELECT
          current_database() AS database,
          current_user AS role,
          has_schema_privilege(current_user, 'contact', 'USAGE')
            AS contact_usage,
          has_schema_privilege(current_user, 'contact', 'CREATE')
            AS contact_create,
          has_schema_privilege(current_user, 'discovery', 'USAGE')
            AS discovery_usage,
          has_table_privilege(current_user, 'contact.contacts', 'DELETE')
            AS contact_delete,
          has_table_privilege(current_user, 'contact.inquiries', 'UPDATE')
            AS inquiry_update
      `;
      assert.deepEqual(privileges, {
        database: 'neondb',
        role: 'codevivo_contact_runtime',
        contact_usage: true,
        contact_create: false,
        discovery_usage: false,
        contact_delete: false,
        inquiry_update: false,
      });
      await assert.rejects(runtime`SELECT count(*) FROM discovery.invitations`);
    });

    await t.test('creates atomically and replays without duplicate events', async () => {
      const key = randomUUID();
      const input = inquiry(key, 'atomic');
      const created = await repository.acceptInquiry(input);
      const replayed = await repository.acceptInquiry(input);

      assert.equal(created.replayed, false);
      assert.equal(replayed.replayed, true);
      assert.equal(replayed.inquiryId, created.inquiryId);
      assert.equal(replayed.contactId, created.contactId);

      const [state] = await admin`
        SELECT
          count(DISTINCT inquiries.id)::int AS inquiries,
          count(notification_outbox.id)::int AS events,
          count(notification_outbox.id) FILTER (
            WHERE notification_outbox.event_type = 'internal_alert'
          )::int AS internal_events,
          count(notification_outbox.id) FILTER (
            WHERE notification_outbox.event_type = 'visitor_acknowledgement'
          )::int AS acknowledgement_events
        FROM contact.inquiries
        LEFT JOIN contact.notification_outbox
          ON notification_outbox.inquiry_id = inquiries.id
        WHERE inquiries.id = ${created.inquiryId}::uuid
      `;
      assert.deepEqual(state, {
        inquiries: 1,
        events: 2,
        internal_events: 1,
        acknowledgement_events: 1,
      });

      await assert.rejects(
        repository.acceptInquiry({
          ...input,
          message: 'A changed synthetic payload using the same submission key.',
        }),
        (error: unknown) => {
          assert.ok(error instanceof ContactRepositoryError);
          assert.equal(error.code, 'idempotency-conflict');
          return true;
        },
      );
    });

    await t.test('serializes concurrent identical submissions', async () => {
      const input = inquiry(randomUUID(), 'same-key');
      const results = await Promise.all([
        repository.acceptInquiry(input),
        repository.acceptInquiry(input),
      ]);
      assert.equal(results.filter((result) => result.replayed).length, 1);
      assert.equal(new Set(results.map((result) => result.inquiryId)).size, 1);
    });

    await t.test('deduplicates concurrent contacts across distinct inquiries', async () => {
      const email = `${emailPrefix}-shared@example.invalid`;
      const results = await Promise.all([
        repository.acceptInquiry({ ...inquiry(randomUUID(), 'unused-a'), email }),
        repository.acceptInquiry({
          ...inquiry(
            randomUUID(),
            'unused-b',
            'A second synthetic inquiry for the shared contact email.',
          ),
          email: email.toUpperCase(),
        }),
      ]);
      assert.equal(new Set(results.map((result) => result.contactId)).size, 1);
      assert.equal(new Set(results.map((result) => result.inquiryId)).size, 2);
    });

    await t.test('rolls back all writes when outbox creation fails', async () => {
      const fixedId = randomUUID();
      const failingRepository = createContactInquiryRepository(
        createNeonContactPersistence(() => runtime),
        () => fixedId,
      );
      const rollbackInput = inquiry(randomUUID(), 'rollback');
      await assert.rejects(
        failingRepository.acceptInquiry(rollbackInput),
        (error: unknown) => {
          assert.ok(error instanceof ContactRepositoryError);
          assert.equal(error.code, 'internal-failure');
          return true;
        },
      );

      const [residue] = await admin`
        SELECT
          (SELECT count(*)::int FROM contact.contacts
            WHERE normalized_email = ${rollbackInput.email}) AS contacts,
          (SELECT count(*)::int FROM contact.inquiries
            WHERE idempotency_key = ${rollbackInput.idempotencyKey}::uuid)
            AS inquiries,
          (SELECT count(*)::int FROM contact.notification_outbox
            WHERE inquiry_id = ${fixedId}::uuid) AS events
      `;
      assert.deepEqual(residue, { contacts: 0, inquiries: 0, events: 0 });
    });

    await t.test('enforces privacy references and provisional retention', async () => {
      await assert.rejects(
        repository.acceptInquiry({
          ...inquiry(randomUUID(), 'privacy'),
          privacyNoticeVersion: `missing-${runId}`,
        }),
        (error: unknown) => {
          assert.ok(error instanceof ContactRepositoryError);
          assert.equal(error.code, 'privacy-notice-unavailable');
          return true;
        },
      );

      const result = await repository.acceptInquiry(
        inquiry(randomUUID(), 'retention'),
      );
      const [record] = await admin`
        SELECT
          contacts.retention_policy_version,
          contacts.retention_review_at =
            contacts.last_meaningful_interaction_at + interval '12 months'
            AS retention_exact,
          inquiries.privacy_notice_version,
          inquiries.privacy_notice_locale
        FROM contact.contacts
        JOIN contact.inquiries ON inquiries.contact_id = contacts.id
        WHERE inquiries.id = ${result.inquiryId}::uuid
      `;
      assert.deepEqual(record, {
        retention_policy_version: 'inactive-prospect-12-months-provisional',
        retention_exact: true,
        privacy_notice_version: privacyVersion,
        privacy_notice_locale: 'en',
      });
    });

    await t.test('has no duplicate or orphaned synthetic records', async () => {
      const [integrity] = await admin`
        SELECT
          count(*) FILTER (WHERE event_count <> 2)::int AS invalid_event_sets,
          count(*) FILTER (WHERE contact_id IS NULL)::int AS orphaned_inquiries
        FROM (
          SELECT
            inquiries.id,
            inquiries.contact_id,
            count(notification_outbox.id)::int AS event_count
          FROM contact.inquiries
          LEFT JOIN contact.notification_outbox
            ON notification_outbox.inquiry_id = inquiries.id
          WHERE inquiries.submitted_email ILIKE ${`${emailPrefix}-%`}
          GROUP BY inquiries.id
        ) synthetic
      `;
      assert.deepEqual(integrity, {
        invalid_event_sets: 0,
        orphaned_inquiries: 0,
      });
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
      (SELECT count(*)::int
        FROM contact.notification_outbox notification_outbox
        JOIN contact.inquiries inquiries
          ON inquiries.id = notification_outbox.inquiry_id
        WHERE inquiries.submitted_email ILIKE ${`${emailPrefix}-%`}) AS events,
      (SELECT count(*)::int FROM contact.privacy_notice_versions
        WHERE version = ${privacyVersion}) AS privacy_versions
  `;
  assert.deepEqual(cleanup, {
    contacts: 0,
    inquiries: 0,
    events: 0,
    privacy_versions: 0,
  });
});
