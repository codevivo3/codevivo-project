import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
  createDiscoveryDraftDefaults,
  validateDiscoveryDraftMutation,
} from '../../src/lib/discovery/draft-contract';

function mutation(overrides: Record<string, unknown> = {}) {
  return {
    answers: createDiscoveryDraftDefaults(),
    baseRevision: 0,
    currentStep: 1,
    editingState: {},
    highestStepReached: 1,
    locale: 'en',
    mutationId: randomUUID(),
    schemaVersion: '2.0',
    ...overrides,
  };
}

test('incomplete canonical answers and bounded editing state are accepted', () => {
  const input = mutation({
    editingState: {
      phoneCountry: 'IT',
      phoneInput: '+39 3',
      preferredStartDate: '25/1',
    },
  });
  const result = validateDiscoveryDraftMutation(input);
  assert.equal(result.answers.firstName, '');
  assert.equal(result.editingState.phoneInput, '+39 3');
  assert.equal(result.editingState.preferredStartDate, '25/1');
  assert.match(result.mutationHash, /^[0-9a-f]{64}$/u);
});

test('canonical mutation hashing is independent of object key order', () => {
  const original = mutation();
  const entries = Object.entries(original.answers).reverse();
  const reordered = { ...original, answers: Object.fromEntries(entries) };
  assert.equal(
    validateDiscoveryDraftMutation(original).mutationHash,
    validateDiscoveryDraftMutation(reordered).mutationHash,
  );
});

test('unknown fields, invalid options, duplicate options, and raw dates are rejected', () => {
  const defaults = createDiscoveryDraftDefaults();
  assert.throws(() =>
    validateDiscoveryDraftMutation(mutation({
      answers: { ...defaults, unexpected: 'value' },
    })),
  );
  assert.throws(() =>
    validateDiscoveryDraftMutation(mutation({
      answers: { ...defaults, projectType: 'not-approved' },
    })),
  );
  assert.throws(() =>
    validateDiscoveryDraftMutation(mutation({
      answers: { ...defaults, targetAudience: ['professionals', 'professionals'] },
    })),
  );
  assert.throws(() =>
    validateDiscoveryDraftMutation(mutation({
      answers: { ...defaults, preferredStartDate: '25/11/2026' },
    })),
  );
});

test('canonical ISO date-only values and mutually exclusive choices are enforced', () => {
  const defaults = createDiscoveryDraftDefaults();
  const valid = validateDiscoveryDraftMutation(mutation({
    answers: { ...defaults, preferredStartDate: '2026-11-25' },
  }));
  assert.equal(valid.answers.preferredStartDate, '2026-11-25');
  assert.throws(() =>
    validateDiscoveryDraftMutation(mutation({
      answers: { ...defaults, phone: '+39 3' },
      editingState: { phoneCountry: 'IT', phoneInput: '+39 3' },
    })),
  );
  assert.throws(() =>
    validateDiscoveryDraftMutation(mutation({
      answers: {
        ...defaults,
        availableMaterials: ['noneAvailable', 'videos'],
      },
    })),
  );
});
