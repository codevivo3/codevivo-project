import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { neon } from '@neondatabase/serverless';
import { readKeychainSecret } from '../../scripts/discovery-keychain';
import { retrieveSubmittedBrief } from '../../scripts/discovery-admin-retrieval';
import {
  PHASE2_AUTHORIZATION,
  PHASE2_DIRECT_HOST,
  PHASE2_KEYCHAIN_SERVICES,
  PHASE2_POOLED_HOST,
} from '../../scripts/discovery-phase2-validation-core';
import { createDiscoveryDraftDefaults } from '../../src/lib/discovery/draft-contract';
import { createDiscoveryDraftRepository } from '../../src/lib/discovery/draft-repository-core';
import { createDiscoveryNotificationOutboxRepository } from '../../src/lib/discovery/notification-outbox-repository-core';
import { validateDiscoverySubmission } from '../../src/lib/discovery/submission-contract';
import { createDiscoverySubmissionRepository } from '../../src/lib/discovery/submission-repository-core';

const enabled = process.env.DISCOVERY_SUBMISSION_LIVE_ALLOW === PHASE2_AUTHORIZATION;

function verifyTarget(connectionString: string, role: string, pooled: boolean) {
  const url = new URL(connectionString);
  assert.equal(url.hostname, pooled ? PHASE2_POOLED_HOST : PHASE2_DIRECT_HOST);
  assert.equal(url.pathname, '/neondb');
  assert.equal(decodeURIComponent(url.username), role);
}

function completeAnswers() {
  return {
    ...createDiscoveryDraftDefaults(),
    firstName: 'Submission',
    lastName: 'Fixture',
    email: 'submission@example.invalid',
    businessDescription: 'A deterministic live submission fixture description.',
    projectType: 'newWebsite',
    finalConfirmation: true,
  };
}

test(
  'Discovery final submission on an explicitly authorized disposable target',
  { skip: enabled ? false : 'Requires a separately authorized guarded database gate' },
  async () => {
    const adminUrl = readKeychainSecret(PHASE2_KEYCHAIN_SERVICES.admin);
    const runtimeUrl = readKeychainSecret(PHASE2_KEYCHAIN_SERVICES.runtime);
    verifyTarget(adminUrl, 'codevivo_discovery_admin', false);
    verifyTarget(runtimeUrl, 'codevivo_discovery_runtime', true);

    const admin = neon(adminUrl);
    const runtime = neon(runtimeUrl);
    const draftRepository = createDiscoveryDraftRepository(() => runtime);
    const notificationRepository = createDiscoveryNotificationOutboxRepository(
      () => runtime,
    );
    const submissionRepository = createDiscoverySubmissionRepository(() => runtime);
    const invitationId = randomUUID();
    const rollbackInvitationId = randomUUID();
    const expiredInvitationId = randomUUID();
    const sessionHash = randomBytes(32);

    await admin`
      INSERT INTO discovery.invitations (
        id, token_hash, client_name, client_email, preferred_locale, expires_at
      ) VALUES (
        ${invitationId}, ${randomBytes(32)}, ${'Submission live fixture'},
        ${`submission-${invitationId}@example.invalid`}, ${'en'},
        now() + interval '1 day'
      )
    `;
    await runtime`
      INSERT INTO discovery.sessions (
        id, credential_hash, invitation_id, token_generation, expires_at
      ) VALUES (${randomUUID()}, ${sessionHash}, ${invitationId}, 1, now() + interval '12 hours')
    `;

    try {
      const initialized = await draftRepository.initialize({
        briefId: randomUUID(),
        defaultAnswers: createDiscoveryDraftDefaults(),
        locale: 'en',
        retentionDays: 30,
        sessionHash,
      });
      assert.ok('draft' in initialized);
      const submissionId = randomUUID();
      const submission = validateDiscoverySubmission({
        answers: completeAnswers(),
        expectedRevision: initialized.draft.revision,
        locale: 'en',
        schemaVersion: '2.0',
        submissionId,
      });
      const input = {
        outboxId: randomUUID(),
        sessionHash,
        submission,
        submissionReference:
          `CV-2026-${randomBytes(6).toString('hex').toUpperCase()}`,
      };

      const concurrent = await Promise.all([
        submissionRepository.submit(input),
        submissionRepository.submit({ ...input, outboxId: randomUUID() }),
      ]);
      assert.deepEqual(
        concurrent.map((result) => result.outcome).sort(),
        ['replayed', 'submitted'],
      );
      assert.equal((await submissionRepository.submit(input)).outcome, 'replayed');
      assert.equal((await submissionRepository.submit({
        ...input,
        submission: { ...submission, payloadHash: '22'.repeat(32) },
      })).outcome, 'mutation-conflict');

      const [counts] = await admin`
        SELECT
          count(*) FILTER (WHERE briefs.id = ${initialized.draft.briefId})::int AS briefs,
          count(outbox.id)::int AS outbox
        FROM discovery.project_briefs AS briefs
        LEFT JOIN discovery.notification_outbox AS outbox ON outbox.brief_id = briefs.id
        WHERE briefs.id = ${initialized.draft.briefId}
          AND briefs.state = 'submitted'
      `;
      assert.deepEqual(counts, { briefs: 1, outbox: 1 });

      const claimInput = {
        batchSize: 1,
        leaseExpiredBefore: new Date(Date.now() - 10 * 60 * 1_000),
        maxAttempts: 5,
      };
      const concurrentClaims = await Promise.all([
        notificationRepository.claimEligible(claimInput),
        notificationRepository.claimEligible(claimInput),
      ]);
      assert.equal(concurrentClaims.flat().length, 1);
      const [claimed] = concurrentClaims.flat();
      assert.equal(claimed.briefId, initialized.draft.briefId);
      assert.equal(claimed.eventType, 'project_brief_submitted');
      assert.equal(claimed.submissionReference, input.submissionReference);
      const [leaseRecovery] = await notificationRepository.claimEligible({
        ...claimInput,
        leaseExpiredBefore: new Date(Date.now() + 1_000),
      });
      assert.equal(leaseRecovery.eventId, claimed.eventId);
      assert.equal(leaseRecovery.attemptCount, claimed.attemptCount + 1);
      assert.equal(await notificationRepository.markDelivered({
        attemptCount: claimed.attemptCount,
        eventId: claimed.eventId,
        providerMessageId: 'stale-provider-id',
      }), false);
      assert.equal(await notificationRepository.markFailed({
        attemptCount: leaseRecovery.attemptCount,
        errorCode: 'temporary-provider-failure',
        eventId: claimed.eventId,
        nextAttemptAt: new Date(Date.now() - 1_000),
      }), true);
      const [retried] = await notificationRepository.claimEligible({
        batchSize: 1,
        leaseExpiredBefore: new Date(Date.now() - 10 * 60 * 1_000),
        maxAttempts: 5,
      });
      assert.equal(retried.eventId, claimed.eventId);
      assert.equal(retried.attemptCount, leaseRecovery.attemptCount + 1);
      assert.equal(await notificationRepository.markDelivered({
        attemptCount: retried.attemptCount,
        eventId: retried.eventId,
        providerMessageId: 'offline-live-gate-provider-id',
      }), true);
      assert.equal(await notificationRepository.markFailed({
        attemptCount: claimed.attemptCount,
        errorCode: 'temporary-provider-failure',
        eventId: claimed.eventId,
        nextAttemptAt: new Date(),
      }), false);
      const [submittedAfterDelivery] = await admin`
        SELECT state, submission_reference
        FROM discovery.project_briefs
        WHERE id = ${initialized.draft.briefId}::uuid
      `;
      assert.deepEqual(submittedAfterDelivery, {
        state: 'submitted',
        submission_reference: input.submissionReference,
      });
      const exportedBrief = await retrieveSubmittedBrief(
        admin,
        input.submissionReference,
      );
      assert.equal(exportedBrief.submissionReference, input.submissionReference);
      assert.equal(exportedBrief.answers.email, 'submission@example.invalid');

      await assert.rejects(runtime`
        UPDATE discovery.project_briefs
        SET answers = ${completeAnswers()}::jsonb
        WHERE id = ${initialized.draft.briefId}
      `);

      const [permissions] = await runtime`
        SELECT
          has_column_privilege(current_user, 'discovery.project_briefs', 'state', 'UPDATE') AS state_update,
          has_table_privilege(current_user, 'discovery.notification_outbox', 'INSERT') AS outbox_insert,
          has_column_privilege(current_user, 'discovery.notification_outbox', 'delivery_status', 'UPDATE') AS outbox_delivery_update,
          has_function_privilege(
            current_user,
            'discovery.claim_notification_events(integer,timestamp with time zone,integer)',
            'EXECUTE'
          ) AS outbox_claim_execute,
          has_function_privilege(
            current_user,
            'discovery.submit_project_brief(bytea,bigint,uuid,bytea,jsonb,varchar,text,text,uuid)',
            'EXECUTE'
          ) AS submit_execute
      `;
      assert.deepEqual(permissions, {
        outbox_claim_execute: true,
        outbox_delivery_update: false,
        outbox_insert: false,
        state_update: false,
        submit_execute: true,
      });

      const rollbackSessionHash = randomBytes(32);
      await admin`
        INSERT INTO discovery.invitations (
          id, token_hash, client_name, client_email, preferred_locale, expires_at
        ) VALUES (
          ${rollbackInvitationId}, ${randomBytes(32)}, ${'Rollback fixture'},
          ${`rollback-${rollbackInvitationId}@example.invalid`}, ${'en'},
          now() + interval '1 day'
        )
      `;
      await runtime`
        INSERT INTO discovery.sessions (
          id, credential_hash, invitation_id, token_generation, expires_at
        ) VALUES (${randomUUID()}, ${rollbackSessionHash}, ${rollbackInvitationId}, 1, now() + interval '12 hours')
      `;
      const rollbackDraft = await draftRepository.initialize({
        briefId: randomUUID(),
        defaultAnswers: createDiscoveryDraftDefaults(),
        locale: 'en',
        retentionDays: 30,
        sessionHash: rollbackSessionHash,
      });
      assert.ok('draft' in rollbackDraft);
      await assert.rejects(submissionRepository.submit({
        ...input,
        sessionHash: rollbackSessionHash,
        submission: validateDiscoverySubmission({
          answers: completeAnswers(),
          expectedRevision: rollbackDraft.draft.revision,
          locale: 'en',
          schemaVersion: '2.0',
          submissionId: randomUUID(),
        }),
        // Reusing the first fixture's outbox UUID forces a unique-key failure.
        outboxId: input.outboxId,
        submissionReference: `CV-ROLLBACK-${randomUUID()}`,
      }));
      const [rolledBack] = await admin`
        SELECT
          briefs.state,
          invitations.lifecycle_status,
          count(outbox.id)::int AS outbox
        FROM discovery.project_briefs AS briefs
        INNER JOIN discovery.invitations AS invitations ON invitations.id = briefs.invitation_id
        LEFT JOIN discovery.notification_outbox AS outbox ON outbox.brief_id = briefs.id
        WHERE invitations.id = ${rollbackInvitationId}
        GROUP BY briefs.state, invitations.lifecycle_status
      `;
      assert.deepEqual(rolledBack, {
        lifecycle_status: 'pending',
        outbox: 0,
        state: 'draft',
      });

      await admin`
        UPDATE discovery.invitations
        SET revoked_at = now(), revocation_reason = ${'Submission validation'}
        WHERE id = ${rollbackInvitationId}
      `;
      assert.equal((await submissionRepository.submit({
        ...input,
        sessionHash: rollbackSessionHash,
      })).outcome, 'unauthorized');

      const expiredSessionHash = randomBytes(32);
      await admin`
        INSERT INTO discovery.invitations (
          id, token_hash, client_name, client_email, preferred_locale,
          created_at, expires_at
        ) VALUES (
          ${expiredInvitationId}, ${randomBytes(32)}, ${'Expired fixture'},
          ${`expired-${expiredInvitationId}@example.invalid`}, ${'en'},
          now() - interval '2 days', now() - interval '1 day'
        )
      `;
      await runtime`
        INSERT INTO discovery.sessions (
          id, credential_hash, invitation_id, token_generation, expires_at
        ) VALUES (${randomUUID()}, ${expiredSessionHash}, ${expiredInvitationId}, 1, now() + interval '12 hours')
      `;
      await runtime`
        INSERT INTO discovery.project_briefs (
          id, invitation_id, schema_version, locale, answers
        ) VALUES (
          ${randomUUID()}, ${expiredInvitationId}, ${'2.0'}, ${'en'},
          ${createDiscoveryDraftDefaults()}::jsonb
        )
      `;
      assert.equal((await submissionRepository.submit({
        ...input,
        sessionHash: expiredSessionHash,
      })).outcome, 'unauthorized');
    } finally {
      await admin`DELETE FROM discovery.invitations WHERE id = ${invitationId}`;
      await admin`DELETE FROM discovery.invitations WHERE id = ${rollbackInvitationId}`;
      await admin`DELETE FROM discovery.invitations WHERE id = ${expiredInvitationId}`;
    }
  },
);
