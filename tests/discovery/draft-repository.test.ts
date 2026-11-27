import assert from 'node:assert/strict';
import test from 'node:test';
import { createDiscoveryDraftDefaults } from '../../src/lib/discovery/draft-contract';
import { createDiscoveryDraftRepository } from '../../src/lib/discovery/draft-repository-core';

function fakeDatabase(row: Record<string, unknown>, captured: string[]) {
  const query = async (strings: TemplateStringsArray) => {
    captured.push(strings.join('?'));
    return [row];
  };
  query.transaction = (queries: Promise<unknown>[]) => Promise.all(queries);
  return query as never;
}

function transactionalDatabase(
  results: Record<string, unknown>[][],
  captured: string[],
) {
  let index = 0;
  const query = async (strings: TemplateStringsArray) => {
    captured.push(strings.join('?'));
    return results[index++] ?? [];
  };
  query.transaction = (queries: Promise<unknown>[]) => Promise.all(queries);
  return query as never;
}

test('repository SQL rechecks session and invitation validity in every operation', async () => {
  const captured: string[] = [];
  const repository = createDiscoveryDraftRepository(() => fakeDatabase({ outcome: 'unauthorized' }, captured));
  await repository.read({ sessionHash: Buffer.alloc(32) });
  await repository.initialize({
    briefId: '00000000-0000-4000-8000-000000000001',
    defaultAnswers: {} as never,
    locale: 'en',
    retentionDays: 30,
    sessionHash: Buffer.alloc(32),
  });
  await repository.update({
    mutation: {
      answers: {} as never,
      baseRevision: 0,
      currentStep: 1,
      editingState: {},
      highestStepReached: 1,
      locale: 'en',
      mutationHash: '00'.repeat(32),
      mutationId: '00000000-0000-4000-8000-000000000002',
      schemaVersion: '2.0',
    },
    sessionHash: Buffer.alloc(32),
  });
  assert.equal(captured.length, 5);
  for (const sql of captured) {
    assert.match(sql, /sessions\.invalidated_at IS NULL/u);
    assert.match(sql, /sessions\.expires_at > now\(\)/u);
    assert.match(sql, /invitations\.revoked_at IS NULL/u);
    assert.match(sql, /invitations\.expires_at > now\(\)/u);
    assert.match(sql, /sessions\.token_generation = invitations\.token_generation/u);
  }
  assert.match(captured[1], /ON CONFLICT \(invitation_id\) DO NOTHING/u);
  assert.match(captured[1], /prefill_answers/u);
});

test('update SQL distinguishes latest replay from delayed stale mutation', async () => {
  const captured: string[] = [];
  const current = {
    answers: createDiscoveryDraftDefaults(),
    authorized: true,
    brief_id: '00000000-0000-4000-8000-000000000004',
    current_step: 2,
    editing_state: {},
    highest_step_reached: 2,
    last_mutation_hash: '22'.repeat(32),
    last_mutation_id: '00000000-0000-4000-8000-000000000004',
    locale: 'it',
    revision: 2,
    schema_version: '2.0',
    state: 'draft',
    updated_at: '2026-11-25T12:00:00.000Z',
  };
  const repository = createDiscoveryDraftRepository(() => transactionalDatabase([
    [{ invitation_id: '00000000-0000-4000-8000-000000000005' }],
    [],
    [current],
  ], captured));
  const result = await repository.update({
    mutation: {
      answers: {} as never,
      baseRevision: 1,
      currentStep: 2,
      editingState: {},
      highestStepReached: 2,
      locale: 'it',
      mutationHash: '11'.repeat(32),
      mutationId: '00000000-0000-4000-8000-000000000003',
      schemaVersion: '2.0',
    },
    sessionHash: Buffer.alloc(32),
  });
  assert.equal(result.outcome, 'conflict');
  assert.equal('draft' in result ? result.draft.revision : -1, 2);
  assert.equal(captured.length, 3);
  assert.match(captured[0], /FOR UPDATE OF invitations/u);
  assert.match(captured[1], /project_briefs\.revision =/u);
  assert.match(captured[1], /last_mutation_id IS DISTINCT FROM/u);
  assert.match(captured[2], /last_mutation_hash/u);
  assert.doesNotMatch(captured.join('\n'), /before_update/u);
});

test('update classifies replay and mutation conflict from the latest locked snapshot', async () => {
  const mutationId = '00000000-0000-4000-8000-000000000006';
  const mutationHash = '33'.repeat(32);
  const baseRow = {
    answers: createDiscoveryDraftDefaults(),
    authorized: true,
    brief_id: '00000000-0000-4000-8000-000000000007',
    current_step: 2,
    editing_state: {},
    highest_step_reached: 2,
    last_mutation_id: mutationId,
    locale: 'en',
    revision: 1,
    schema_version: '2.0',
    state: 'draft',
    updated_at: '2026-11-25T12:00:00.000Z',
  };
  const mutation = {
    answers: {} as never,
    baseRevision: 0,
    currentStep: 2 as const,
    editingState: {},
    highestStepReached: 2 as const,
    locale: 'en' as const,
    mutationHash,
    mutationId,
    schemaVersion: '2.0' as const,
  };
  for (const [hash, expected] of [
    [mutationHash, 'replayed'],
    ['44'.repeat(32), 'mutation-conflict'],
  ] as const) {
    const repository = createDiscoveryDraftRepository(() => transactionalDatabase([
      [{ invitation_id: '00000000-0000-4000-8000-000000000008' }],
      [],
      [{ ...baseRow, last_mutation_hash: hash }],
    ], []));
    assert.equal(
      (await repository.update({ mutation, sessionHash: Buffer.alloc(32) })).outcome,
      expected,
    );
  }
});

test('successful update returns the mapped updated snapshot', async () => {
  const updatedRow = {
    answers: createDiscoveryDraftDefaults(),
    brief_id: '00000000-0000-4000-8000-000000000009',
    current_step: 2,
    editing_state: {},
    highest_step_reached: 2,
    locale: 'it',
    revision: 1,
    schema_version: '2.0',
    updated_at: '2026-11-25T12:00:00.000Z',
  };
  const repository = createDiscoveryDraftRepository(() => transactionalDatabase([
    [{ invitation_id: '00000000-0000-4000-8000-000000000010' }],
    [updatedRow],
    [{
      ...updatedRow,
      authorized: true,
      last_mutation_hash: '55'.repeat(32),
      last_mutation_id: '00000000-0000-4000-8000-000000000011',
      state: 'draft',
    }],
  ], []));
  const result = await repository.update({
    mutation: {
      answers: createDiscoveryDraftDefaults(),
      baseRevision: 0,
      currentStep: 2,
      editingState: {},
      highestStepReached: 2,
      locale: 'it',
      mutationHash: '55'.repeat(32),
      mutationId: '00000000-0000-4000-8000-000000000011',
      schemaVersion: '2.0',
    },
    sessionHash: Buffer.alloc(32),
  });
  assert.equal(result.outcome, 'updated');
  assert.equal('draft' in result ? result.draft.briefId : '', updatedRow.brief_id);
  assert.equal('draft' in result ? result.draft.revision : -1, 1);
});

test('read returns authoritative submitted metadata for refresh restoration', async () => {
  const captured: string[] = [];
  const repository = createDiscoveryDraftRepository(() => fakeDatabase({
    outcome: 'submitted',
    revision: '6',
    submission_reference: 'CV-2026-RESTORED',
    submitted_at: '2026-11-27T10:00:00.000Z',
  }, captured));
  const result = await repository.read({ sessionHash: Buffer.alloc(32) });
  assert.equal(result.outcome, 'submitted');
  assert.equal(
    result.outcome === 'submitted' ? result.submission.reference : '',
    'CV-2026-RESTORED',
  );
  assert.match(captured[0], /submission_reference/u);
  assert.match(captured[0], /submitted_at/u);
});
