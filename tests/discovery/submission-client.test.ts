import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createDiscoveryDraftPersistenceController } from '../../src/lib/discovery/draft-persistence-core';
import { createDiscoveryQuestionnaireAnswers } from '../../src/lib/discovery/questionnaire-core';
import { createDiscoverySubmissionClientController } from '../../src/lib/discovery/submission-client-core';
import { parseDiscoverySubmissionResponse } from '../../src/components/discovery/useDiscoverySubmission';

const submittedAt = new Date('2026-11-27T10:00:00.000Z');
const confirmation = { reference: 'CV-2026-TEST', revision: 4, submittedAt };

function draft(revision = 3) {
  return {
    answers: createDiscoveryQuestionnaireAnswers(),
    briefId: '00000000-0000-4000-8000-000000000001',
    currentStep: 7 as const,
    editingState: {},
    highestStepReached: 7 as const,
    locale: 'en' as const,
    revision,
    schemaVersion: '2.0',
    updatedAt: new Date('2026-11-27T09:00:00.000Z'),
  };
}

function setup(results: Array<unknown>) {
  const payloads: unknown[] = [];
  const marked: unknown[] = [];
  let index = 0;
  const controller = createDiscoverySubmissionClientController({
    createSubmissionId: () => '00000000-0000-4000-8000-000000000002',
    flush: async () => ({ kind: 'acknowledged', draft: draft() }),
    isOnline: () => true,
    markSubmitted: (value) => marked.push(value),
    transport: {
      async submit(payload) {
        payloads.push(payload);
        const result = results[index++];
        if (result instanceof Error) throw result;
        return result as never;
      },
    },
  });
  return { controller, marked, payloads };
}

test('client validation prevents autosave flushing and submission', async () => {
  let flushes = 0;
  const controller = createDiscoverySubmissionClientController({
    createSubmissionId: () => crypto.randomUUID(),
    flush: async () => { flushes += 1; return { kind: 'acknowledged', draft: draft() }; },
    isOnline: () => true,
    markSubmitted() {},
    transport: { async submit() { throw new Error('must not run'); } },
  });
  await controller.submit({ clientErrors: { finalConfirmation: 'required' }, locale: 'en' });
  assert.equal(controller.getState().status, 'validation-error');
  assert.equal(flushes, 0);
});

test('submission uses the acknowledged answers and revision then becomes read-only', async () => {
  const context = setup([{ kind: 'confirmed', confirmation }]);
  await context.controller.submit({ clientErrors: {}, locale: 'en' });
  assert.equal(context.controller.getState().status, 'confirmed');
  assert.deepEqual(context.marked, [confirmation]);
  assert.deepEqual(context.payloads, [{
    answers: draft().answers,
    expectedRevision: 3,
    locale: 'en',
    schemaVersion: '2.0',
    submissionId: '00000000-0000-4000-8000-000000000002',
  }]);
});

test('ambiguous retries preserve the exact UUID, payload, and expected revision', async () => {
  const context = setup([new Error('lost response'), { kind: 'confirmed', confirmation }]);
  await context.controller.submit({ clientErrors: {}, locale: 'en' });
  assert.equal(context.controller.getState().status, 'ambiguous');
  await context.controller.retry();
  assert.equal(context.controller.getState().status, 'confirmed');
  assert.equal(context.payloads.length, 2);
  assert.deepEqual(context.payloads[1], context.payloads[0]);
});

test('concurrent clicks produce exactly one submission request', async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  const controller = createDiscoverySubmissionClientController({
    createSubmissionId: () => crypto.randomUUID(),
    flush: async () => ({ kind: 'acknowledged', draft: draft() }),
    isOnline: () => true,
    markSubmitted() {},
    transport: {
      async submit() {
        calls += 1;
        await pending;
        return { kind: 'confirmed', confirmation };
      },
    },
  });
  const first = controller.submit({ clientErrors: {}, locale: 'en' });
  const second = controller.submit({ clientErrors: {}, locale: 'en' });
  assert.equal(first, second);
  release();
  await first;
  assert.equal(calls, 1);
});

test('server validation, revision, idempotency, and authorization outcomes remain distinct', async () => {
  for (const [result, status] of [
    [{ kind: 'validation', errors: { email: 'email' } }, 'validation-error'],
    [{ kind: 'conflict', revision: 4 }, 'revision-conflict'],
    [{ kind: 'mutation-conflict' }, 'idempotency-conflict'],
    [{ kind: 'unauthorized' }, 'unavailable'],
  ] as const) {
    const context = setup([result]);
    await context.controller.submit({ clientErrors: {}, locale: 'it' });
    assert.equal(context.controller.getState().status, status);
  }
});

test('both successful and replayed HTTP responses restore authoritative confirmation', async () => {
  for (const status of [200, 201]) {
    const result = await parseDiscoverySubmissionResponse(new Response(JSON.stringify({
      status: 'submitted',
      outcome: status === 200 ? 'replayed' : 'submitted',
      submission: {
        reference: confirmation.reference,
        revision: confirmation.revision,
        submittedAt: confirmation.submittedAt.toISOString(),
      },
    }), { status, headers: { 'content-type': 'application/json' } }));
    assert.equal(result.kind, 'confirmed');
  }
});

test('submitted draft bootstrap restores confirmation and prevents later autosave', async () => {
  let updates = 0;
  const persistence = createDiscoveryDraftPersistenceController({
    createMutationId: () => crypto.randomUUID(),
    transport: {
      async initialize() { throw new Error('not needed'); },
      async load() { return { kind: 'submitted', submission: confirmation }; },
      async update() { updates += 1; return { kind: 'retryable' }; },
    },
  });
  const initial = {
    answers: createDiscoveryQuestionnaireAnswers(),
    currentStep: 1 as const,
    highestStepReached: 1 as const,
    locale: 'en' as const,
    phoneCountry: 'IT' as const,
    phoneInput: '',
  };
  await persistence.start('en', initial);
  assert.equal(persistence.getState().status, 'submitted');
  assert.deepEqual(persistence.getState().submission, confirmation);
  persistence.setWorkingSnapshot({ ...initial, phoneInput: 'changed' }, true);
  assert.equal((await persistence.flushAndWait()).kind, 'unavailable');
  assert.equal(updates, 0);
});

test('submission flush waits for the latest acknowledged draft revision', async () => {
  const initialDraft = draft(1);
  const updatedDraft = {
    ...initialDraft,
    answers: { ...initialDraft.answers, firstName: 'Latest' },
    revision: 2,
  };
  const persistence = createDiscoveryDraftPersistenceController({
    createMutationId: () => crypto.randomUUID(),
    transport: {
      async initialize() { throw new Error('not needed'); },
      async load() { return { kind: 'draft', outcome: 'available', draft: initialDraft }; },
      async update() { return { kind: 'draft', outcome: 'updated', draft: updatedDraft }; },
    },
  });
  const initial = {
    answers: initialDraft.answers,
    currentStep: 7 as const,
    highestStepReached: 7 as const,
    locale: 'en' as const,
    phoneCountry: 'IT' as const,
    phoneInput: '',
  };
  await persistence.start('en', initial);
  persistence.setWorkingSnapshot({ ...initial, answers: updatedDraft.answers });
  const result = await persistence.flushAndWait();
  assert.equal(result.kind, 'acknowledged');
  assert.equal(result.kind === 'acknowledged' ? result.draft.revision : -1, 2);
  assert.equal(
    result.kind === 'acknowledged' ? result.draft.answers.firstName : '',
    'Latest',
  );
});

test('English and Italian expose the same confirmation and recovery states', async () => {
  const [english, italian] = await Promise.all([
    readFile(new URL('../../src/messages/en/discoveryQuestionnaire.json', import.meta.url), 'utf8'),
    readFile(new URL('../../src/messages/it/discoveryQuestionnaire.json', import.meta.url), 'utf8'),
  ]);
  const en = JSON.parse(english).submission as Record<string, unknown>;
  const it = JSON.parse(italian).submission as Record<string, unknown>;
  assert.deepEqual(Object.keys(en).sort(), Object.keys(it).sort());
  assert.deepEqual(
    Object.keys(en.status as object).sort(),
    Object.keys(it.status as object).sort(),
  );
  assert.match(JSON.stringify(en), /Project brief submitted/u);
  assert.match(JSON.stringify(it), /Brief di progetto inviato/u);
});
