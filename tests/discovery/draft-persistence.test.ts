import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createDiscoveryDraftDefaults } from '../../src/lib/discovery/draft-contract';
import {
  createDiscoveryDraftPersistenceController,
  hydrateDiscoveryWorkingSnapshot,
  serializeDiscoveryWorkingSnapshot,
  type DiscoveryDraftMutationPayload,
  type DiscoveryDraftTransport,
  type DiscoveryDraftTransportResult,
  type DiscoveryQuestionnaireWorkingSnapshot,
} from '../../src/lib/discovery/draft-persistence-core';

function working(
  overrides: Partial<DiscoveryQuestionnaireWorkingSnapshot> = {},
): DiscoveryQuestionnaireWorkingSnapshot {
  return {
    answers: createDiscoveryDraftDefaults(),
    currentStep: 1,
    highestStepReached: 1,
    locale: 'en',
    phoneCountry: 'IT',
    phoneInput: '',
    ...overrides,
  };
}

function draft(
  snapshot = working(),
  revision = 0,
): Extract<DiscoveryDraftTransportResult, { kind: 'draft' }>['draft'] {
  const serialized = serializeDiscoveryWorkingSnapshot(snapshot);
  return {
    ...serialized,
    briefId: '00000000-0000-4000-8000-000000000001',
    revision,
    schemaVersion: '2.0',
    updatedAt: new Date('2026-11-25T12:00:00.000Z'),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

function fakeScheduler() {
  const callbacks = new Map<number, () => void>();
  const delays: number[] = [];
  let nextId = 1;
  return {
    callbacks,
    delays,
    scheduler: {
      clear(handle: ReturnType<typeof setTimeout>) {
        callbacks.delete(handle as unknown as number);
      },
      set(callback: () => void, delay: number) {
        const id = nextId++;
        callbacks.set(id, callback);
        delays.push(delay);
        return id as unknown as ReturnType<typeof setTimeout>;
      },
    },
    runNext() {
      const entry = callbacks.entries().next().value as [number, () => void] | undefined;
      assert.ok(entry);
      callbacks.delete(entry[0]);
      entry[1]();
    },
  };
}

function transport(overrides: Partial<DiscoveryDraftTransport> = {}): DiscoveryDraftTransport {
  return {
    initialize: async (locale) => ({ kind: 'draft', outcome: 'created', draft: draft(working({ locale })) }),
    load: async () => ({ kind: 'draft', outcome: 'available', draft: draft() }),
    update: async (payload) => ({
      kind: 'draft',
      outcome: 'updated',
      draft: draft({
        answers: payload.answers,
        currentStep: payload.currentStep,
        highestStepReached: payload.highestStepReached,
        locale: payload.locale,
        phoneCountry: (payload.editingState.phoneCountry ?? 'IT') as 'IT',
        phoneInput: payload.editingState.phoneInput ?? '',
      }, payload.baseRevision + 1),
    }),
    ...overrides,
  };
}

test('existing drafts hydrate once and missing drafts initialize once', async () => {
  let loads = 0;
  let initializations = 0;
  const existing = createDiscoveryDraftPersistenceController({
    createMutationId: () => crypto.randomUUID(),
    transport: transport({
      load: async () => {
        loads += 1;
        return { kind: 'draft', outcome: 'available', draft: draft() };
      },
    }),
  });
  await Promise.all([existing.start('en', working()), existing.start('en', working())]);
  assert.equal(loads, 1);
  assert.equal(existing.getState().status, 'saved');
  assert.equal(existing.getState().hydrationVersion, 1);

  const missing = createDiscoveryDraftPersistenceController({
    createMutationId: () => crypto.randomUUID(),
    transport: transport({
      initialize: async () => {
        initializations += 1;
        return { kind: 'draft', outcome: 'created', draft: draft() };
      },
      load: async () => ({ kind: 'missing' }),
    }),
  });
  await Promise.all([missing.start('en', working()), missing.start('en', working())]);
  assert.equal(initializations, 1);
});

test('incomplete dates and phone text round-trip through bounded editing state', () => {
  const snapshot = working({
    answers: {
      ...createDiscoveryDraftDefaults(),
      desiredCompletionDate: '2026-11-25',
      preferredStartDate: '25/1',
    },
    phoneCountry: 'GB',
    phoneInput: '+44 7',
  });
  const serialized = serializeDiscoveryWorkingSnapshot(snapshot);
  assert.equal(serialized.answers.preferredStartDate, '');
  assert.equal(serialized.answers.desiredCompletionDate, '2026-11-25');
  assert.equal(serialized.editingState.preferredStartDate, '25/1');
  assert.equal(serialized.editingState.phoneInput, '+44 7');
  assert.deepEqual(hydrateDiscoveryWorkingSnapshot(draft(snapshot)), snapshot);
});

test('debounce is single-flight and preserves edits made during an update', async () => {
  const scheduler = fakeScheduler();
  const requests: DiscoveryDraftMutationPayload[] = [];
  const responses = [deferred<DiscoveryDraftTransportResult>(), deferred<DiscoveryDraftTransportResult>()];
  let mutationNumber = 0;
  const controller = createDiscoveryDraftPersistenceController({
    createMutationId: () => `00000000-0000-4000-8000-00000000000${++mutationNumber}`,
    scheduler: scheduler.scheduler,
    transport: transport({
      update: async (payload) => {
        requests.push(payload);
        return responses[requests.length - 1].promise;
      },
    }),
  });
  await controller.start('en', working());
  const first = working({ answers: { ...createDiscoveryDraftDefaults(), firstName: 'First' } });
  controller.setWorkingSnapshot(first);
  assert.equal(controller.getState().status, 'unsaved');
  assert.equal(scheduler.delays.at(-1), 1_000);
  scheduler.runNext();
  assert.equal(requests.length, 1);

  const second = working({ answers: { ...first.answers, firstName: 'Second' } });
  controller.setWorkingSnapshot(second);
  assert.equal(requests.length, 1);
  responses[0].resolve({ kind: 'draft', outcome: 'updated', draft: draft(first, 1) });
  await settle();
  assert.equal(controller.getState().status, 'unsaved');
  scheduler.runNext();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].baseRevision, 1);
  assert.notEqual(requests[1].mutationId, requests[0].mutationId);
  responses[1].resolve({ kind: 'draft', outcome: 'updated', draft: draft(second, 2) });
  await settle();
  assert.equal(controller.getState().status, 'saved');
});

test('ambiguous retries preserve the original mutation while queuing newer edits', async () => {
  const scheduler = fakeScheduler();
  const requests: DiscoveryDraftMutationPayload[] = [];
  const retryResponse = deferred<DiscoveryDraftTransportResult>();
  const queuedResponse = deferred<DiscoveryDraftTransportResult>();
  let attempt = 0;
  const controller = createDiscoveryDraftPersistenceController({
    createMutationId: () => '00000000-0000-4000-8000-000000000010',
    scheduler: scheduler.scheduler,
    transport: transport({
      update: async (payload) => {
        requests.push(structuredClone(payload));
        attempt += 1;
        if (attempt === 1) throw new TypeError('network unavailable');
        return attempt === 2 ? retryResponse.promise : queuedResponse.promise;
      },
    }),
  });
  await controller.start('en', working());
  const first = working({ answers: { ...createDiscoveryDraftDefaults(), firstName: 'First' } });
  controller.setWorkingSnapshot(first);
  scheduler.runNext();
  await settle();
  assert.equal(controller.getState().canRetry, true);
  controller.setWorkingSnapshot(
    working({ answers: { ...first.answers, firstName: 'Queued' }, locale: 'it' }),
  );
  controller.retry();
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1], requests[0]);
  retryResponse.resolve({ kind: 'draft', outcome: 'replayed', draft: draft(first, 1) });
  await settle();
  assert.equal(controller.getState().status, 'unsaved');
  scheduler.runNext();
  assert.equal(requests[2].baseRevision, 1);
  assert.equal(requests[2].locale, 'it');
});

test('offline failures remain retryable without uncontrolled retries', async () => {
  const scheduler = fakeScheduler();
  let online = false;
  let attempts = 0;
  const response = deferred<DiscoveryDraftTransportResult>();
  const controller = createDiscoveryDraftPersistenceController({
    createMutationId: () => '00000000-0000-4000-8000-000000000020',
    isOnline: () => online,
    scheduler: scheduler.scheduler,
    transport: transport({
      update: async () => {
        attempts += 1;
        if (attempts === 1) throw new TypeError('offline');
        return response.promise;
      },
    }),
  });
  await controller.start('en', working());
  const changed = working({ currentStep: 2, highestStepReached: 2 });
  controller.setWorkingSnapshot(changed);
  scheduler.runNext();
  await settle();
  assert.equal(controller.getState().status, 'offline');
  assert.equal(controller.getState().canRetry, true);
  assert.equal(attempts, 1);
  online = true;
  controller.retry();
  assert.equal(attempts, 2);
  response.resolve({ kind: 'draft', outcome: 'updated', draft: draft(changed, 1) });
  await settle();
  assert.equal(controller.getState().status, 'saved');
});

test('reverting an unsent edit to the acknowledged snapshot cancels the save', async () => {
  const scheduler = fakeScheduler();
  let updates = 0;
  const original = working();
  const controller = createDiscoveryDraftPersistenceController({
    createMutationId: () => crypto.randomUUID(),
    scheduler: scheduler.scheduler,
    transport: transport({
      update: async () => {
        updates += 1;
        return { kind: 'draft', outcome: 'updated', draft: draft() };
      },
    }),
  });
  await controller.start('en', original);
  controller.setWorkingSnapshot(
    working({ answers: { ...original.answers, firstName: 'Temporary' } }),
  );
  controller.setWorkingSnapshot(original);
  assert.equal(controller.getState().status, 'saved');
  assert.equal(scheduler.callbacks.size, 0);
  assert.equal(updates, 0);
});

test('conflicts stop writes until explicit discard and mutation conflicts are permanent errors', async () => {
  const scheduler = fakeScheduler();
  let updates = 0;
  const serverDraft = draft(working({ locale: 'it' }), 3);
  const controller = createDiscoveryDraftPersistenceController({
    createMutationId: () => crypto.randomUUID(),
    scheduler: scheduler.scheduler,
    transport: transport({
      update: async () => {
        updates += 1;
        return { kind: 'conflict', draft: serverDraft };
      },
    }),
  });
  await controller.start('en', working());
  controller.setWorkingSnapshot(working({ currentStep: 2, highestStepReached: 2 }));
  scheduler.runNext();
  await settle();
  assert.equal(controller.getState().status, 'conflict');
  controller.setWorkingSnapshot(working({ currentStep: 3, highestStepReached: 3 }), true);
  assert.equal(updates, 1);
  controller.resolveConflict();
  assert.equal(controller.getState().status, 'saved');
  assert.equal(controller.getState().hydration?.locale, 'it');

  const mutationConflict = createDiscoveryDraftPersistenceController({
    createMutationId: () => crypto.randomUUID(),
    scheduler: scheduler.scheduler,
    transport: transport({ update: async () => ({ kind: 'mutation-conflict' }) }),
  });
  await mutationConflict.start('en', working());
  mutationConflict.setWorkingSnapshot(working({ currentStep: 2, highestStepReached: 2 }));
  scheduler.runNext();
  await settle();
  assert.equal(mutationConflict.getState().status, 'error');
  assert.equal(mutationConflict.getState().canRetry, false);
});

test('navigation flushes immediately, authorization stops writes, and disabled mode stays memory-only', async () => {
  const scheduler = fakeScheduler();
  let updates = 0;
  const authorized = createDiscoveryDraftPersistenceController({
    createMutationId: () => crypto.randomUUID(),
    scheduler: scheduler.scheduler,
    transport: transport({
      update: async () => {
        updates += 1;
        return { kind: 'unauthorized' };
      },
    }),
  });
  await authorized.start('en', working());
  authorized.setWorkingSnapshot(working({ currentStep: 2, highestStepReached: 2 }), true);
  assert.equal(scheduler.delays.at(-1), 0);
  scheduler.runNext();
  await settle();
  assert.equal(authorized.getState().status, 'unavailable');
  authorized.setWorkingSnapshot(working({ currentStep: 3, highestStepReached: 3 }), true);
  assert.equal(updates, 1);

  const disabled = createDiscoveryDraftPersistenceController({
    createMutationId: () => crypto.randomUUID(),
    scheduler: scheduler.scheduler,
    transport: transport({ load: async () => ({ kind: 'disabled' }) }),
  });
  await disabled.start('en', working());
  assert.equal(disabled.getState().ready, true);
  assert.equal(disabled.getState().status, 'disabled');
  disabled.setWorkingSnapshot(working({ locale: 'it' }), true);
  assert.equal(updates, 1);
});

test('client integration does not use persistent browser storage', async () => {
  const sources = await Promise.all([
    readFile(new URL('../../src/lib/discovery/draft-persistence-core.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../src/components/discovery/useDiscoveryDraftPersistence.ts', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(sources.join('\n'), /localStorage|sessionStorage|indexedDB/iu);
});

test('default browser timers remain receiver-safe wrappers', async () => {
  const source = await readFile(
    new URL('../../src/lib/discovery/draft-persistence-core.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /clear: \(handle\) => clearTimeout\(handle\)/u);
  assert.match(source, /set: \(callback, delay\) => setTimeout\(callback, delay\)/u);
  assert.doesNotMatch(source, /clear: clearTimeout/u);
  assert.doesNotMatch(source, /set: setTimeout/u);
});
