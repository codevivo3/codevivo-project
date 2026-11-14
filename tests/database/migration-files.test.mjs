import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rolesSql = await readFile('db/bootstrap/roles.sql', 'utf8');
const foundationSql = await readFile(
  'db/migrations/0001_project_discovery_foundation.sql',
  'utf8',
);

test('database bootstrap defines the three approved roles', () => {
  for (const role of ['runtime', 'admin', 'migration']) {
    assert.match(rolesSql, new RegExp(`codevivo_discovery_${role}`, 'u'));
  }

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
