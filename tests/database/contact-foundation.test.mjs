import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { neon } from '@neondatabase/serverless';

const requiredVariables = [
  'CONTACT_DATABASE_URL',
  'DISCOVERY_ADMIN_DATABASE_URL',
  'DISCOVERY_MIGRATION_DATABASE_URL',
];
const missingVariables = requiredVariables.filter(
  (variable) => !process.env[variable],
);
const integrationEnabled = process.env.CONTACT_DB_TEST_ALLOW === '1';
const skipReason = !integrationEnabled
  ? 'Set CONTACT_DB_TEST_ALLOW=1 only for a verified disposable database'
  : missingVariables.length > 0
    ? `Missing required database variables: ${missingVariables.join(', ')}`
    : false;

test('Contact database foundation behavior', { skip: skipReason }, async (t) => {
  const runtime = neon(process.env.CONTACT_DATABASE_URL);
  const admin = neon(process.env.DISCOVERY_ADMIN_DATABASE_URL);
  const migration = neon(process.env.DISCOVERY_MIGRATION_DATABASE_URL);
  const suffix = randomUUID();
  const privacyVersion = `test-${suffix}`;
  const firstContactId = randomUUID();
  const concurrentContactIds = [randomUUID(), randomUUID()];
  const rollbackContactId = randomUUID();
  const inquiryIds = [randomUUID(), randomUUID()];
  const idempotencyKeys = [randomUUID(), randomUUID()];
  const eventIds = [randomUUID(), randomUUID()];
  const normalizedEmail = `contact-${suffix}@example.invalid`;
  const concurrentEmail = `concurrent-${suffix}@example.invalid`;
  const hashHex = () => randomBytes(32).toString('hex');

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
      ${'https://example.invalid/privacy'},
      ${'privacy@codevivo.dev'},
      now()
    )
  `;

  try {
    await t.test('roles are isolated and least privilege', async () => {
      const [runtimePrivileges] = await runtime`
        SELECT
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
            AS inquiry_update,
          has_table_privilege(
            current_user,
            'contact.privacy_notice_versions',
            'INSERT'
          ) AS privacy_insert
      `;
      const [adminPrivileges] = await admin`
        SELECT
          current_user AS role,
          has_schema_privilege(current_user, 'contact', 'USAGE')
            AS contact_usage,
          has_schema_privilege(current_user, 'contact', 'CREATE')
            AS contact_create,
          has_table_privilege(current_user, 'contact.contacts', 'DELETE')
            AS contact_delete,
          has_table_privilege(current_user, 'contact.inquiries', 'UPDATE')
            AS inquiry_update,
          has_table_privilege(
            current_user,
            'contact.privacy_notice_versions',
            'INSERT'
          ) AS privacy_insert
      `;

      assert.equal(runtimePrivileges.role, 'codevivo_contact_runtime');
      assert.equal(runtimePrivileges.contact_usage, true);
      assert.equal(runtimePrivileges.contact_create, false);
      assert.equal(runtimePrivileges.discovery_usage, false);
      assert.equal(runtimePrivileges.contact_delete, false);
      assert.equal(runtimePrivileges.inquiry_update, false);
      assert.equal(runtimePrivileges.privacy_insert, false);
      assert.equal(adminPrivileges.role, 'codevivo_discovery_admin');
      assert.equal(adminPrivileges.contact_usage, true);
      assert.equal(adminPrivileges.contact_create, false);
      assert.equal(adminPrivileges.contact_delete, true);
      assert.equal(adminPrivileges.inquiry_update, false);
      assert.equal(adminPrivileges.privacy_insert, false);
    });

    await runtime`
      INSERT INTO contact.contacts (
        id,
        display_name,
        email,
        normalized_email,
        last_meaningful_interaction_at,
        retention_policy_version,
        retention_review_at
      ) VALUES (
        ${firstContactId},
        ${'Contact integration fixture'},
        ${normalizedEmail},
        ${normalizedEmail},
        now(),
        ${'inactive-prospect-12-months-provisional'},
        now() + interval '12 months'
      )
    `;

    await t.test('normalized email is unique', async () => {
      await assert.rejects(runtime`
        INSERT INTO contact.contacts (
          id,
          display_name,
          email,
          normalized_email,
          last_meaningful_interaction_at,
          retention_policy_version,
          retention_review_at
        ) VALUES (
          ${randomUUID()},
          ${'Duplicate contact fixture'},
          ${normalizedEmail.toUpperCase()},
          ${normalizedEmail},
          now(),
          ${'inactive-prospect-12-months-provisional'},
          now() + interval '12 months'
        )
      `);
    });

    await runtime.transaction([
      runtime`
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
        ) VALUES (
          ${inquiryIds[0]},
          ${firstContactId},
          ${idempotencyKeys[0]},
          decode(${hashHex()}, 'hex'),
          ${'First inquiry snapshot'},
          ${normalizedEmail},
          ${'en'},
          ${'This is the first synthetic contact inquiry message.'},
          ${privacyVersion},
          ${'en'}
        )
      `,
      runtime`
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
        ) VALUES (
          ${inquiryIds[1]},
          ${firstContactId},
          ${idempotencyKeys[1]},
          decode(${hashHex()}, 'hex'),
          ${'Second inquiry snapshot'},
          ${normalizedEmail},
          ${'en'},
          ${'This is the second synthetic contact inquiry message.'},
          ${privacyVersion},
          ${'en'}
        )
      `,
    ]);

    await t.test('one contact can own multiple inquiries', async () => {
      const [result] = await runtime`
        SELECT count(*)::int AS count
        FROM contact.inquiries
        WHERE contact_id = ${firstContactId}
      `;
      assert.equal(result.count, 2);
    });

    await t.test('idempotency, payload, locale, and privacy constraints hold', async () => {
      await assert.rejects(runtime`
        INSERT INTO contact.inquiries (
          id, contact_id, idempotency_key, payload_hash,
          submitted_name, submitted_email, locale, message,
          privacy_notice_version, privacy_notice_locale
        ) VALUES (
          ${randomUUID()}, ${firstContactId}, ${idempotencyKeys[0]},
          decode(${hashHex()}, 'hex'), ${'Duplicate idempotency fixture'},
          ${normalizedEmail}, ${'en'},
          ${'A valid message with a duplicate idempotency key.'},
          ${privacyVersion}, ${'en'}
        )
      `);
      await assert.rejects(runtime`
        INSERT INTO contact.inquiries (
          id, contact_id, idempotency_key, payload_hash,
          submitted_name, submitted_email, locale, message,
          privacy_notice_version, privacy_notice_locale
        ) VALUES (
          ${randomUUID()}, ${firstContactId}, ${randomUUID()},
          decode(${'00'}, 'hex'), ${'Invalid hash fixture'},
          ${normalizedEmail}, ${'en'},
          ${'A valid message paired with an invalid payload hash.'},
          ${privacyVersion}, ${'en'}
        )
      `);
      await assert.rejects(runtime`
        INSERT INTO contact.inquiries (
          id, contact_id, idempotency_key, payload_hash,
          submitted_name, submitted_email, locale, message,
          privacy_notice_version, privacy_notice_locale
        ) VALUES (
          ${randomUUID()}, ${firstContactId}, ${randomUUID()},
          decode(${hashHex()}, 'hex'), ${'Invalid locale fixture'},
          ${normalizedEmail}, ${'it'},
          ${'A valid message paired with the wrong notice locale.'},
          ${privacyVersion}, ${'en'}
        )
      `);
      await assert.rejects(runtime`
        INSERT INTO contact.inquiries (
          id, contact_id, idempotency_key, payload_hash,
          submitted_name, submitted_email, locale, message,
          privacy_notice_version, privacy_notice_locale
        ) VALUES (
          ${randomUUID()}, ${firstContactId}, ${randomUUID()},
          decode(${hashHex()}, 'hex'), ${'Missing notice fixture'},
          ${normalizedEmail}, ${'en'},
          ${'A valid message paired with a missing privacy notice.'},
          ${'missing-version'}, ${'en'}
        )
      `);
    });

    await runtime.transaction([
      runtime`
        INSERT INTO contact.notification_outbox (
          id, inquiry_id, event_type, idempotency_key
        ) VALUES (
          ${eventIds[0]}, ${inquiryIds[0]}, ${'internal_alert'},
          ${`contact:${inquiryIds[0]}:internal`}
        )
      `,
      runtime`
        INSERT INTO contact.notification_outbox (
          id, inquiry_id, event_type, idempotency_key
        ) VALUES (
          ${eventIds[1]}, ${inquiryIds[0]}, ${'visitor_acknowledgement'},
          ${`contact:${inquiryIds[0]}:acknowledgement`}
        )
      `,
    ]);

    await t.test('outbox events are unique and support retry metadata', async () => {
      const [counts] = await runtime`
        SELECT
          count(*) FILTER (WHERE event_type = 'internal_alert')::int
            AS internal_count,
          count(*) FILTER (WHERE event_type = 'visitor_acknowledgement')::int
            AS acknowledgement_count
        FROM contact.notification_outbox
        WHERE inquiry_id = ${inquiryIds[0]}
      `;
      assert.equal(counts.internal_count, 1);
      assert.equal(counts.acknowledgement_count, 1);

      await assert.rejects(runtime`
        INSERT INTO contact.notification_outbox (
          id, inquiry_id, event_type, idempotency_key
        ) VALUES (
          ${randomUUID()}, ${inquiryIds[0]}, ${'internal_alert'},
          ${`contact:${inquiryIds[0]}:duplicate`}
        )
      `);

      await runtime`
        UPDATE contact.notification_outbox
        SET
          delivery_status = 'processing',
          attempt_count = 1,
          last_attempt_at = now()
        WHERE id = ${eventIds[0]}
      `;
      await runtime`
        UPDATE contact.notification_outbox
        SET
          delivery_status = 'failed',
          next_attempt_at = now() + interval '5 minutes',
          last_error_code = 'temporary-provider-error'
        WHERE id = ${eventIds[0]}
      `;
      const [retry] = await runtime`
        SELECT delivery_status, attempt_count, next_attempt_at, last_error_code
        FROM contact.notification_outbox
        WHERE id = ${eventIds[0]}
      `;
      assert.equal(retry.delivery_status, 'failed');
      assert.equal(retry.attempt_count, 1);
      assert.ok(retry.next_attempt_at);
      assert.equal(retry.last_error_code, 'temporary-provider-error');
    });

    await t.test('inquiries and sent notifications are immutable', async () => {
      await assert.rejects(runtime`
        UPDATE contact.inquiries
        SET message = ${'Attempted mutation of the immutable inquiry snapshot.'}
        WHERE id = ${inquiryIds[0]}
      `);

      await runtime`
        UPDATE contact.notification_outbox
        SET
          delivery_status = 'sent',
          attempt_count = 1,
          last_attempt_at = now(),
          delivered_at = now(),
          provider_message_id = ${`provider-${eventIds[1]}`}
        WHERE id = ${eventIds[1]}
      `;
      await assert.rejects(runtime`
        UPDATE contact.notification_outbox
        SET delivery_status = 'pending', delivered_at = NULL,
            provider_message_id = NULL
        WHERE id = ${eventIds[1]}
      `);
    });

    await t.test('concurrent normalized-email inserts produce one contact', async () => {
      const attempts = await Promise.allSettled(
        concurrentContactIds.map((id) => runtime`
          INSERT INTO contact.contacts (
            id, display_name, email, normalized_email,
            last_meaningful_interaction_at,
            retention_policy_version,
            retention_review_at
          ) VALUES (
            ${id}, ${'Concurrent contact fixture'}, ${concurrentEmail},
            ${concurrentEmail}, now(),
            ${'inactive-prospect-12-months-provisional'},
            now() + interval '12 months'
          )
        `),
      );
      assert.equal(
        attempts.filter((attempt) => attempt.status === 'fulfilled').length,
        1,
      );
      assert.equal(
        attempts.filter((attempt) => attempt.status === 'rejected').length,
        1,
      );
    });

    await t.test('failed runtime transaction rolls back all writes', async () => {
      await assert.rejects(runtime.transaction([
        runtime`
          INSERT INTO contact.contacts (
            id, display_name, email, normalized_email,
            last_meaningful_interaction_at,
            retention_policy_version,
            retention_review_at
          ) VALUES (
            ${rollbackContactId}, ${'Rollback contact fixture'},
            ${`rollback-${suffix}@example.invalid`},
            ${`rollback-${suffix}@example.invalid`}, now(),
            ${'inactive-prospect-12-months-provisional'},
            now() + interval '12 months'
          )
        `,
        runtime`
          INSERT INTO contact.inquiries (
            id, contact_id, idempotency_key, payload_hash,
            submitted_name, submitted_email, locale, message,
            privacy_notice_version, privacy_notice_locale
          ) VALUES (
            ${randomUUID()}, ${rollbackContactId}, ${randomUUID()},
            decode(${'00'}, 'hex'), ${'Rollback inquiry fixture'},
            ${`rollback-${suffix}@example.invalid`}, ${'en'},
            ${'This row must fail and roll back the contact insert.'},
            ${privacyVersion}, ${'en'}
          )
        `,
      ]));

      const [result] = await migration`
        SELECT count(*)::int AS count
        FROM contact.contacts
        WHERE id = ${rollbackContactId}
      `;
      assert.equal(result.count, 0);
    });

    await t.test('failed migration-style transaction rolls back DDL', async () => {
      const [before] = await migration`
        SELECT to_regclass('contact.m3a1b_rollback_probe') AS relation
      `;
      assert.equal(before.relation, null);

      await assert.rejects(migration.transaction([
        migration`
          CREATE TABLE contact.m3a1b_rollback_probe (
            id uuid PRIMARY KEY
          )
        `,
        migration`SELECT 1 / 0`,
      ]));

      const [after] = await migration`
        SELECT to_regclass('contact.m3a1b_rollback_probe') AS relation
      `;
      assert.equal(after.relation, null);
    });
  } finally {
    await admin`
      DELETE FROM contact.contacts
      WHERE id IN (
        ${firstContactId},
        ${concurrentContactIds[0]},
        ${concurrentContactIds[1]},
        ${rollbackContactId}
      )
    `;
    await migration`
      DELETE FROM contact.privacy_notice_versions
      WHERE version = ${privacyVersion} AND locale = 'en'
    `;
  }
});
