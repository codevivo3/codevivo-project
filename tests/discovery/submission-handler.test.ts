import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createDiscoveryQuestionnaireAnswers } from '../../src/lib/discovery/questionnaire-core';
import { handleDiscoverySubmission } from '../../src/lib/discovery/submission-handler';
import type {
  DiscoverySubmissionOutcome,
  DiscoverySubmissionRepository,
} from '../../src/lib/discovery/submission-repository-core';

const origin = 'https://preview.example';
const sessionHash = Buffer.alloc(32, 5);

function body() {
  return {
    answers: {
      ...createDiscoveryQuestionnaireAnswers(),
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      businessDescription: 'A sufficiently detailed business description.',
      projectType: 'newWebsite',
      finalConfirmation: true,
    },
    expectedRevision: 2,
    locale: 'en',
    schemaVersion: '2.0',
    submissionId: randomUUID(),
  };
}

function request(value: unknown = body(), headers: HeadersInit = {}) {
  return new Request(`${origin}/api/discovery/submission`, {
    method: 'POST',
    body: JSON.stringify(value),
    headers: {
      'content-type': 'application/json',
      origin,
      'sec-fetch-site': 'same-origin',
      ...headers,
    },
  });
}

function setup(outcome: DiscoverySubmissionOutcome) {
  const calls = { limit: 0, session: 0, submit: 0 };
  const repository: DiscoverySubmissionRepository = {
    async submit() { calls.submit += 1; return outcome; },
  };
  return {
    calls,
    dependencies: {
      baseUrl: origin,
      enabled: 'true',
      generateOutboxId: () => '00000000-0000-4000-8000-000000000010',
      generateSubmissionReference: () => 'CV-2026-TEST',
      async getSessionHash(): Promise<Buffer | null> { calls.session += 1; return sessionHash; },
      async limit() { calls.limit += 1; return true; },
      repository,
    },
  };
}

test('successful and idempotently replayed submissions return sanitized results', async () => {
  const submission = {
    briefId: randomUUID(),
    reference: 'CV-2026-TEST',
    revision: 3,
    submittedAt: new Date('2026-11-27T10:00:00.000Z'),
  };
  for (const [outcome, status] of [['submitted', 201], ['replayed', 200]] as const) {
    const context = setup({ outcome, submission });
    const response = await handleDiscoverySubmission(request(), context.dependencies);
    assert.equal(response.status, status);
    assert.equal(context.calls.submit, 1);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      status: 'submitted',
      outcome,
      submission: {
        reference: submission.reference,
        revision: 3,
        submittedAt: '2026-11-27T10:00:00.000Z',
      },
    });
  }
});

test('validation failures are structured and never access the repository', async () => {
  const context = setup({ outcome: 'unauthorized' });
  const invalid = body();
  invalid.answers.finalConfirmation = false;
  const response = await handleDiscoverySubmission(request(invalid), context.dependencies);
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    status: 'invalid',
    errors: { finalConfirmation: 'required' },
  });
  assert.equal(context.calls.submit, 0);
});

test('malformed and oversized payloads are rejected before persistence', async () => {
  const malformed = setup({ outcome: 'unauthorized' });
  const malformedResponse = await handleDiscoverySubmission(
    request({ ...body(), unexpected: true }),
    malformed.dependencies,
  );
  assert.equal(malformedResponse.status, 400);
  assert.equal(malformed.calls.submit, 0);

  const oversized = setup({ outcome: 'unauthorized' });
  const oversizedResponse = await handleDiscoverySubmission(
    request(body(), { 'content-length': String(128 * 1024 + 1) }),
    oversized.dependencies,
  );
  assert.equal(oversizedResponse.status, 413);
  assert.equal(oversized.calls.submit, 0);
});

test('authorization, origin, activation, and rate limiting fail before persistence', async () => {
  const disabled = setup({ outcome: 'unauthorized' });
  disabled.dependencies.enabled = 'false';
  assert.equal((await handleDiscoverySubmission(request(), disabled.dependencies)).status, 503);
  assert.deepEqual(disabled.calls, { limit: 0, session: 0, submit: 0 });

  const wrongOrigin = setup({ outcome: 'unauthorized' });
  assert.equal((await handleDiscoverySubmission(request(body(), { origin: 'https://evil.invalid' }), wrongOrigin.dependencies)).status, 403);
  assert.equal(wrongOrigin.calls.submit, 0);

  const noSession = setup({ outcome: 'unauthorized' });
  noSession.dependencies.getSessionHash = async () => null;
  assert.equal((await handleDiscoverySubmission(request(), noSession.dependencies)).status, 401);

  const limited = setup({ outcome: 'unauthorized' });
  limited.dependencies.limit = async () => false;
  assert.equal((await handleDiscoverySubmission(request(), limited.dependencies)).status, 429);
  assert.equal(limited.calls.submit, 0);
});

test('stale revision, changed-payload replay, missing, and repository failure stay sanitized', async () => {
  for (const [outcome, expected] of [
    [{ outcome: 'conflict', revision: 4 }, { status: 'conflict', revision: 4 }],
    [{ outcome: 'mutation-conflict' }, { status: 'mutation-conflict' }],
    [{ outcome: 'missing' }, { status: 'missing' }],
  ] as const) {
    const response = await handleDiscoverySubmission(request(), setup(outcome).dependencies);
    assert.equal(response.status, outcome.outcome === 'missing' ? 404 : 409);
    assert.deepEqual(await response.json(), expected);
  }

  const context = setup({ outcome: 'unauthorized' });
  context.dependencies.repository = { async submit() { throw new Error('sensitive'); } };
  const response = await handleDiscoverySubmission(request(), context.dependencies);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'unavailable' });
});
