import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isDiscoveryEnabled,
  runDiscoveryOperation,
} from '../../src/lib/discovery/activation';
import { handleDiscoveryNotificationWorkerGet } from '../../src/lib/discovery/notification-worker-core';
import { DISCOVERY_SECURITY_HEADERS } from '../../src/lib/discovery/security-headers';

test('Discovery is disabled unless the value is exactly true', () => {
  for (const value of [undefined, '', 'false', 'TRUE', '1']) {
    assert.equal(isDiscoveryEnabled(value), false);
  }
  assert.equal(isDiscoveryEnabled('true'), true);
});

test('disabled client operations stop before database or Redis access', async () => {
  for (const enabled of [undefined, 'false']) {
    let calls = 0;
    const result = await runDiscoveryOperation(enabled, async () => {
      calls += 1;
      return new Response(null, { status: 204 });
    });
    assert.ok(result instanceof Response);
    assert.equal(result.status, 503);
    assert.deepEqual(await result.json(), { status: 'disabled' });
    for (const [name, value] of Object.entries(DISCOVERY_SECURITY_HEADERS)) {
      assert.equal(result.headers.get(name), value);
    }
    assert.equal(calls, 0);
  }
});

test('global client activation and notification worker activation are independent', async () => {
  let calls = 0;
  const response = await handleDiscoveryNotificationWorkerGet(
    new Request('https://codevivo.dev/api/internal/discovery-notifications', {
      headers: { authorization: `Bearer ${'x'.repeat(40)}` },
    }),
    {
      configurationReady: true,
      dispatch: async () => {
        calls += 1;
        return {
          ambiguousOutcomes: 0,
          claimed: 0,
          databaseFailures: 0,
          permanentFailures: 0,
          retriesScheduled: 0,
          sent: 0,
          staleClaims: 0,
        };
      },
      enabled: 'true',
      log: () => undefined,
      secret: 'x'.repeat(40),
    },
  );
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.equal(isDiscoveryEnabled('false'), false);
});
