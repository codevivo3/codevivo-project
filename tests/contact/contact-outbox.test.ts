import assert from 'node:assert/strict';
import test from 'node:test';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import { Resend } from 'resend';
import {
  createResendContactNotificationSender,
  RESEND_IDEMPOTENCY_MAX_LENGTH,
  RESEND_IDEMPOTENCY_RETENTION_MS,
} from '../../src/lib/contact/notification-email-core';
import {
  ContactNotificationDeliveryError,
  ContactOutboxDispatchError,
  contactOutboxBackoffMs,
  createContactOutboxDispatcher,
  type ClaimedContactNotification,
  type ContactNotificationSender,
  type ContactOutboxRepository,
  type NotificationFailureCategory,
} from '../../src/lib/contact/outbox-core';
import { createNeonContactOutboxRepository } from '../../src/lib/contact/outbox-repository-core';

type ResendSend = Resend['emails']['send'];

const event = (
  overrides: Partial<ClaimedContactNotification> = {},
): ClaimedContactNotification => ({
  attemptCount: 1,
  email: 'client@example.test',
  eventId: '10000000-0000-4000-8000-000000000001',
  eventType: 'internal_alert',
  idempotencyKey: 'contact:inquiry:internal',
  inquiryId: '20000000-0000-4000-8000-000000000002',
  locale: 'en',
  message: 'A private inquiry message that must not appear in diagnostics.',
  name: 'Example Client',
  ...overrides,
});

function resendSend(
  operation: (
    payload: Record<string, unknown>,
    options: { idempotencyKey?: string },
  ) => Promise<unknown>,
): ResendSend {
  return operation as unknown as ResendSend;
}

class ScriptedRepository implements ContactOutboxRepository {
  claims: ClaimedContactNotification[] = [];
  delivered: Array<{
    attemptCount: number;
    eventId: string;
    providerMessageId: string;
  }> = [];
  failed: Array<{
    attemptCount: number;
    errorCode: NotificationFailureCategory;
    eventId: string;
    nextAttemptAt: Date | null;
  }> = [];
  deliveredResult = true;
  failedResult = true;
  failMarkFailed = false;
  failClaim = false;
  failMarkDelivered = false;
  claimResolved = false;

  async claimEligible() {
    if (this.failClaim) throw new Error('private database connection string');
    this.claimResolved = true;
    return this.claims;
  }

  async markDelivered(input: (typeof this.delivered)[number]) {
    if (this.failMarkDelivered) {
      throw new Error('private database response');
    }
    this.delivered.push(input);
    return this.deliveredResult;
  }

  async markFailed(input: (typeof this.failed)[number]) {
    if (this.failMarkFailed) throw new Error('private database diagnostic');
    this.failed.push(input);
    return this.failedResult;
  }
}

test('sends an internal notification with the stable provider idempotency key', async () => {
  const requests: Array<{
    options: { idempotencyKey?: string };
    payload: Record<string, unknown>;
  }> = [];
  const sender = createResendContactNotificationSender(
    resendSend(async (payload, options) => {
      requests.push({ payload, options });
      return {
        data: { id: 'provider-internal' },
        error: null,
        headers: null,
      };
    }),
  );

  const result = await sender.send(event());
  assert.deepEqual(result, { providerMessageId: 'provider-internal' });
  assert.equal(requests[0].options.idempotencyKey, event().idempotencyKey);
  assert.deepEqual(requests[0].payload.to, ['hello@codevivo.dev']);
  assert.equal(requests[0].payload.replyTo, 'Example Client <client@example.test>');
  assert.ok(requests[0].payload.react);
});

test('sends localized visitor acknowledgements independently', async () => {
  const requests: Record<string, unknown>[] = [];
  const sender = createResendContactNotificationSender(
    resendSend(async (payload) => {
      requests.push(payload);
      return {
        data: { id: `provider-${requests.length}` },
        error: null,
        headers: null,
      };
    }),
  );

  await sender.send(event({
    eventType: 'visitor_acknowledgement',
    locale: 'en',
  }));
  await sender.send(event({
    eventId: '30000000-0000-4000-8000-000000000003',
    eventType: 'visitor_acknowledgement',
    idempotencyKey: 'contact:inquiry:acknowledgement-it',
    locale: 'it',
  }));

  assert.match(String(requests[0].subject), /Thanks for reaching out/u);
  assert.match(String(requests[1].subject), /Grazie/u);
  assert.deepEqual(requests[0].to, ['client@example.test']);
});

test('preserves stable provider identity across retry attempts', async () => {
  const keys: Array<string | undefined> = [];
  const sender = createResendContactNotificationSender(
    resendSend(async (_payload, options) => {
      keys.push(options.idempotencyKey);
      return {
        data: { id: `provider-${keys.length}` },
        error: null,
        headers: null,
      };
    }),
  );
  const first = event({ attemptCount: 1 });
  const retry = event({ attemptCount: 2 });
  await sender.send(first);
  await sender.send(retry);
  assert.deepEqual(keys, [first.idempotencyKey, first.idempotencyKey]);
});

test('installed Resend SDK sends one stable request per adapter attempt', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ body: string; idempotencyKey: string | null }> = [];
  globalThis.fetch = async (_input, init) => {
    requests.push({
      body: String(init?.body),
      idempotencyKey: new Headers(init?.headers).get('Idempotency-Key'),
    });
    return new Response(JSON.stringify({ id: 'provider-idempotent-replay' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  };

  try {
    const resend = new Resend('offline-contract-test-key');
    const sender = createResendContactNotificationSender(
      resend.emails.send.bind(resend.emails),
    );
    const value = event();
    const first = await sender.send(value);
    const replay = await sender.send({ ...value, attemptCount: 2 });

    assert.deepEqual(first, { providerMessageId: 'provider-idempotent-replay' });
    assert.deepEqual(replay, first);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].body, requests[1].body);
    assert.equal(requests[0].idempotencyKey, value.idempotencyKey);
    assert.equal(requests[1].idempotencyKey, value.idempotencyKey);
    assert.ok(value.idempotencyKey.length <= RESEND_IDEMPOTENCY_MAX_LENGTH);
    assert.equal(RESEND_IDEMPOTENCY_RETENTION_MS, 24 * 60 * 60 * 1_000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('installed Resend SDK does not add transport retries', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    throw Object.assign(new Error('offline timeout with private transport data'), {
      code: 'ETIMEDOUT',
    });
  };

  try {
    const resend = new Resend('offline-contract-test-key');
    const sender = createResendContactNotificationSender(
      resend.emails.send.bind(resend.emails),
    );
    await assert.rejects(sender.send(event()), (error: unknown) => {
      assert.ok(error instanceof ContactNotificationDeliveryError);
      assert.equal(error.category, 'ambiguous-provider-outcome');
      return true;
    });
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('successful dispatch finalizes a claim after provider delivery', async () => {
  const repository = new ScriptedRepository();
  repository.claims = [event()];
  const sender: ContactNotificationSender = {
    async send() {
      assert.equal(repository.claimResolved, true);
      assert.equal(repository.delivered.length, 0);
      return { providerMessageId: 'provider-success' };
    },
  };
  const summary = await createContactOutboxDispatcher(
    repository,
    sender,
  ).dispatchBatch();

  assert.equal(summary.sent, 1);
  assert.equal(repository.delivered.length, 1);
  assert.equal(repository.failed.length, 0);
});

test('temporary failures schedule bounded exponential retry', async () => {
  const repository = new ScriptedRepository();
  repository.claims = [event({ attemptCount: 2 })];
  const now = new Date('2026-11-17T12:00:00.000Z');
  const sender: ContactNotificationSender = {
    async send() {
      throw new ContactNotificationDeliveryError(
        'temporary-provider-failure',
      );
    },
  };
  const summary = await createContactOutboxDispatcher(repository, sender, {
    now: () => now,
  }).dispatchBatch();

  assert.equal(summary.retriesScheduled, 1);
  assert.equal(repository.failed[0].errorCode, 'temporary-provider-failure');
  assert.equal(
    repository.failed[0].nextAttemptAt?.toISOString(),
    new Date(now.getTime() + 120_000).toISOString(),
  );
  assert.equal(contactOutboxBackoffMs(20), 60 * 60 * 1_000);
});

test('concurrent idempotent request is retryable without changing identity', async () => {
  const repository = new ScriptedRepository();
  repository.claims = [event()];
  const sender: ContactNotificationSender = {
    async send() {
      throw new ContactNotificationDeliveryError(
        'provider-idempotency-in-progress',
      );
    },
  };
  const summary = await createContactOutboxDispatcher(
    repository,
    sender,
  ).dispatchBatch();
  assert.equal(summary.retriesScheduled, 1);
  assert.equal(
    repository.failed[0].errorCode,
    'provider-idempotency-in-progress',
  );
});

test('maximum retry exhaustion becomes a terminal failure', async () => {
  const repository = new ScriptedRepository();
  repository.claims = [event({ attemptCount: 5 })];
  const sender: ContactNotificationSender = {
    async send() {
      throw new ContactNotificationDeliveryError('provider-rate-limit');
    },
  };
  const summary = await createContactOutboxDispatcher(
    repository,
    sender,
  ).dispatchBatch();

  assert.equal(summary.permanentFailures, 1);
  assert.equal(summary.retriesScheduled, 0);
  assert.equal(repository.failed[0].nextAttemptAt, null);
});

test('permanent provider and invalid configuration failures never retry', async () => {
  for (const category of [
    'permanent-provider-failure',
    'invalid-configuration',
    'provider-idempotency-conflict',
  ] as const) {
    const repository = new ScriptedRepository();
    repository.claims = [event()];
    const sender: ContactNotificationSender = {
      async send() {
        throw new ContactNotificationDeliveryError(category);
      },
    };
    const summary = await createContactOutboxDispatcher(
      repository,
      sender,
    ).dispatchBatch();
    assert.equal(summary.permanentFailures, 1);
    assert.equal(repository.failed[0].nextAttemptAt, null);
  }
});

test('provider timeout is an explicit ambiguous retryable outcome', async () => {
  const sender = createResendContactNotificationSender(
    resendSend(async () => {
      throw Object.assign(new Error('private provider timeout body'), {
        code: 'ETIMEDOUT',
      });
    }),
  );
  await assert.rejects(sender.send(event()), (error: unknown) => {
    assert.ok(error instanceof ContactNotificationDeliveryError);
    assert.equal(error.category, 'ambiguous-provider-outcome');
    assert.doesNotMatch(error.message, /private|timeout body/iu);
    return true;
  });
});

test('Resend response failures are categorized without sensitive diagnostics', async () => {
  for (const [name, statusCode, category] of [
    ['rate_limit_exceeded', 429, 'provider-rate-limit'],
    ['internal_server_error', 500, 'temporary-provider-failure'],
    ['service_unavailable', 503, 'temporary-provider-failure'],
    ['invalid_api_key', 401, 'invalid-configuration'],
    ['invalid_permission', 403, 'invalid-configuration'],
    ['invalid_idempotency_key', 400, 'invalid-configuration'],
    ['validation_error', 422, 'permanent-provider-failure'],
    [
      'invalid_idempotent_request',
      409,
      'provider-idempotency-conflict',
    ],
    [
      'concurrent_idempotent_requests',
      409,
      'provider-idempotency-in-progress',
    ],
    ['application_error', null, 'ambiguous-provider-outcome'],
  ] as const) {
    const sender = createResendContactNotificationSender(
      resendSend(async () => ({
        data: null,
        error: {
          message: 'client@example.test private inquiry content',
          name,
          statusCode,
        },
        headers: null,
      })),
    );
    await assert.rejects(sender.send(event()), (error: unknown) => {
      assert.ok(error instanceof ContactNotificationDeliveryError);
      assert.equal(error.category, category);
      assert.doesNotMatch(error.message, /client|private|example/iu);
      return true;
    });
  }
});

test('missing or malformed provider success is an ambiguous outcome', async () => {
  for (const response of [
    { data: null, error: null, headers: null },
    { data: {}, error: null, headers: null },
  ]) {
    const sender = createResendContactNotificationSender(
      resendSend(async () => response),
    );
    await assert.rejects(sender.send(event()), (error: unknown) => {
      assert.ok(error instanceof ContactNotificationDeliveryError);
      assert.equal(error.category, 'ambiguous-provider-outcome');
      return true;
    });
  }
});

test('partial batch failure does not abort unrelated events', async () => {
  const repository = new ScriptedRepository();
  repository.claims = [
    event(),
    event({
      eventId: '30000000-0000-4000-8000-000000000003',
      idempotencyKey: 'contact:inquiry:acknowledgement',
    }),
  ];
  const sender: ContactNotificationSender = {
    async send(value) {
      if (value.eventId === repository.claims[0].eventId) {
        throw new ContactNotificationDeliveryError(
          'temporary-provider-failure',
        );
      }
      return { providerMessageId: 'provider-second' };
    },
  };
  const summary = await createContactOutboxDispatcher(
    repository,
    sender,
  ).dispatchBatch();
  assert.equal(summary.sent, 1);
  assert.equal(summary.retriesScheduled, 1);
});

test('database failure while recording one result is isolated in the summary', async () => {
  const repository = new ScriptedRepository();
  repository.claims = [event()];
  repository.failMarkFailed = true;
  const sender: ContactNotificationSender = {
    async send() {
      throw new ContactNotificationDeliveryError(
        'temporary-provider-failure',
      );
    },
  };
  const summary = await createContactOutboxDispatcher(
    repository,
    sender,
  ).dispatchBatch();
  assert.equal(summary.databaseFailures, 1);
});

test('provider success with database finalization failure remains lease-recoverable', async () => {
  const repository = new ScriptedRepository();
  repository.claims = [event()];
  repository.failMarkDelivered = true;
  const sender: ContactNotificationSender = {
    async send() {
      return { providerMessageId: 'provider-accepted' };
    },
  };
  const summary = await createContactOutboxDispatcher(
    repository,
    sender,
  ).dispatchBatch();
  assert.equal(summary.sent, 0);
  assert.equal(summary.ambiguousOutcomes, 1);
  assert.equal(summary.databaseFailures, 1);
  assert.equal(repository.failed.length, 0);
});

test('claim database failures are sanitized before leaving the dispatcher', async () => {
  const repository = new ScriptedRepository();
  repository.failClaim = true;
  const dispatcher = createContactOutboxDispatcher(repository, {
    async send() {
      return { providerMessageId: 'unused' };
    },
  });
  await assert.rejects(dispatcher.dispatchBatch(), (error: unknown) => {
    assert.ok(error instanceof ContactOutboxDispatchError);
    assert.equal(error.code, 'database-unavailable');
    assert.doesNotMatch(error.message, /private|connection|string/iu);
    return true;
  });
});

test('controlled concurrency never exceeds the configured worker count', async () => {
  const repository = new ScriptedRepository();
  repository.claims = Array.from({ length: 5 }, (_, index) => event({
    eventId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  }));
  let active = 0;
  let maximumActive = 0;
  const sender: ContactNotificationSender = {
    async send(value) {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { providerMessageId: `provider-${value.eventId}` };
    },
  };
  await createContactOutboxDispatcher(repository, sender, {
    concurrency: 2,
  }).dispatchBatch();
  assert.equal(maximumActive, 2);
});

test('stale compare-and-set claims are not reported as delivered', async () => {
  const repository = new ScriptedRepository();
  repository.claims = [event()];
  repository.deliveredResult = false;
  const sender: ContactNotificationSender = {
    async send() {
      return { providerMessageId: 'provider-stale' };
    },
  };
  const summary = await createContactOutboxDispatcher(
    repository,
    sender,
  ).dispatchBatch();
  assert.equal(summary.sent, 0);
  assert.equal(summary.staleClaims, 1);
});

test('claim query excludes concurrent workers and recovers expired leases', async () => {
  type Query = { text: string; values: unknown[] };
  const captured: Query[] = [];
  const fakeTag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = Object.assign(Promise.resolve([]), {
      text: strings.join('$'),
      values,
    });
    captured.push(query);
    return query;
  };
  const sql = fakeTag as unknown as NeonQueryFunction<false, false>;
  const repository = createNeonContactOutboxRepository(() => sql);
  await repository.claimEligible({
    batchSize: 20,
    leaseExpiredBefore: new Date('2026-11-17T11:50:00.000Z'),
    maxAttempts: 5,
  });

  assert.equal(captured.length, 1);
  assert.match(captured[0].text, /FOR UPDATE SKIP LOCKED/iu);
  assert.match(captured[0].text, /delivery_status = 'processing'/iu);
  assert.match(captured[0].text, /last_attempt_at <=/iu);
  assert.match(captured[0].text, /claim-expired-max-attempts/iu);
  assert.doesNotMatch(captured[0].text, /client@example\.test/iu);
});

test('invalid dispatcher and provider configuration fail closed', async () => {
  const repository = new ScriptedRepository();
  assert.throws(
    () => createContactOutboxDispatcher(repository, {
      async send() {
        return { providerMessageId: 'unused' };
      },
    }, { concurrency: 0 }),
    /Invalid contact outbox dispatcher configuration/u,
  );

  const sender = createResendContactNotificationSender(null);
  await assert.rejects(sender.send(event()), (error: unknown) => {
    assert.ok(error instanceof ContactNotificationDeliveryError);
    assert.equal(error.category, 'invalid-configuration');
    return true;
  });

  const configured = createResendContactNotificationSender(
    resendSend(async () => ({
      data: { id: 'must-not-send' },
      error: null,
      headers: null,
    })),
  );
  await assert.rejects(
    configured.send(event({
      idempotencyKey: 'x'.repeat(RESEND_IDEMPOTENCY_MAX_LENGTH + 1),
    })),
    (error: unknown) => {
      assert.ok(error instanceof ContactNotificationDeliveryError);
      assert.equal(error.category, 'invalid-configuration');
      return true;
    },
  );
});
