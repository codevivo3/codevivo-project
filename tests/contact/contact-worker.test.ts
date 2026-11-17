import assert from 'node:assert/strict';
import test from 'node:test';
import {
  handleContactNotificationWorkerGet,
  isValidContactWorkerRuntimeConfiguration,
  isValidWorkerAuthorization,
  type ContactNotificationWorkerDependencies,
} from '../../src/lib/contact/notification-worker-core';
import {
  ContactOutboxDispatchError,
  type ContactOutboxDispatchSummary,
} from '../../src/lib/contact/outbox-core';

const secret = 'validation-worker-secret-'.padEnd(48, 'x');
const incorrectSecret = 'incorrect-worker-secret-'.padEnd(48, 'z');

const emptySummary = (): ContactOutboxDispatchSummary => ({
  ambiguousOutcomes: 0,
  claimed: 0,
  databaseFailures: 0,
  permanentFailures: 0,
  retriesScheduled: 0,
  sent: 0,
  staleClaims: 0,
});

function request(authorization?: string): Request {
  return new Request('https://codevivo.dev/api/internal/contact-notifications', {
    headers: authorization ? { authorization } : undefined,
  });
}

function dependencies(
  overrides: Partial<ContactNotificationWorkerDependencies> = {},
) {
  const logs: unknown[] = [];
  let dispatchCalls = 0;
  const value: ContactNotificationWorkerDependencies = {
    configurationReady: true,
    dispatch: async () => {
      dispatchCalls += 1;
      return emptySummary();
    },
    enabled: 'true',
    log: (level, record) => logs.push({ level, record }),
    secret,
    ...overrides,
  };
  return {
    dependencies: value,
    dispatchCalls: () => dispatchCalls,
    logs,
  };
}

test('missing and invalid authentication receive the same safe response', async () => {
  for (const authorization of [
    undefined,
    'Basic credentials',
    `Bearer ${incorrectSecret}`,
  ]) {
    const context = dependencies();
    const response = await handleContactNotificationWorkerGet(
      request(authorization),
      context.dependencies,
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { status: 'unauthorized' });
    assert.equal(context.dispatchCalls(), 0);
  }
});

test('missing, malformed, and short worker secrets fail closed', async () => {
  for (const configuredSecret of [
    undefined,
    'short',
    `${'x'.repeat(32)}\n`,
  ]) {
    const context = dependencies({ secret: configuredSecret });
    const response = await handleContactNotificationWorkerGet(
      request(`Bearer ${secret}`),
      context.dependencies,
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'unavailable' });
    assert.equal(context.dispatchCalls(), 0);
  }
});

test('the worker is disabled unless the activation value is exactly true', async () => {
  for (const enabled of [undefined, '', 'false', 'TRUE', '1']) {
    const context = dependencies({ enabled });
    const response = await handleContactNotificationWorkerGet(
      request(`Bearer ${secret}`),
      context.dependencies,
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'disabled' });
    assert.equal(context.dispatchCalls(), 0);
  }
});

test('valid authentication executes exactly one bounded dispatcher batch', async () => {
  const summary: ContactOutboxDispatchSummary = {
    ...emptySummary(),
    claimed: 3,
    sent: 2,
    retriesScheduled: 1,
  };
  let calls = 0;
  const context = dependencies({
    dispatch: async () => {
      calls += 1;
      return summary;
    },
  });

  const response = await handleContactNotificationWorkerGet(
    request(`Bearer ${secret}`),
    context.dependencies,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'completed', summary });
  assert.equal(calls, 1);
  assert.equal(context.logs.length, 1);
});

test('missing or invalid runtime configuration cannot claim outbox work', async () => {
  const context = dependencies({ configurationReady: false });
  const response = await handleContactNotificationWorkerGet(
    request(`Bearer ${secret}`),
    context.dependencies,
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'unavailable' });
  assert.equal(context.dispatchCalls(), 0);
});

test('runtime configuration requires the restricted contact role', () => {
  assert.equal(isValidContactWorkerRuntimeConfiguration(
    'postgresql://codevivo_contact_runtime:password@contact.example.test/neondb',
    're_test_configuration_only',
  ), true);
  assert.equal(isValidContactWorkerRuntimeConfiguration(
    'postgresql://codevivo_discovery_runtime:password@contact.example.test/neondb',
    're_test_configuration_only',
  ), false);
  assert.equal(isValidContactWorkerRuntimeConfiguration(
    'not-a-database-url',
    're_test_configuration_only',
  ), false);
  assert.equal(isValidContactWorkerRuntimeConfiguration(
    'postgresql://codevivo_contact_runtime:password@contact.example.test/neondb',
    undefined,
  ), false);
});

test('known and unexpected dispatcher failures use sanitized status mapping', async () => {
  const privateData = 'client@example.test private inquiry contents';
  const cases = [
    { error: new ContactOutboxDispatchError(), status: 503 },
    { error: new Error(privateData), status: 500 },
  ];

  for (const value of cases) {
    const context = dependencies({
      dispatch: async () => {
        throw value.error;
      },
    });
    const response = await handleContactNotificationWorkerGet(
      request(`Bearer ${secret}`),
      context.dependencies,
    );
    const diagnostics = JSON.stringify({
      body: await response.json(),
      logs: context.logs,
    });

    assert.equal(response.status, value.status);
    assert.doesNotMatch(diagnostics, /client@example\.test|private inquiry/iu);
  }
});

test('every worker response is explicitly non-cacheable', async () => {
  const scenarios: Array<{
    authorization?: string;
    overrides?: Partial<ContactNotificationWorkerDependencies>;
  }> = [
    { overrides: { enabled: 'false' } },
    { authorization: `Bearer ${incorrectSecret}` },
    { authorization: `Bearer ${secret}` },
    {
      authorization: `Bearer ${secret}`,
      overrides: { dispatch: async () => { throw new Error('failure'); } },
    },
  ];

  for (const scenario of scenarios) {
    const context = dependencies(scenario.overrides);
    const response = await handleContactNotificationWorkerGet(
      request(scenario.authorization),
      context.dependencies,
    );
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  }
});

test('authorization uses strict bearer-token parsing and constant-size digests', () => {
  assert.equal(isValidWorkerAuthorization(`Bearer ${secret}`, secret), true);
  assert.equal(isValidWorkerAuthorization(`bearer ${secret}`, secret), false);
  assert.equal(isValidWorkerAuthorization(`Bearer  ${secret}`, secret), false);
  assert.equal(isValidWorkerAuthorization(`Bearer ${secret} extra`, secret), false);
});

test('overlapping authenticated requests remain separate bounded invocations', async () => {
  let active = 0;
  let maximumActive = 0;
  let release: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const context = dependencies({
    dispatch: async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await blocked;
      active -= 1;
      return emptySummary();
    },
  });

  const first = handleContactNotificationWorkerGet(
    request(`Bearer ${secret}`),
    context.dependencies,
  );
  const second = handleContactNotificationWorkerGet(
    request(`Bearer ${secret}`),
    context.dependencies,
  );
  await new Promise((resolve) => setImmediate(resolve));
  release?.();

  const responses = await Promise.all([first, second]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  assert.equal(maximumActive, 2);
});
