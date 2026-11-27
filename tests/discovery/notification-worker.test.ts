import assert from 'node:assert/strict';
import test from 'node:test';
import {
  handleDiscoveryNotificationWorkerGet,
  isValidDiscoveryWorkerAuthorization,
  isValidDiscoveryWorkerRuntimeConfiguration,
  type DiscoveryNotificationWorkerDependencies,
} from '../../src/lib/discovery/notification-worker-core';
import {
  DiscoveryOutboxDispatchError,
  type DiscoveryOutboxDispatchSummary,
} from '../../src/lib/discovery/notification-outbox-core';

const secret = 'discovery-worker-secret-'.padEnd(48, 'x');
const wrongSecret = 'incorrect-worker-secret-'.padEnd(48, 'z');

const summary = (): DiscoveryOutboxDispatchSummary => ({
  ambiguousOutcomes: 0,
  claimed: 0,
  databaseFailures: 0,
  permanentFailures: 0,
  retriesScheduled: 0,
  sent: 0,
  staleClaims: 0,
});

function request(authorization?: string): Request {
  return new Request('https://codevivo.dev/api/internal/discovery-notifications', {
    headers: authorization ? { authorization } : undefined,
  });
}

function dependencies(
  overrides: Partial<DiscoveryNotificationWorkerDependencies> = {},
) {
  const logs: unknown[] = [];
  let calls = 0;
  const value: DiscoveryNotificationWorkerDependencies = {
    configurationReady: true,
    dispatch: async () => { calls += 1; return summary(); },
    enabled: 'true',
    log: (level, record) => logs.push({ level, record }),
    secret,
    ...overrides,
  };
  return { calls: () => calls, logs, value };
}

test('disabled, missing-secret, and unauthorized requests never dispatch', async () => {
  for (const scenario of [
    { authorization: `Bearer ${secret}`, overrides: { enabled: 'false' }, status: 503, body: 'disabled' },
    { authorization: `Bearer ${secret}`, overrides: { secret: undefined }, status: 503, body: 'unavailable' },
    { authorization: undefined, overrides: {}, status: 401, body: 'unauthorized' },
    { authorization: `Bearer ${wrongSecret}`, overrides: {}, status: 401, body: 'unauthorized' },
  ]) {
    const context = dependencies(scenario.overrides);
    const response = await handleDiscoveryNotificationWorkerGet(
      request(scenario.authorization),
      context.value,
    );
    assert.equal(response.status, scenario.status);
    assert.deepEqual(await response.json(), { status: scenario.body });
    assert.equal(context.calls(), 0);
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  }
});

test('authenticated request executes exactly one bounded dispatcher batch', async () => {
  const expected = { ...summary(), claimed: 2, sent: 2 };
  let calls = 0;
  const context = dependencies({
    dispatch: async () => { calls += 1; return expected; },
  });
  const response = await handleDiscoveryNotificationWorkerGet(
    request(`Bearer ${secret}`),
    context.value,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'completed', summary: expected });
  assert.equal(calls, 1);
});

test('runtime configuration requires Discovery role and all provider settings', () => {
  const valid = {
    databaseUrl: 'postgresql://codevivo_discovery_runtime:password@db.example.test/neondb',
    notificationRecipient: 'hello@example.test',
    resendApiKey: 're_offline_test',
  };
  assert.equal(isValidDiscoveryWorkerRuntimeConfiguration(valid), true);
  assert.equal(isValidDiscoveryWorkerRuntimeConfiguration({
    ...valid,
    databaseUrl: 'postgresql://codevivo_contact_runtime:password@db.example.test/neondb',
  }), false);
  assert.equal(isValidDiscoveryWorkerRuntimeConfiguration({ ...valid, resendApiKey: undefined }), false);
  assert.equal(isValidDiscoveryWorkerRuntimeConfiguration({ ...valid, notificationRecipient: 'invalid' }), false);
});

test('dispatcher failures have sanitized responses and logs', async () => {
  for (const [error, status] of [
    [new DiscoveryOutboxDispatchError(), 503],
    [new Error('client@example.test confidential answers and database URL'), 500],
  ] as const) {
    const context = dependencies({ dispatch: async () => { throw error; } });
    const response = await handleDiscoveryNotificationWorkerGet(
      request(`Bearer ${secret}`),
      context.value,
    );
    const diagnostics = JSON.stringify({ body: await response.json(), logs: context.logs });
    assert.equal(response.status, status);
    assert.doesNotMatch(diagnostics, /client@example\.test|confidential answers|database URL/iu);
  }
});

test('bearer parsing is strict and compares fixed-size digests', () => {
  assert.equal(isValidDiscoveryWorkerAuthorization(`Bearer ${secret}`, secret), true);
  assert.equal(isValidDiscoveryWorkerAuthorization(`bearer ${secret}`, secret), false);
  assert.equal(isValidDiscoveryWorkerAuthorization(`Bearer  ${secret}`, secret), false);
  assert.equal(isValidDiscoveryWorkerAuthorization(`Bearer ${secret} extra`, secret), false);
});
