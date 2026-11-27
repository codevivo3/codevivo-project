import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PERMANENT_VALIDATION_MIGRATION_AUTHORIZATION,
  PERMANENT_VALIDATION_MIGRATION_CHECKSUM,
  executeAuthorizedPermanentValidationMigration,
  parsePermanentValidationMigrationInvocation,
  verifyPermanentValidationPostMigrationState,
  verifyPermanentValidationPreMigrationState,
  type PermanentValidationMigrationState,
  type PermanentValidationPostMigrationState,
} from '../../scripts/discovery-permanent-validation-migration-core';
import {
  PERMANENT_VALIDATION_APPLIED_MIGRATIONS,
  PERMANENT_VALIDATION_PENDING_MIGRATION,
  type PermanentValidationChecksums,
} from '../../scripts/discovery-permanent-validation-preflight-core';

const repositoryMigrations = [
  ...PERMANENT_VALIDATION_APPLIED_MIGRATIONS,
  PERMANENT_VALIDATION_PENDING_MIGRATION,
] as Array<keyof PermanentValidationChecksums>;
const checksums = Object.fromEntries(repositoryMigrations.map((version, index) => [
  version,
  version === PERMANENT_VALIDATION_PENDING_MIGRATION
    ? PERMANENT_VALIDATION_MIGRATION_CHECKSUM
    : String(index + 1).padStart(64, 'a'),
])) as PermanentValidationChecksums;
const counts = { invitations: 2, notificationEvents: 3, projectBriefs: 1 };

function preState(): PermanentValidationMigrationState {
  return {
    migrations: PERMANENT_VALIDATION_APPLIED_MIGRATIONS.map((version) => ({
      checksum: checksums[version],
      version,
    })),
    recordCounts: { ...counts },
    submittedBriefs: 0,
  };
}

function postState(): PermanentValidationPostMigrationState {
  return {
    columns: [
      'notification_outbox.provider_message_id',
      'project_briefs.submission_idempotency_id',
      'project_briefs.submission_payload_hash',
    ],
    functions: [
      'claim_notification_events',
      'mark_notification_delivered',
      'mark_notification_failed',
      'submit_project_brief',
    ].map((name) => ({
      name,
      owner: 'codevivo_discovery_migration',
      publicExecute: false,
      runtimeExecute: true,
      searchPathPinned: true,
    })),
    migrations: repositoryMigrations.map((version) => ({
      checksum: checksums[version],
      version,
    })),
    permissions: {
      outboxDeliveryUpdate: false,
      outboxInsert: false,
      stateUpdate: false,
      submissionReferenceUpdate: false,
    },
    recordCounts: { ...counts },
  };
}

test('requires the distinct migration command and authorization', async () => {
  assert.doesNotThrow(() => parsePermanentValidationMigrationInvocation([
    'apply-0004',
  ]));
  for (const command of ['preflight', 'validate', 'migrate']) {
    assert.throws(() => parsePermanentValidationMigrationInvocation([command]));
  }
  let calls = 0;
  await assert.rejects(executeAuthorizedPermanentValidationMigration({
    authorization: 'discovery-validation-read-only-preflight',
    execute: async () => { calls += 1; },
    preflight: async () => { calls += 1; },
  }));
  assert.equal(calls, 0);
});

test('permits one migration only after the preflight completes', async () => {
  const order: string[] = [];
  await executeAuthorizedPermanentValidationMigration({
    authorization: PERMANENT_VALIDATION_MIGRATION_AUTHORIZATION,
    preflight: async () => { order.push('preflight'); },
    execute: async () => { order.push('migration'); },
  });
  assert.deepEqual(order, ['preflight', 'migration']);
});

test('accepts only the exact pre-migration state and checksum', () => {
  assert.doesNotThrow(() => verifyPermanentValidationPreMigrationState({
    checksums,
    repositoryMigrations,
    state: preState(),
  }));
  const applied = preState();
  applied.migrations.push({
    checksum: checksums[PERMANENT_VALIDATION_PENDING_MIGRATION],
    version: PERMANENT_VALIDATION_PENDING_MIGRATION,
  });
  assert.throws(() => verifyPermanentValidationPreMigrationState({
    checksums,
    repositoryMigrations,
    state: applied,
  }));
  assert.throws(() => verifyPermanentValidationPreMigrationState({
    checksums: { ...checksums, [PERMANENT_VALIDATION_PENDING_MIGRATION]: 'a'.repeat(64) },
    repositoryMigrations,
    state: preState(),
  }));
});

test('accepts secured post-migration state with unchanged records', () => {
  assert.doesNotThrow(() => verifyPermanentValidationPostMigrationState({
    checksums,
    post: postState(),
    preCounts: counts,
  }));
});

test('rejects changed records, unsafe grants and malformed functions', () => {
  const records = postState();
  records.recordCounts.invitations += 1;
  assert.throws(() => verifyPermanentValidationPostMigrationState({
    checksums,
    post: records,
    preCounts: counts,
  }));
  const grant = postState();
  grant.permissions.outboxInsert = true;
  assert.throws(() => verifyPermanentValidationPostMigrationState({
    checksums,
    post: grant,
    preCounts: counts,
  }));
  const functionState = postState();
  functionState.functions[0].searchPathPinned = false;
  assert.throws(() => verifyPermanentValidationPostMigrationState({
    checksums,
    post: functionState,
    preCounts: counts,
  }));
});
