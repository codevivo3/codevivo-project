import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
  createDiscoveryDraftDefaults,
  DISCOVERY_DRAFT_MAX_PAYLOAD_BYTES,
  type DiscoveryDraftOutcome,
} from '../../src/lib/discovery/draft-contract';
import {
  handleDiscoveryDraftGet,
  handleDiscoveryDraftPost,
  handleDiscoveryDraftPut,
} from '../../src/lib/discovery/draft-handler';
import type { DiscoveryDraftRepository } from '../../src/lib/discovery/draft-repository-core';

const origin = 'https://preview.example';
const sessionHash = Buffer.alloc(32, 7);

function snapshot() {
  return {
    answers: createDiscoveryDraftDefaults(),
    briefId: randomUUID(),
    currentStep: 1 as const,
    editingState: {},
    highestStepReached: 1 as const,
    locale: 'en' as const,
    revision: 0,
    schemaVersion: '2.0',
    updatedAt: new Date('2026-11-25T12:00:00.000Z'),
  };
}

function setup(outcome: DiscoveryDraftOutcome = { outcome: 'available', draft: snapshot() }) {
  const calls = { initialize: 0, read: 0, update: 0, limit: 0, session: 0 };
  const repository: DiscoveryDraftRepository = {
    async initialize() { calls.initialize += 1; return outcome; },
    async read() { calls.read += 1; return outcome; },
    async update() { calls.update += 1; return outcome; },
  };
  return {
    calls,
    dependencies: {
      baseUrl: origin,
      enabled: 'true',
      async getSessionHash() { calls.session += 1; return sessionHash; },
      async limit() { calls.limit += 1; return true; },
      repository,
      retentionDays: '30',
    },
  };
}

function request(method: string, body: unknown, extraHeaders: HeadersInit = {}) {
  return new Request(`${origin}/api/discovery/draft`, {
    method,
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      origin,
      'sec-fetch-site': 'same-origin',
      ...extraHeaders,
    },
  });
}

function mutation() {
  return {
    answers: createDiscoveryDraftDefaults(),
    baseRevision: 0,
    currentStep: 1,
    editingState: {},
    highestStepReached: 1,
    locale: 'en',
    mutationId: randomUUID(),
    schemaVersion: '2.0',
  };
}

test('feature-disabled requests do not authenticate, rate limit, or access the repository', async () => {
  const context = setup();
  context.dependencies.enabled = 'false';
  const response = await handleDiscoveryDraftPost(
    request('POST', { locale: 'en' }),
    context.dependencies,
  );
  assert.equal(response.status, 503);
  assert.deepEqual(context.calls, { initialize: 0, read: 0, update: 0, limit: 0, session: 0 });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('GET is authorized and read-only', async () => {
  const context = setup();
  const response = await handleDiscoveryDraftGet(context.dependencies);
  assert.equal(response.status, 200);
  assert.equal(context.calls.read, 1);
  assert.equal(context.calls.initialize, 0);
  assert.equal(context.calls.update, 0);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
});

test('GET restores authoritative submitted confirmation without questionnaire contents', async () => {
  const context = setup({
    outcome: 'submitted',
    submission: {
      reference: 'CV-2026-TEST',
      revision: 8,
      submittedAt: new Date('2026-11-27T10:00:00.000Z'),
    },
  });
  const response = await handleDiscoveryDraftGet(context.dependencies);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 'submitted',
    submission: {
      reference: 'CV-2026-TEST',
      revision: 8,
      submittedAt: '2026-11-27T10:00:00.000Z',
    },
  });
});

test('POST initializes once and PUT maps stale revisions to conflict', async () => {
  const created = setup({ outcome: 'created', draft: snapshot() });
  const createResponse = await handleDiscoveryDraftPost(
    request('POST', { locale: 'en' }),
    created.dependencies,
  );
  assert.equal(createResponse.status, 201);
  assert.equal(created.calls.initialize, 1);

  const conflict = setup({ outcome: 'conflict', draft: { ...snapshot(), revision: 2 } });
  const updateResponse = await handleDiscoveryDraftPut(
    request('PUT', mutation()),
    conflict.dependencies,
  );
  assert.equal(updateResponse.status, 409);
  assert.equal((await updateResponse.json()).draft.revision, 2);
});

test('origin, limiter, content type, and payload size fail closed before persistence', async () => {
  const wrongOrigin = setup();
  const forbidden = await handleDiscoveryDraftPut(
    new Request(`${origin}/api/discovery/draft`, {
      method: 'PUT',
      body: JSON.stringify(mutation()),
      headers: { 'content-type': 'application/json', origin: 'https://evil.invalid' },
    }),
    wrongOrigin.dependencies,
  );
  assert.equal(forbidden.status, 403);
  assert.equal(wrongOrigin.calls.update, 0);

  const limited = setup();
  limited.dependencies.limit = async () => false;
  const rateLimited = await handleDiscoveryDraftPut(
    request('PUT', mutation()),
    limited.dependencies,
  );
  assert.equal(rateLimited.status, 429);
  assert.equal(limited.calls.update, 0);

  const oversized = setup();
  const tooLarge = await handleDiscoveryDraftPut(
    request('PUT', mutation(), {
      'content-length': String(DISCOVERY_DRAFT_MAX_PAYLOAD_BYTES + 1),
    }),
    oversized.dependencies,
  );
  assert.equal(tooLarge.status, 413);
  assert.equal(oversized.calls.update, 0);
});

test('replayed and mutation-conflict outcomes remain distinct and sanitized', async () => {
  const replay = setup({ outcome: 'replayed', draft: { ...snapshot(), revision: 1 } });
  assert.equal(
    (await handleDiscoveryDraftPut(request('PUT', mutation()), replay.dependencies)).status,
    200,
  );
  const mismatch = setup({ outcome: 'mutation-conflict' });
  const response = await handleDiscoveryDraftPut(
    request('PUT', mutation()),
    mismatch.dependencies,
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { status: 'mutation-conflict' });
});
