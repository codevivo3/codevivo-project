import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { neon } from '@neondatabase/serverless';
import {
  createDiscoveryDraftDefaults,
  validateDiscoveryDraftMutation,
} from '../../src/lib/discovery/draft-contract';
import { createDiscoveryDraftRepository } from '../../src/lib/discovery/draft-repository-core';
import { readKeychainSecret } from '../../scripts/discovery-keychain';
import {
  PHASE2_AUTHORIZATION,
  PHASE2_DIRECT_HOST,
  PHASE2_KEYCHAIN_SERVICES,
  PHASE2_POOLED_HOST,
} from '../../scripts/discovery-phase2-validation-core';

const enabled = process.env.DISCOVERY_DRAFT_LIVE_ALLOW === PHASE2_AUTHORIZATION;

function verifyTarget(connectionString: string, role: string, pooled: boolean) {
  const url = new URL(connectionString);
  assert.equal(url.hostname, pooled ? PHASE2_POOLED_HOST : PHASE2_DIRECT_HOST);
  assert.equal(url.pathname, '/neondb');
  assert.equal(decodeURIComponent(url.username), role);
}

test(
  'Discovery draft persistence on validation branch',
  { skip: enabled ? false : 'Set DISCOVERY_DRAFT_LIVE_ALLOW=1 only after migration authorization' },
  async (t) => {
    const adminUrl = readKeychainSecret(PHASE2_KEYCHAIN_SERVICES.admin);
    const runtimeUrl = readKeychainSecret(PHASE2_KEYCHAIN_SERVICES.runtime);
    verifyTarget(adminUrl, 'codevivo_discovery_admin', false);
    verifyTarget(runtimeUrl, 'codevivo_discovery_runtime', true);

    const admin = neon(adminUrl);
    const runtime = neon(runtimeUrl);
    const repository = createDiscoveryDraftRepository(() => runtime);
    const invitationId = randomUUID();
    const sessionId = randomUUID();
    const sessionHash = randomBytes(32);

    await admin`
      INSERT INTO discovery.invitations (
        id, token_hash, client_name, client_email, preferred_locale,
        expires_at, prefill_schema_version, prefill_answers
      ) VALUES (
        ${invitationId}, ${randomBytes(32)}, ${'Draft live fixture'},
        ${`draft-${invitationId}@example.invalid`}, ${'en'},
        now() + interval '14 days', ${'2.0'},
        ${{ firstName: 'Prefilled', companyClient: '' }}::jsonb
      )
    `;
    await runtime`
      INSERT INTO discovery.sessions (
        id, credential_hash, invitation_id, token_generation, expires_at
      ) VALUES (
        ${sessionId}, ${sessionHash}, ${invitationId}, ${1},
        now() + interval '12 hours'
      )
    `;

    try {
      await t.test('runtime permissions remain draft-only and contact-isolated', async () => {
        const [privileges] = await runtime`
          SELECT
            has_column_privilege(
              current_user, 'discovery.project_briefs', 'state', 'UPDATE'
            ) AS state_update,
            has_column_privilege(
              current_user, 'discovery.project_briefs', 'answers', 'UPDATE'
            ) AS answers_update,
            has_schema_privilege(current_user, 'contact', 'USAGE')
              AS contact_usage
        `;
        assert.equal(privileges.state_update, false);
        assert.equal(privileges.answers_update, true);
        assert.equal(privileges.contact_usage, false);
      });

      const initializationResults = await Promise.all([
        repository.initialize({
          briefId: randomUUID(),
          defaultAnswers: createDiscoveryDraftDefaults(),
          locale: 'en',
          retentionDays: 30,
          sessionHash,
        }),
        repository.initialize({
          briefId: randomUUID(),
          defaultAnswers: createDiscoveryDraftDefaults(),
          locale: 'it',
          retentionDays: 30,
          sessionHash,
        }),
      ]);
      assert.deepEqual(
        initializationResults.map((result) => result.outcome).sort(),
        ['available', 'created'],
      );
      const first = initializationResults.find((result) => result.outcome === 'created');
      assert.ok(first);
      assert.equal('draft' in first && first.draft.answers.firstName, 'Prefilled');
      assert.equal('draft' in first && first.draft.answers.companyClient, '');

      await t.test('initialization is idempotent', async () => {
        const replay = await repository.initialize({
          briefId: randomUUID(),
          defaultAnswers: createDiscoveryDraftDefaults(),
          locale: 'it',
          retentionDays: 30,
          sessionHash,
        });
        assert.equal(replay.outcome, 'available');
        assert.equal(
          'draft' in replay && 'draft' in first && replay.draft.briefId,
          'draft' in first ? first.draft.briefId : '',
        );
      });

      const baseAnswers = 'draft' in first ? first.draft.answers : createDiscoveryDraftDefaults();
      const mutations = [
        validateDiscoveryDraftMutation({
          answers: { ...baseAnswers, firstName: 'First writer' },
          baseRevision: 0,
          currentStep: 1,
          editingState: {},
          highestStepReached: 1,
          locale: 'en',
          mutationId: randomUUID(),
          schemaVersion: '2.0',
        }),
        validateDiscoveryDraftMutation({
          answers: { ...baseAnswers, firstName: 'Second writer' },
          baseRevision: 0,
          currentStep: 1,
          editingState: {},
          highestStepReached: 1,
          locale: 'en',
          mutationId: randomUUID(),
          schemaVersion: '2.0',
        }),
      ];

      await t.test('concurrent revisions conflict without overwriting', async () => {
        const results = await Promise.all(
          mutations.map((mutation) => repository.update({ mutation, sessionHash })),
        );
        assert.deepEqual(
          results.map((result) => result.outcome).sort(),
          ['conflict', 'updated'],
        );
        const conflict = results.find((result) => result.outcome === 'conflict');
        assert.equal(conflict && 'draft' in conflict ? conflict.draft.revision : -1, 1);

        const winnerIndex = results.findIndex((result) => result.outcome === 'updated');
        const replay = await repository.update({
          mutation: mutations[winnerIndex],
          sessionHash,
        });
        assert.equal(replay.outcome, 'replayed');

        const winner = mutations[winnerIndex];
        const changedReplay = await repository.update({
          mutation: validateDiscoveryDraftMutation({
            answers: { ...baseAnswers, firstName: 'Changed replay' },
            baseRevision: winner.baseRevision,
            currentStep: winner.currentStep,
            editingState: winner.editingState,
            highestStepReached: winner.highestStepReached,
            locale: winner.locale,
            mutationId: winner.mutationId,
            schemaVersion: winner.schemaVersion,
          }),
          sessionHash,
        });
        assert.equal(changedReplay.outcome, 'mutation-conflict');

        const second = validateDiscoveryDraftMutation({
          answers: { ...baseAnswers, firstName: 'New revision' },
          baseRevision: 1,
          currentStep: 2,
          editingState: {},
          highestStepReached: 2,
          locale: 'it',
          mutationId: randomUUID(),
          schemaVersion: '2.0',
        });
        assert.equal((await repository.update({ mutation: second, sessionHash })).outcome, 'updated');
        assert.equal(
          (await repository.update({ mutation: mutations[winnerIndex], sessionHash })).outcome,
          'conflict',
        );
      });

      await t.test('revocation immediately removes draft access', async () => {
        await admin`
          UPDATE discovery.invitations
          SET revoked_at = now(), revocation_reason = ${'Draft live validation'}
          WHERE id = ${invitationId}
        `;
        assert.equal((await repository.read({ sessionHash })).outcome, 'unauthorized');
      });
    } finally {
      await admin`DELETE FROM discovery.invitations WHERE id = ${invitationId}`;
    }
  },
);
