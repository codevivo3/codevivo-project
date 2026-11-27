import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PERMANENT_VALIDATION_APPLIED_MIGRATIONS,
  PERMANENT_VALIDATION_AUTHORIZATION,
  PERMANENT_VALIDATION_BRANCH_ID,
  PERMANENT_VALIDATION_BRANCH_NAME,
  PERMANENT_VALIDATION_DIRECT_HOST,
  PERMANENT_VALIDATION_ENDPOINT_ID,
  PERMANENT_VALIDATION_PENDING_MIGRATION,
  PERMANENT_VALIDATION_PARENT_BRANCH_ID,
  PERMANENT_VALIDATION_PARENT_BRANCH_NAME,
  PERMANENT_VALIDATION_POOLED_HOST,
  PERMANENT_VALIDATION_REGION_ID,
  parsePermanentValidationPreflightInvocation,
  verifyPermanentValidationEvidence,
  verifyPermanentValidationTarget,
  type PermanentValidationChecksums,
  type PermanentValidationEvidence,
} from '../../scripts/discovery-permanent-validation-preflight-core';

const connections = {
  admin: `postgresql://codevivo_discovery_admin:test@${PERMANENT_VALIDATION_DIRECT_HOST}/neondb`,
  migration: `postgresql://codevivo_discovery_migration:test@${PERMANENT_VALIDATION_DIRECT_HOST}/neondb`,
  runtime: `postgresql://codevivo_discovery_runtime:test@${PERMANENT_VALIDATION_POOLED_HOST}/neondb`,
};
const parent = {
  id: PERMANENT_VALIDATION_PARENT_BRANCH_ID,
  name: PERMANENT_VALIDATION_PARENT_BRANCH_NAME,
};
const metadata = {
  branch: {
    id: PERMANENT_VALIDATION_BRANCH_ID,
    name: PERMANENT_VALIDATION_BRANCH_NAME,
    parent_id: parent.id,
  },
  endpoints: [{
    branch_id: PERMANENT_VALIDATION_BRANCH_ID,
    host: PERMANENT_VALIDATION_DIRECT_HOST,
    id: PERMANENT_VALIDATION_ENDPOINT_ID,
    region_id: PERMANENT_VALIDATION_REGION_ID,
    type: 'read_write',
  }],
  parent,
};

const checksums = Object.fromEntries([
  ...PERMANENT_VALIDATION_APPLIED_MIGRATIONS,
  PERMANENT_VALIDATION_PENDING_MIGRATION,
].map((version, index) => [version, String(index + 1).padStart(64, 'a')])) as
  PermanentValidationChecksums;

function evidence(): PermanentValidationEvidence {
  const identity = (role: string) => ({
    database: 'neondb',
    readOnly: true,
    role,
    serverVersion: 180000,
  });
  return {
    functions: [
      'prevent_revoked_invitation_update',
      'prevent_submitted_brief_update',
      'set_updated_at',
    ].map((name) => ({
      name,
      owner: 'codevivo_discovery_migration',
      publicExecute: false,
      runtimeExecute: false,
    })),
    identities: {
      admin: identity('codevivo_discovery_admin'),
      migration: identity('codevivo_discovery_migration'),
      runtime: identity('codevivo_discovery_runtime'),
    },
    migrations: PERMANENT_VALIDATION_APPLIED_MIGRATIONS.map((version) => ({
      checksum: checksums[version],
      version,
    })),
    permissions: {
      answersUpdate: true,
      contactUsage: false,
      outboxDeliveryUpdate: true,
      outboxInsert: true,
      provenanceSelect: false,
      providerMessageColumn: false,
      publicSchemaUsage: false,
      stateUpdate: false,
      submissionIdempotencyColumn: false,
      submissionReferenceUpdate: false,
      submittedImmutableTrigger: true,
    },
    roles: [
      'codevivo_discovery_admin',
      'codevivo_discovery_migration',
      'codevivo_discovery_runtime',
    ].map((name) => ({
      bypassRls: false,
      canLogin: true,
      createDb: false,
      createRole: false,
      memberOfAdmin: false,
      memberOfMigration: false,
      name,
      replication: false,
      superuser: false,
    })),
    schemas: ['contact', 'discovery'].map((name) => ({
      name,
      owner: 'codevivo_discovery_migration',
    })),
    submittedBriefs: 0,
  };
}

test('accepts only the exact permanent validation target', () => {
  assert.deepEqual(verifyPermanentValidationTarget({
    authorization: PERMANENT_VALIDATION_AUTHORIZATION,
    connections,
    metadata,
  }), {
    branchId: PERMANENT_VALIDATION_BRANCH_ID,
    endpointId: PERMANENT_VALIDATION_ENDPOINT_ID,
    parentBranchId: parent.id,
  });
});

test('pins the exact production parent branch identity', () => {
  assert.deepEqual(
    {
      childId: PERMANENT_VALIDATION_BRANCH_ID,
      childName: PERMANENT_VALIDATION_BRANCH_NAME,
      parentId: PERMANENT_VALIDATION_PARENT_BRANCH_ID,
      parentName: PERMANENT_VALIDATION_PARENT_BRANCH_NAME,
    },
    {
      childId: 'br-winter-block-bagymuuk',
      childName: 'discovery-validation',
      parentId: 'br-wispy-breeze-bakkpibs',
      parentName: 'production',
    },
  );
});

test('rejects a mismatched parent ID or parent name', () => {
  const valid = {
    authorization: PERMANENT_VALIDATION_AUTHORIZATION,
    connections,
    metadata,
  };
  assert.throws(() => verifyPermanentValidationTarget({
    ...valid,
    metadata: {
      ...metadata,
      branch: { ...metadata.branch, parent_id: 'br-unapproved-parent' },
    },
  }), /parent branch identity mismatch/u);
  assert.throws(() => verifyPermanentValidationTarget({
    ...valid,
    metadata: {
      ...metadata,
      parent: { ...parent, id: 'br-unapproved-parent' },
    },
  }), /parent branch identity mismatch/u);
  assert.throws(() => verifyPermanentValidationTarget({
    ...valid,
    metadata: {
      ...metadata,
      parent: { ...parent, name: 'not-production' },
    },
  }), /parent branch identity mismatch/u);
});

test('rejects wrong branch, parent, endpoint, role, host and pooling', () => {
  const valid = {
    authorization: PERMANENT_VALIDATION_AUTHORIZATION,
    connections,
    metadata,
  };
  assert.throws(() => verifyPermanentValidationTarget({
    ...valid,
    metadata: { ...metadata, branch: { ...metadata.branch, id: 'br-wrong' } },
  }));
  assert.throws(() => verifyPermanentValidationTarget({
    ...valid,
    metadata: { ...metadata, parent: { ...parent, id: 'br-wrong' } },
  }));
  assert.throws(() => verifyPermanentValidationTarget({
    ...valid,
    metadata: {
      ...metadata,
      endpoints: [{ ...metadata.endpoints[0], id: 'ep-wrong' }],
    },
  }));
  assert.throws(() => verifyPermanentValidationTarget({
    ...valid,
    connections: {
      ...connections,
      admin: connections.admin.replace(
        'codevivo_discovery_admin',
        'codevivo_discovery_runtime',
      ),
    },
  }));
  assert.throws(() => verifyPermanentValidationTarget({
    ...valid,
    connections: {
      ...connections,
      migration: connections.migration.replace(
        PERMANENT_VALIDATION_DIRECT_HOST,
        'ep-production.invalid',
      ),
    },
  }));
  assert.throws(() => verifyPermanentValidationTarget({
    ...valid,
    connections: {
      ...connections,
      runtime: connections.runtime.replace(
        PERMANENT_VALIDATION_POOLED_HOST,
        PERMANENT_VALIDATION_DIRECT_HOST,
      ),
    },
  }));
});

test('accepts only the expected pending-migration evidence', () => {
  assert.doesNotThrow(() => verifyPermanentValidationEvidence({
    checksums,
    evidence: evidence(),
  }));
});

test('rejects applied 0004, unknown migrations, submitted briefs and unsafe grants', () => {
  const applied = evidence();
  applied.migrations.push({
    checksum: checksums[PERMANENT_VALIDATION_PENDING_MIGRATION],
    version: PERMANENT_VALIDATION_PENDING_MIGRATION,
  });
  assert.throws(() => verifyPermanentValidationEvidence({ checksums, evidence: applied }));

  const submitted = evidence();
  submitted.submittedBriefs = 1;
  assert.throws(() => verifyPermanentValidationEvidence({
    checksums,
    evidence: submitted,
  }));

  const grant = evidence();
  grant.permissions.stateUpdate = true;
  assert.throws(() => verifyPermanentValidationEvidence({ checksums, evidence: grant }));
});

test('has no mutating command path', () => {
  assert.doesNotThrow(() => parsePermanentValidationPreflightInvocation(['preflight']));
  for (const command of ['validate', 'migrate', 'apply', 'write']) {
    assert.throws(() => parsePermanentValidationPreflightInvocation([command]));
  }
  assert.throws(() => parsePermanentValidationPreflightInvocation([]));
  assert.throws(() => parsePermanentValidationPreflightInvocation([
    'preflight',
    'validate',
  ]));
});
