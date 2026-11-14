import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { neon } from '@neondatabase/serverless';
import {
  generateDiscoveryCredential,
  hashDiscoveryCredential,
  validateDiscoveryPepper,
} from '../../src/lib/discovery/credential-core';
import { createDiscoverySessionRepository } from '../../src/lib/discovery/repository-core';
import {
  DISCOVERY_ADMIN_URL_SERVICE,
  DISCOVERY_PEPPER_SERVICE,
  DISCOVERY_RUNTIME_URL_SERVICE,
  readKeychainSecret,
} from '../../scripts/discovery-keychain';

const EXPECTED_DIRECT_HOST =
  'ep-late-sea-bas88ozp.c-8.eu-central-1.aws.neon.tech';
const EXPECTED_POOLED_HOST =
  'ep-late-sea-bas88ozp-pooler.c-8.eu-central-1.aws.neon.tech';
const enabled = process.env.DISCOVERY_M2B_LIVE_ALLOW === '1';

function verifyConnectionTarget(
  connectionString: string,
  role: string,
  pooled: boolean,
) {
  const url = new URL(connectionString);
  assert.equal(
    url.hostname,
    pooled ? EXPECTED_POOLED_HOST : EXPECTED_DIRECT_HOST,
  );
  assert.equal(url.hostname.includes('-pooler'), pooled);
  assert.equal(url.pathname, '/neondb');
  assert.equal(decodeURIComponent(url.username), role);
}

test(
  'Project Discovery invitation lifecycle on validation branch',
  { skip: enabled ? false : 'Set DISCOVERY_M2B_LIVE_ALLOW=1 explicitly' },
  async (t) => {
    const adminUrl = readKeychainSecret(DISCOVERY_ADMIN_URL_SERVICE);
    const runtimeUrl = readKeychainSecret(DISCOVERY_RUNTIME_URL_SERVICE);
    const pepper = validateDiscoveryPepper(
      readKeychainSecret(DISCOVERY_PEPPER_SERVICE),
    );
    assert.match(pepper, /^[0-9a-fA-F]{64}$/u);
    verifyConnectionTarget(
      adminUrl,
      'codevivo_discovery_admin',
      false,
    );
    verifyConnectionTarget(
      runtimeUrl,
      'codevivo_discovery_runtime',
      true,
    );

    const admin = neon(adminUrl);
    const runtime = neon(runtimeUrl);
    const repository = createDiscoverySessionRepository(() => runtime);
    const invitationIds: string[] = [];

    async function insertInvitation(input: {
      token: string;
      createdAt?: Date;
      expiresAt?: Date;
    }) {
      const id = randomUUID();
      invitationIds.push(id);
      const createdAt = input.createdAt ?? new Date();
      const expiresAt =
        input.expiresAt ??
        new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
      await admin`
        INSERT INTO discovery.invitations (
          id,
          token_hash,
          client_name,
          client_email,
          preferred_locale,
          created_at,
          expires_at
        ) VALUES (
          ${id},
          ${hashDiscoveryCredential(input.token, 'invitation', pepper)},
          ${'M2B disposable fixture'},
          ${`m2b-${id}@example.invalid`},
          ${'en'},
          ${createdAt.toISOString()}::timestamptz,
          ${expiresAt.toISOString()}::timestamptz
        )
      `;
      return id;
    }

    async function exchange(token: string) {
      const sessionCredential = generateDiscoveryCredential();
      const sessionHash = hashDiscoveryCredential(
        sessionCredential,
        'session',
        pepper,
      );
      const result = await repository.createSessionIfInvitationValid({
        sessionId: randomUUID(),
        invitationHash: hashDiscoveryCredential(token, 'invitation', pepper),
        sessionHash,
        requestedSessionExpiry: new Date(Date.now() + 12 * 60 * 60 * 1000),
      });
      return { result, sessionHash };
    }

    async function revoke(id: string) {
      const rows = await admin`
        WITH revoked AS (
          UPDATE discovery.invitations
          SET revoked_at = now(), revocation_reason = ${'M2B live validation'}
          WHERE id = ${id}
            AND revoked_at IS NULL
          RETURNING id
        ),
        invalidated AS (
          UPDATE discovery.sessions
          SET invalidated_at = now(), invalidation_reason = ${'Invitation revoked'}
          WHERE invitation_id IN (SELECT id FROM revoked)
            AND invalidated_at IS NULL
          RETURNING id
        )
        SELECT
          (SELECT count(*)::int FROM revoked) AS revoked_count,
          (SELECT count(*)::int FROM invalidated) AS invalidated_count
      `;
      return rows[0];
    }

    try {
      await t.test('target, database, roles and PostgreSQL version match', async () => {
        const [runtimeTarget] = await runtime`
          SELECT current_database() AS database, current_user AS role,
            current_setting('server_version_num')::int AS version
        `;
        const [adminTarget] = await admin`
          SELECT current_database() AS database, current_user AS role
        `;
        assert.equal(runtimeTarget.database, 'neondb');
        assert.equal(runtimeTarget.role, 'codevivo_discovery_runtime');
        assert.equal(runtimeTarget.version >= 180000, true);
        assert.equal(adminTarget.database, 'neondb');
        assert.equal(adminTarget.role, 'codevivo_discovery_admin');
      });

      await t.test('valid, invalid, repeated and expired exchanges', async () => {
        const validToken = generateDiscoveryCredential();
        const validId = await insertInvitation({ token: validToken });
        const first = await exchange(validToken);
        const repeated = await exchange(validToken);
        const invalid = await exchange(generateDiscoveryCredential());

        assert.equal(first.result.outcome, 'established');
        assert.equal(repeated.result.outcome, 'established');
        assert.equal(invalid.result.outcome, 'unavailable');
        assert.equal(
          (await repository.findAuthorizedSession({
            sessionHash: first.sessionHash,
          }))?.invitationId,
          validId,
        );

        const [persisted] = await runtime`
          SELECT count(*)::int AS sessions, max(lifecycle_status) AS status
          FROM discovery.invitations
          LEFT JOIN discovery.sessions
            ON sessions.invitation_id = invitations.id
          WHERE invitations.id = ${validId}
          GROUP BY invitations.id
        `;
        assert.equal(persisted.sessions, 2);
        assert.equal(persisted.status, 'in_progress');

        const expiredToken = generateDiscoveryCredential();
        await insertInvitation({
          token: expiredToken,
          createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        });
        assert.equal((await exchange(expiredToken)).result.outcome, 'expired');
      });

      await t.test('revocation is final and invalidates sessions', async () => {
        const token = generateDiscoveryCredential();
        const id = await insertInvitation({ token });
        const established = await exchange(token);
        assert.equal(established.result.outcome, 'established');
        const revoked = await revoke(id);
        assert.equal(revoked.revoked_count, 1);
        assert.equal(revoked.invalidated_count, 1);
        assert.equal((await exchange(token)).result.outcome, 'unavailable');
        assert.equal(
          await repository.findAuthorizedSession({
            sessionHash: established.sessionHash,
          }),
          null,
        );
        await assert.rejects(admin`
          UPDATE discovery.invitations
          SET revoked_at = NULL, revocation_reason = NULL
          WHERE id = ${id}
        `);
      });

      await t.test('expired and generation-mismatched sessions are rejected', async () => {
        const token = generateDiscoveryCredential();
        const id = await insertInvitation({ token });
        for (const fixture of [
          { tokenGeneration: 1 },
          { tokenGeneration: 99 },
        ] as const) {
          const sessionHash = hashDiscoveryCredential(
            generateDiscoveryCredential(),
            'session',
            pepper,
          );
          if (fixture.tokenGeneration === 1) {
            await runtime`
              INSERT INTO discovery.sessions (
                id, credential_hash, invitation_id, token_generation,
                created_at, expires_at
              ) VALUES (
                ${randomUUID()}, ${sessionHash}, ${id}, ${fixture.tokenGeneration},
                now() - interval '2 days', now() - interval '1 day'
              )
            `;
          } else {
            await runtime`
              INSERT INTO discovery.sessions (
                id, credential_hash, invitation_id, token_generation, expires_at
              ) VALUES (
                ${randomUUID()}, ${sessionHash}, ${id}, ${fixture.tokenGeneration},
                now() + interval '1 day'
              )
            `;
          }
          assert.equal(
            await repository.findAuthorizedSession({ sessionHash }),
            null,
          );
        }
      });

      await t.test('concurrent exchange and revocation cannot leave an authorized session', async () => {
        const token = generateDiscoveryCredential();
        const id = await insertInvitation({ token });
        const [exchangeResult, revokeResult] = await Promise.all([
          exchange(token),
          revoke(id),
        ]);
        assert.equal(revokeResult.revoked_count, 1);
        assert.equal(
          await repository.findAuthorizedSession({
            sessionHash: exchangeResult.sessionHash,
          }),
          null,
        );
        const [remaining] = await admin`
          SELECT count(*)::int AS count
          FROM discovery.sessions
          WHERE invitation_id = ${id}
            AND invalidated_at IS NULL
        `;
        assert.equal(remaining.count, 0);
      });

      await t.test('runtime and administration permission boundaries hold', async () => {
        const deniedInvitationId = randomUUID();
        invitationIds.push(deniedInvitationId);
        await assert.rejects(runtime`
          INSERT INTO discovery.invitations (
            id, token_hash, client_name, client_email, expires_at
          ) VALUES (
            ${deniedInvitationId}, ${randomBytes(32)}, ${'denied'},
            ${'denied@example.invalid'}, now() + interval '1 day'
          )
        `);

        const trackedInvitationId = await insertInvitation({
          token: generateDiscoveryCredential(),
        });
        await assert.rejects(admin`
          INSERT INTO discovery.sessions (
            id, credential_hash, invitation_id, token_generation, expires_at
          ) VALUES (
            ${randomUUID()}, ${randomBytes(32)}, ${trackedInvitationId}, ${1},
            now() + interval '1 hour'
          )
        `);
      });

      await t.test('submitted briefs remain immutable', async () => {
        const id = await insertInvitation({
          token: generateDiscoveryCredential(),
        });
        const briefId = randomUUID();
        await runtime`
          INSERT INTO discovery.project_briefs (
            id, invitation_id, schema_version, locale
          ) VALUES (${briefId}, ${id}, ${'1.0'}, ${'en'})
        `;
        await runtime`
          UPDATE discovery.project_briefs
          SET state = 'submitted',
            submission_reference = ${`CV-M2B-${briefId}`},
            submitted_at = now()
          WHERE id = ${briefId}
        `;
        await assert.rejects(runtime`
          UPDATE discovery.project_briefs
          SET answers = ${{ changed: true }}
          WHERE id = ${briefId}
        `);
      });

      await t.test('failed transactions roll back disposable fixtures', async () => {
        const id = await insertInvitation({
          token: generateDiscoveryCredential(),
        });
        const sessionId = randomUUID();
        await assert.rejects(
          runtime.transaction([
            runtime`
              INSERT INTO discovery.sessions (
                id, credential_hash, invitation_id, token_generation, expires_at
              ) VALUES (
                ${sessionId}, ${Buffer.from(randomUUID().replaceAll('-', '').padEnd(64, '0'), 'hex')},
                ${id}, ${1}, now() + interval '1 hour'
              )
            `,
            runtime`
              INSERT INTO discovery.project_briefs (
                id, invitation_id, schema_version, locale
              ) VALUES (${randomUUID()}, ${id}, ${'1.0'}, ${'invalid'})
            `,
          ]),
        );
        const [result] = await runtime`
          SELECT count(*)::int AS count
          FROM discovery.sessions WHERE id = ${sessionId}
        `;
        assert.equal(result.count, 0);
      });
    } finally {
      if (invitationIds.length > 0) {
        await admin`
          DELETE FROM discovery.invitations
          WHERE id = ANY(${invitationIds}::uuid[])
        `;
      }
    }
  },
);
