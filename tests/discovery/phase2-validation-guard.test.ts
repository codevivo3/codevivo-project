import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PHASE2_AUTHORIZATION,
  PHASE2_BRANCH_ID,
  PHASE2_BRANCH_NAME,
  PHASE2_DIRECT_HOST,
  PHASE2_ENDPOINT_ID,
  PHASE2_PARENT_BRANCH_ID,
  PHASE2_POOLED_HOST,
  PHASE2_REGION_ID,
  verifyPhase2Target,
} from '../../scripts/discovery-phase2-validation-core';

const branchId = PHASE2_BRANCH_ID;
const endpointId = PHASE2_ENDPOINT_ID;
const connections = {
  admin: `postgresql://codevivo_discovery_admin:test@${PHASE2_DIRECT_HOST}/neondb`,
  migration: `postgresql://codevivo_discovery_migration:test@${PHASE2_DIRECT_HOST}/neondb`,
  runtime: `postgresql://codevivo_discovery_runtime:test@${PHASE2_POOLED_HOST}/neondb`,
};
const metadata = {
  branches: [{
    id: branchId,
    name: PHASE2_BRANCH_NAME,
    parent_id: PHASE2_PARENT_BRANCH_ID,
    expires_at: '2026-11-28T14:57:33.000Z',
  }],
  endpoints: [{
    id: endpointId,
    branch_id: branchId,
    host: PHASE2_DIRECT_HOST,
    region_id: PHASE2_REGION_ID,
    type: 'read_write',
  }],
};

test('accepts only the exact disposable Phase 2 target', () => {
  assert.deepEqual(
    verifyPhase2Target({
      authorization: PHASE2_AUTHORIZATION,
      connections,
      metadata,
      now: new Date('2026-11-27T12:00:00.000Z'),
    }),
    {
      branchId,
      endpointId,
      expiresAt: '2026-11-28T14:57:33.000Z',
    },
  );
});

test('rejects missing authorization and every target mismatch', () => {
  const base = {
    authorization: PHASE2_AUTHORIZATION,
    connections,
    metadata,
    now: new Date('2026-11-27T12:00:00.000Z'),
  };
  assert.throws(() => verifyPhase2Target({ ...base, authorization: undefined }));
  assert.throws(() => verifyPhase2Target({
    ...base,
    connections: {
      ...connections,
      runtime: connections.runtime.replace(PHASE2_POOLED_HOST, PHASE2_DIRECT_HOST),
    },
  }));
  assert.throws(() => verifyPhase2Target({
    ...base,
    metadata: {
      ...metadata,
      branches: [{ ...metadata.branches[0], id: 'br-unapproved' }],
    },
  }));
  assert.throws(() => verifyPhase2Target({
    ...base,
    metadata: {
      ...metadata,
      branches: [{ ...metadata.branches[0], parent_id: 'br-production' }],
    },
  }));
  assert.throws(() => verifyPhase2Target({
    ...base,
    metadata: {
      ...metadata,
      endpoints: [{ ...metadata.endpoints[0], id: 'ep-unapproved' }],
    },
  }));
  assert.throws(() => verifyPhase2Target({
    ...base,
    metadata: {
      ...metadata,
      endpoints: [{ ...metadata.endpoints[0], host: 'production.invalid' }],
    },
  }));
  assert.throws(() => verifyPhase2Target({
    ...base,
    metadata: {
      ...metadata,
      endpoints: [{ ...metadata.endpoints[0], region_id: 'aws-us-east-1' }],
    },
  }));
});

test('rejects expired or nearly expired branches', () => {
  assert.throws(() => verifyPhase2Target({
    authorization: PHASE2_AUTHORIZATION,
    connections,
    metadata,
    now: new Date('2026-11-28T13:00:00.000Z'),
  }));
});
