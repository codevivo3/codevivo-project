import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rolesSql = await readFile('db/bootstrap/roles.sql', 'utf8');
const foundationSql = await readFile(
  'db/migrations/0001_project_discovery_foundation.sql',
  'utf8',
);
const contactFoundationSql = await readFile(
  'db/migrations/0002_contact_database_foundation.sql',
  'utf8',
);

test('database bootstrap defines the approved isolated roles', () => {
  for (const role of ['runtime', 'admin', 'migration']) {
    assert.match(rolesSql, new RegExp(`codevivo_discovery_${role}`, 'u'));
  }
  assert.match(rolesSql, /codevivo_contact_runtime/u);
  assert.match(
    rolesSql,
    /CREATE SCHEMA IF NOT EXISTS contact\s+AUTHORIZATION codevivo_discovery_migration/iu,
  );

  assert.doesNotMatch(rolesSql, /PASSWORD\s+['"]/iu);
});

test('foundation migration contains only additive schema operations', () => {
  assert.doesNotMatch(foundationSql, /\b(?:DROP|TRUNCATE)\b/iu);

  for (const table of [
    'invitations',
    'sessions',
    'project_briefs',
    'notification_outbox',
  ]) {
    assert.match(
      foundationSql,
      new RegExp(`CREATE TABLE discovery\\.${table}`, 'u'),
    );
  }
});

test('runtime role is not granted schema creation or invitation insertion', () => {
  assert.doesNotMatch(
    foundationSql,
    /GRANT\s+(?:ALL|CREATE)[\s\S]*?TO\s+codevivo_discovery_runtime/iu,
  );
  assert.doesNotMatch(
    foundationSql,
    /GRANT\s+INSERT\s+ON\s+discovery\.invitations[\s\S]*?codevivo_discovery_runtime/iu,
  );
});

test('contact foundation is additive and isolated from Discovery tables', () => {
  assert.doesNotMatch(contactFoundationSql, /\b(?:DROP|TRUNCATE)\b/iu);
  assert.doesNotMatch(
    contactFoundationSql,
    /\b(?:ALTER|DELETE|INSERT|UPDATE)\b[\s\S]*?discovery\./iu,
  );

  for (const table of [
    'contacts',
    'inquiries',
    'notification_outbox',
    'privacy_notice_versions',
  ]) {
    assert.match(
      contactFoundationSql,
      new RegExp(`CREATE TABLE contact\\.${table}`, 'u'),
    );
  }

  assert.doesNotMatch(contactFoundationSql, /inquiry_discovery_links/iu);
  assert.doesNotMatch(contactFoundationSql, /project_categor|marketing_consent/iu);
});

test('contact runtime grants remain least privilege', () => {
  const runtimeGrants = [
    ...contactFoundationSql.matchAll(/\bGRANT[\s\S]*?;/giu),
  ]
    .map(([statement]) => statement)
    .filter((statement) => statement.includes('codevivo_contact_runtime'));

  assert.ok(runtimeGrants.length > 0);
  for (const grant of runtimeGrants) {
    assert.doesNotMatch(grant, /\b(?:ALL|CREATE|DELETE)\b/iu);
    assert.doesNotMatch(grant, /UPDATE[\s\S]*?ON\s+contact\.inquiries/iu);
  }
  assert.match(
    contactFoundationSql,
    /GRANT\s+SELECT, INSERT\s+ON\s+contact\.inquiries\s+TO\s+codevivo_contact_runtime/iu,
  );
  assert.match(
    contactFoundationSql,
    /GRANT\s+SELECT\s+ON\s+contact\.privacy_notice_versions\s+TO\s+codevivo_contact_runtime/iu,
  );
});

test('contact inquiry integrity and notification events are constrained', () => {
  assert.match(contactFoundationSql, /idempotency_key uuid NOT NULL UNIQUE/iu);
  assert.match(
    contactFoundationSql,
    /octet_length\(payload_hash\) = 32/iu,
  );
  assert.match(
    contactFoundationSql,
    /event_type IN \('internal_alert', 'visitor_acknowledgement'\)/iu,
  );
  assert.match(
    contactFoundationSql,
    /UNIQUE \(inquiry_id, event_type\)/iu,
  );
  assert.match(contactFoundationSql, /contact inquiries are immutable/iu);
  assert.match(
    contactFoundationSql,
    /sent contact notification events are immutable/iu,
  );
});
