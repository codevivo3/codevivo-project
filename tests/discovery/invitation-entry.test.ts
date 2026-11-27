import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consumeDiscoveryInvitationFragment,
  createDiscoveryInvitationExchangeLifecycle,
  type DiscoveryInvitationEntryState,
} from '../../src/lib/discovery/invitation-entry-core';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function fakeScheduler() {
  const callbacks = new Map<number, () => void>();
  let nextId = 1;
  return {
    callbacks,
    scheduler: {
      clear(handle: ReturnType<typeof setTimeout>) {
        callbacks.delete(handle as unknown as number);
      },
      set(callback: () => void) {
        const id = nextId++;
        callbacks.set(id, callback);
        return id as unknown as ReturnType<typeof setTimeout>;
      },
    },
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

test('consumes the token while immediately removing the fragment', () => {
  const replacements: string[] = [];
  const token = consumeDiscoveryInvitationFragment({
    hash: '#token=v1.test-token',
    pathname: '/it/discovery',
    replaceState: (url) => replacements.push(url),
    search: '?source=test',
  });

  assert.equal(token, 'v1.test-token');
  assert.deepEqual(replacements, ['/it/discovery?source=test']);
  assert.doesNotMatch(replacements[0], /token/u);
});

test('missing and empty token fragments remain unavailable and are removed', async () => {
  for (const hash of ['', '#other=value', '#token=']) {
    const replacements: string[] = [];
    const results: DiscoveryInvitationEntryState[] = [];
    const token = consumeDiscoveryInvitationFragment({
      hash,
      pathname: '/discovery',
      replaceState: (url) => replacements.push(url),
      search: '',
    });
    const lifecycle = createDiscoveryInvitationExchangeLifecycle({
      exchange: async () => 'established',
      onResult: (result) => results.push(result),
      token,
    });

    lifecycle.setup();
    await flushMicrotasks();
    assert.deepEqual(results, ['unavailable']);
    assert.deepEqual(replacements, ['/discovery']);
  }
});

test('Strict Mode cleanup and replay reuse one viable exchange', async () => {
  const scheduler = fakeScheduler();
  const response = deferred<DiscoveryInvitationEntryState>();
  const results: DiscoveryInvitationEntryState[] = [];
  const signals: AbortSignal[] = [];
  let exchanges = 0;
  const lifecycle = createDiscoveryInvitationExchangeLifecycle({
    exchange: async (_token, signal) => {
      exchanges += 1;
      signals.push(signal);
      return response.promise;
    },
    onResult: (result) => results.push(result),
    scheduler: scheduler.scheduler,
    token: 'v1.test-token',
  });

  const firstCleanup = lifecycle.setup();
  firstCleanup();
  const replayCleanup = lifecycle.setup();

  assert.equal(exchanges, 1);
  assert.equal(scheduler.callbacks.size, 0);
  assert.equal(signals[0].aborted, false);

  response.resolve('established');
  await flushMicrotasks();
  assert.deepEqual(results, ['established']);

  replayCleanup();
});

test('malformed credentials produce one unavailable result without retry', async () => {
  const replacements: string[] = [];
  const results: DiscoveryInvitationEntryState[] = [];
  let exchanges = 0;
  const token = consumeDiscoveryInvitationFragment({
    hash: '#token=malformed',
    pathname: '/en/discovery',
    replaceState: (url) => replacements.push(url),
    search: '',
  });
  const lifecycle = createDiscoveryInvitationExchangeLifecycle({
    exchange: async () => {
      exchanges += 1;
      return 'unavailable';
    },
    onResult: (result) => results.push(result),
    token,
  });

  lifecycle.setup();
  await flushMicrotasks();
  assert.equal(exchanges, 1);
  assert.deepEqual(results, ['unavailable']);
  assert.deepEqual(replacements, ['/en/discovery']);
});

test('genuine unmount aborts once without reporting or retrying', async () => {
  const scheduler = fakeScheduler();
  const response = deferred<DiscoveryInvitationEntryState>();
  const results: DiscoveryInvitationEntryState[] = [];
  let signal: AbortSignal | undefined;
  let exchanges = 0;
  const lifecycle = createDiscoveryInvitationExchangeLifecycle({
    exchange: async (_token, requestSignal) => {
      exchanges += 1;
      signal = requestSignal;
      return response.promise;
    },
    onResult: (result) => results.push(result),
    scheduler: scheduler.scheduler,
    token: 'v1.test-token',
  });

  const cleanup = lifecycle.setup();
  cleanup();
  assert.equal(scheduler.callbacks.size, 1);
  scheduler.callbacks.values().next().value?.();
  assert.equal(signal?.aborted, true);

  response.reject(new DOMException('Aborted', 'AbortError'));
  await flushMicrotasks();
  assert.equal(exchanges, 1);
  assert.deepEqual(results, []);
});
