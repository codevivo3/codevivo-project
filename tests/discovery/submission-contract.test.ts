import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createDiscoveryQuestionnaireAnswers } from '../../src/lib/discovery/questionnaire-core';
import {
  DiscoverySubmissionValidationError,
  validateDiscoverySubmission,
} from '../../src/lib/discovery/submission-contract';

function completeAnswers() {
  return {
    ...createDiscoveryQuestionnaireAnswers(),
    firstName: '  Ada  ',
    lastName: ' Lovelace ',
    email: ' ADA@EXAMPLE.COM ',
    phone: '+393331234567',
    existingWebsite: 'example.com',
    businessDescription: '  A sufficiently detailed business description.  ',
    projectType: 'newWebsite',
    projectTypeOther: 'must be excluded',
    preferredStartDate: '2026-11-25',
    finalConfirmation: true,
  };
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    answers: completeAnswers(),
    expectedRevision: 4,
    locale: 'en',
    schemaVersion: '2.0',
    submissionId: randomUUID(),
    ...overrides,
  };
}

test('complete final answers are normalized and hidden conditional values are excluded', () => {
  const result = validateDiscoverySubmission(request());
  assert.equal(result.answers.firstName, '  Ada  ');
  assert.equal(result.answers.email, 'ada@example.com');
  assert.equal(result.answers.phone, '+393331234567');
  assert.equal(result.answers.existingWebsite, 'https://example.com');
  assert.equal(result.answers.preferredStartDate, '2026-11-25');
  assert.equal(result.answers.projectTypeOther, '');
  assert.match(result.payloadHash, /^[0-9a-f]{64}$/u);
});

test('all seven steps and explicit final confirmation are validated', () => {
  const answers = completeAnswers();
  answers.firstName = '';
  answers.businessDescription = 'too short';
  answers.finalConfirmation = false;
  assert.throws(
    () => validateDiscoverySubmission(request({ answers })),
    (error: unknown) => {
      assert.ok(error instanceof DiscoverySubmissionValidationError);
      assert.deepEqual(error.errors, {
        businessDescription: 'minLength',
        finalConfirmation: 'required',
        firstName: 'required',
      });
      return true;
    },
  );
});

test('payload hashes are deterministic and changed payloads produce a different hash', () => {
  const submissionId = randomUUID();
  const first = validateDiscoverySubmission(request({ submissionId }));
  const replay = validateDiscoverySubmission(request({ submissionId }));
  assert.equal(first.payloadHash, replay.payloadHash);
  const changed = validateDiscoverySubmission(request({
    answers: { ...completeAnswers(), firstName: 'Grace' },
    submissionId,
  }));
  assert.notEqual(first.payloadHash, changed.payloadHash);
});

test('unknown fields, malformed identifiers, and invalid answer shapes are rejected', () => {
  assert.throws(() => validateDiscoverySubmission({ ...request(), unexpected: true }));
  assert.throws(() => validateDiscoverySubmission(request({ submissionId: 'invalid' })));
  assert.throws(() => validateDiscoverySubmission(request({
    answers: { ...completeAnswers(), unknownAnswer: 'no' },
  })));
});
