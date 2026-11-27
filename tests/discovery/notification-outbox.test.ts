import assert from 'node:assert/strict';
import test from 'node:test';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import type { Resend } from 'resend';
import { createResendDiscoveryNotificationSender } from '../../src/lib/discovery/notification-email-core';
import {
  createDiscoveryOutboxDispatcher,
  DiscoveryNotificationDeliveryError,
  DiscoveryOutboxDispatchError,
  discoveryOutboxBackoffMs,
  type ClaimedDiscoveryNotification,
  type DiscoveryNotificationFailureCategory,
  type DiscoveryNotificationSender,
  type DiscoveryOutboxRepository,
} from '../../src/lib/discovery/notification-outbox-core';
import { createDiscoveryNotificationOutboxRepository } from '../../src/lib/discovery/notification-outbox-repository-core';

type ResendSend = Resend['emails']['send'];

const event = (
  overrides: Partial<ClaimedDiscoveryNotification> = {},
): ClaimedDiscoveryNotification => ({
  attemptCount: 1,
  briefId: '10000000-0000-4000-8000-000000000001',
  clientEmail: 'client@example.test',
  clientName: 'Example Client',
  eventId: '20000000-0000-4000-8000-000000000002',
  eventType: 'project_brief_submitted',
  idempotencyKey: 'discovery.project_brief_submitted:10000000-0000-4000-8000-000000000001',
  locale: 'en',
  submissionReference: 'CV-2026-TEST',
  submittedAt: new Date('2026-11-27T12:00:00.000Z'),
  ...overrides,
});

class Repository implements DiscoveryOutboxRepository {
  claims: ClaimedDiscoveryNotification[] = [];
  delivered: Array<{ attemptCount: number; eventId: string; providerMessageId: string }> = [];
  failed: Array<{
    attemptCount: number;
    errorCode: DiscoveryNotificationFailureCategory;
    eventId: string;
    nextAttemptAt: Date | null;
  }> = [];
  deliveredResult = true;
  failedResult = true;
  throwOnClaim = false;
  throwOnDelivered = false;

  async claimEligible() {
    if (this.throwOnClaim) throw new Error('private database diagnostics');
    return this.claims;
  }
  async markDelivered(input: (typeof this.delivered)[number]) {
    if (this.throwOnDelivered) throw new Error('private database diagnostics');
    this.delivered.push(input);
    return this.deliveredResult;
  }
  async markFailed(input: (typeof this.failed)[number]) {
    this.failed.push(input);
    return this.failedResult;
  }
}

function resendSend(
  operation: (payload: Record<string, unknown>, options: { idempotencyKey?: string }) => Promise<unknown>,
): ResendSend {
  return operation as unknown as ResendSend;
}

test('provider request is stable, minimal, and excludes questionnaire content', async () => {
  const requests: Array<{ payload: Record<string, unknown>; key?: string }> = [];
  const sender = createResendDiscoveryNotificationSender(
    resendSend(async (payload, options) => {
      requests.push({ payload, key: options.idempotencyKey });
      return { data: { id: 'provider-id' }, error: null, headers: null };
    }),
    'hello@example.test',
  );

  await sender.send(event());
  await sender.send(event({ attemptCount: 2 }));

  assert.equal(requests.length, 2);
  assert.equal(requests[0].key, event().idempotencyKey);
  assert.deepEqual(requests[0], requests[1]);
  assert.deepEqual(requests[0].payload.to, ['hello@example.test']);
  const serialized = JSON.stringify(requests[0].payload);
  assert.match(serialized, /CV-2026-TEST/u);
  assert.doesNotMatch(serialized, /answers|questionnaire content|budget|projectGoals/iu);
});

test('missing provider configuration fails before delivery', async () => {
  for (const [send, recipient] of [
    [null, 'hello@example.test'],
    [resendSend(async () => ({ data: { id: 'unused' }, error: null })), undefined],
  ] as const) {
    const sender = createResendDiscoveryNotificationSender(send, recipient);
    await assert.rejects(sender.send(event()), (error: unknown) => {
      assert.ok(error instanceof DiscoveryNotificationDeliveryError);
      assert.equal(error.category, 'invalid-configuration');
      return true;
    });
  }
});

test('provider errors are classified for safe retry or terminal handling', async () => {
  const cases = [
    ['concurrent_idempotent_requests', 409, 'provider-idempotency-in-progress'],
    ['invalid_idempotent_request', 409, 'provider-idempotency-conflict'],
    ['rate_limit_exceeded', 429, 'provider-rate-limit'],
    ['internal_server_error', 500, 'temporary-provider-failure'],
    ['invalid_api_key', 401, 'invalid-configuration'],
    ['validation_error', 422, 'permanent-provider-failure'],
  ] as const;
  for (const [name, statusCode, expected] of cases) {
    const sender = createResendDiscoveryNotificationSender(
      resendSend(async () => ({
        data: null,
        error: { message: 'sanitized provider fixture', name, statusCode },
        headers: null,
      })),
      'hello@example.test',
    );
    await assert.rejects(sender.send(event()), (error: unknown) => {
      assert.ok(error instanceof DiscoveryNotificationDeliveryError);
      assert.equal(error.category, expected);
      return true;
    });
  }
});

test('missing provider identity and ambiguous transport outcomes remain retry-safe', async () => {
  const missingIdentity = createResendDiscoveryNotificationSender(
    resendSend(async () => ({ data: null, error: null, headers: null })),
    'hello@example.test',
  );
  await assert.rejects(missingIdentity.send(event()), (error: unknown) => {
    assert.ok(error instanceof DiscoveryNotificationDeliveryError);
    assert.equal(error.category, 'ambiguous-provider-outcome');
    return true;
  });

  const timeout = createResendDiscoveryNotificationSender(
    resendSend(async () => { throw Object.assign(new Error('private timeout'), { code: 'ETIMEDOUT' }); }),
    'hello@example.test',
  );
  await assert.rejects(timeout.send(event()), (error: unknown) => {
    assert.ok(error instanceof DiscoveryNotificationDeliveryError);
    assert.equal(error.category, 'ambiguous-provider-outcome');
    return true;
  });
});

test('successful dispatch durably finalizes the claimed event', async () => {
  const repository = new Repository();
  repository.claims = [event()];
  const summary = await createDiscoveryOutboxDispatcher(repository, {
    async send() { return { providerMessageId: 'provider-success' }; },
  }).dispatchBatch();
  assert.equal(summary.sent, 1);
  assert.deepEqual(repository.delivered, [{
    attemptCount: 1,
    eventId: event().eventId,
    providerMessageId: 'provider-success',
  }]);
});

test('temporary and ambiguous outcomes retry with stable bounded backoff', async () => {
  for (const category of [
    'temporary-provider-failure',
    'provider-rate-limit',
    'provider-idempotency-in-progress',
    'ambiguous-provider-outcome',
  ] as const) {
    const repository = new Repository();
    repository.claims = [event({ attemptCount: 2 })];
    const now = new Date('2026-11-27T12:00:00.000Z');
    const sender: DiscoveryNotificationSender = {
      async send() { throw new DiscoveryNotificationDeliveryError(category); },
    };
    const summary = await createDiscoveryOutboxDispatcher(repository, sender, {
      now: () => now,
    }).dispatchBatch();
    assert.equal(summary.retriesScheduled, 1);
    assert.equal(repository.failed[0].errorCode, category);
    assert.equal(
      repository.failed[0].nextAttemptAt?.toISOString(),
      new Date(now.getTime() + 120_000).toISOString(),
    );
  }
  assert.equal(discoveryOutboxBackoffMs(30), 60 * 60 * 1_000);
});

test('permanent failures and exhausted retries become terminal', async () => {
  for (const [category, attemptCount] of [
    ['invalid-configuration', 1],
    ['permanent-provider-failure', 1],
    ['provider-idempotency-conflict', 1],
    ['temporary-provider-failure', 5],
  ] as const) {
    const repository = new Repository();
    repository.claims = [event({ attemptCount })];
    const summary = await createDiscoveryOutboxDispatcher(repository, {
      async send() { throw new DiscoveryNotificationDeliveryError(category); },
    }).dispatchBatch();
    assert.equal(summary.permanentFailures, 1);
    assert.equal(repository.failed[0].nextAttemptAt, null);
  }
});

test('concurrency is bounded and each claim is processed once', async () => {
  const repository = new Repository();
  repository.claims = Array.from({ length: 8 }, (_, index) => event({
    eventId: `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  }));
  let active = 0;
  let maximum = 0;
  const summary = await createDiscoveryOutboxDispatcher(repository, {
    async send(value) {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;
      return { providerMessageId: `provider-${value.eventId}` };
    },
  }).dispatchBatch();
  assert.equal(summary.sent, 8);
  assert.equal(maximum, 3);
  assert.equal(new Set(repository.delivered.map((value) => value.eventId)).size, 8);
});

test('database failures are sanitized and preserve retry safety', async () => {
  const claimFailure = new Repository();
  claimFailure.throwOnClaim = true;
  await assert.rejects(
    createDiscoveryOutboxDispatcher(claimFailure, { async send() { return { providerMessageId: 'unused' }; } }).dispatchBatch(),
    DiscoveryOutboxDispatchError,
  );

  const finalizeFailure = new Repository();
  finalizeFailure.claims = [event()];
  finalizeFailure.throwOnDelivered = true;
  const summary = await createDiscoveryOutboxDispatcher(finalizeFailure, {
    async send() { return { providerMessageId: 'provider-accepted' }; },
  }).dispatchBatch();
  assert.equal(summary.ambiguousOutcomes, 1);
  assert.equal(summary.databaseFailures, 1);
  assert.equal(finalizeFailure.failed.length, 0);
});

test('repository uses only secured claim and fenced finalization functions', async () => {
  const queries: string[] = [];
  let call = 0;
  const database = (async (strings: TemplateStringsArray) => {
    queries.push(strings.join('?'));
    call += 1;
    if (call === 1) return [{
      ...event(),
      attempt_count: 1,
      brief_id: event().briefId,
      client_email: event().clientEmail,
      client_name: event().clientName,
      event_id: event().eventId,
      event_type: event().eventType,
      idempotency_key: event().idempotencyKey,
      locale: event().locale,
      submission_reference: event().submissionReference,
      submitted_at: event().submittedAt,
    }];
    return [{ updated: true }];
  }) as unknown as NeonQueryFunction<false, false>;
  const repository = createDiscoveryNotificationOutboxRepository(() => database);
  const [claimed] = await repository.claimEligible({
    batchSize: 20,
    leaseExpiredBefore: new Date(),
    maxAttempts: 5,
  });
  await repository.markDelivered({ attemptCount: 1, eventId: claimed.eventId, providerMessageId: 'provider' });
  await repository.markFailed({ attemptCount: 1, errorCode: 'temporary-provider-failure', eventId: claimed.eventId, nextAttemptAt: new Date() });
  assert.match(queries[0], /discovery\.claim_notification_events/u);
  assert.match(queries[1], /discovery\.mark_notification_delivered/u);
  assert.match(queries[2], /discovery\.mark_notification_failed/u);
  assert.doesNotMatch(queries.join('\n'), /UPDATE\s+discovery\./iu);
});
