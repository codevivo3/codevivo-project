import assert from 'node:assert/strict';
import test from 'node:test';
import { createDiscoveryQuestionnaireAnswers } from '../../src/lib/discovery/questionnaire-core';
import { createDiscoverySubmissionRepository } from '../../src/lib/discovery/submission-repository-core';

function database(row: Record<string, unknown>, captured: string[]) {
  const query = async (strings: TemplateStringsArray) => {
    captured.push(strings.join('?'));
    return [row];
  };
  return query as never;
}

const input = {
  outboxId: '00000000-0000-4000-8000-000000000001',
  sessionHash: Buffer.alloc(32, 1),
  submission: {
    answers: createDiscoveryQuestionnaireAnswers(),
    expectedRevision: 3,
    locale: 'en' as const,
    payloadHash: '11'.repeat(32),
    schemaVersion: '2.0' as const,
    submissionId: '00000000-0000-4000-8000-000000000002',
  },
  submissionReference: 'CV-2026-TEST',
};

test('repository delegates the atomic operation to the secured database function', async () => {
  const captured: string[] = [];
  const repository = createDiscoverySubmissionRepository(() => database({
    outcome: 'submitted',
    brief_id: '00000000-0000-4000-8000-000000000003',
    revision: '4',
    submission_reference: 'CV-2026-TEST',
    submitted_at: '2026-11-27T10:00:00.000Z',
  }, captured));
  const result = await repository.submit(input);
  assert.equal(result.outcome, 'submitted');
  assert.equal('submission' in result ? result.submission.revision : -1, 4);
  assert.equal(captured.length, 1);
  assert.match(captured[0], /discovery\.submit_project_brief/u);
  assert.match(captured[0], /decode\(/u);
  assert.doesNotMatch(captured[0], /UPDATE\s+discovery\./iu);
  assert.doesNotMatch(captured[0], /INSERT\s+INTO\s+discovery\./iu);
});

test('repository maps replay, conflict, idempotency mismatch, and authorization outcomes', async () => {
  for (const [row, expected] of [
    [{ outcome: 'replayed', brief_id: randomId(4), revision: 4, submission_reference: 'CV-1', submitted_at: new Date() }, 'replayed'],
    [{ outcome: 'conflict', revision: 5 }, 'conflict'],
    [{ outcome: 'mutation_conflict' }, 'mutation-conflict'],
    [{ outcome: 'unauthorized' }, 'unauthorized'],
  ] as const) {
    const repository = createDiscoverySubmissionRepository(() => database(row, []));
    assert.equal((await repository.submit(input)).outcome, expected);
  }
});

function randomId(suffix: number) {
  return `00000000-0000-4000-8000-00000000000${suffix}`;
}
