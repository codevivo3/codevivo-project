import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { neon } from '@neondatabase/serverless';

const requiredVariables = [
  'DATABASE_URL',
  'DISCOVERY_ADMIN_DATABASE_URL',
  'DISCOVERY_MIGRATION_DATABASE_URL',
];
const missingVariables = requiredVariables.filter(
  (variable) => !process.env[variable],
);
const integrationEnabled = process.env.DISCOVERY_DB_TEST_ALLOW === '1';
const skipReason = !integrationEnabled
  ? 'Set DISCOVERY_DB_TEST_ALLOW=1 only for a disposable migrated database'
  : missingVariables.length > 0
    ? `Missing required database variables: ${missingVariables.join(', ')}`
    : false;

test('Project Discovery database behavior', { skip: skipReason }, async (t) => {
  const runtime = neon(process.env.DATABASE_URL);
  const admin = neon(process.env.DISCOVERY_ADMIN_DATABASE_URL);
  const migration = neon(process.env.DISCOVERY_MIGRATION_DATABASE_URL);
  const invitationId = randomUUID();
  const rollbackInvitationId = randomUUID();
  const sessionId = randomUUID();
  const committedBriefId = randomUUID();
  const rollbackSessionId = randomUUID();

  const hashHex = () => randomBytes(32).toString('hex');

  await t.test('role permissions are least privilege', async () => {
    const [runtimePrivileges] = await runtime`
      SELECT
        has_schema_privilege(current_user, 'discovery', 'CREATE') AS schema_create,
        has_table_privilege(
          current_user,
          'discovery.invitations',
          'INSERT'
        ) AS invitation_insert,
        has_table_privilege(
          current_user,
          'discovery.project_briefs',
          'SELECT'
        ) AS brief_select
    `;
    const [adminPrivileges] = await admin`
      SELECT
        has_table_privilege(
          current_user,
          'discovery.invitations',
          'INSERT'
        ) AS invitation_insert,
        has_table_privilege(
          current_user,
          'discovery.project_briefs',
          'UPDATE'
        ) AS brief_update
    `;
    const [migrationPrivileges] = await migration`
      SELECT has_schema_privilege(
        current_user,
        'discovery',
        'CREATE'
      ) AS schema_create
    `;

    assert.equal(runtimePrivileges.schema_create, false);
    assert.equal(runtimePrivileges.invitation_insert, false);
    assert.equal(runtimePrivileges.brief_select, true);
    assert.equal(adminPrivileges.invitation_insert, true);
    assert.equal(adminPrivileges.brief_update, false);
    assert.equal(migrationPrivileges.schema_create, true);
  });

  await admin`
    INSERT INTO discovery.invitations (
      id,
      token_hash,
      client_name,
      client_email,
      preferred_locale,
      expires_at
    ) VALUES (
      ${invitationId},
      decode(${hashHex()}, 'hex'),
      ${'Database integration fixture'},
      ${'database-test@example.invalid'},
      ${'en'},
      now() + interval '14 days'
    )
  `;
  await admin`
    INSERT INTO discovery.invitations (
      id,
      token_hash,
      client_name,
      client_email,
      preferred_locale,
      expires_at
    ) VALUES (
      ${rollbackInvitationId},
      decode(${hashHex()}, 'hex'),
      ${'Rollback integration fixture'},
      ${'rollback-test@example.invalid'},
      ${'it'},
      now() + interval '14 days'
    )
  `;

  try {
    await t.test('parameterized transaction commits atomically', async () => {
      await runtime.transaction([
        runtime`
          INSERT INTO discovery.sessions (
            id,
            credential_hash,
            invitation_id,
            token_generation,
            expires_at
          ) VALUES (
            ${sessionId},
            decode(${hashHex()}, 'hex'),
            ${invitationId},
            ${1},
            now() + interval '12 hours'
          )
        `,
        runtime`
          INSERT INTO discovery.project_briefs (
            id,
            invitation_id,
            schema_version,
            locale
          ) VALUES (
            ${committedBriefId},
            ${invitationId},
            ${'1.0'},
            ${'en'}
          )
        `,
      ]);

      const [counts] = await runtime`
        SELECT
          (SELECT count(*)::int FROM discovery.sessions WHERE id = ${sessionId})
            AS sessions,
          (SELECT count(*)::int FROM discovery.project_briefs
            WHERE id = ${committedBriefId}) AS briefs
      `;

      assert.equal(counts.sessions, 1);
      assert.equal(counts.briefs, 1);
    });

    await t.test('submitted briefs cannot be changed', async () => {
      await runtime`
        UPDATE discovery.project_briefs
        SET
          state = 'submitted',
          submission_reference = ${`CV-TEST-${committedBriefId}`},
          submitted_at = now()
        WHERE id = ${committedBriefId}
      `;

      await assert.rejects(runtime`
        UPDATE discovery.project_briefs
        SET answers = ${{ changed: true }}
        WHERE id = ${committedBriefId}
      `);
    });

    await t.test('constraint failure rolls the transaction back', async () => {
      await assert.rejects(
        runtime.transaction([
          runtime`
            INSERT INTO discovery.sessions (
              id,
              credential_hash,
              invitation_id,
              token_generation,
              expires_at
            ) VALUES (
              ${rollbackSessionId},
              decode(${hashHex()}, 'hex'),
              ${rollbackInvitationId},
              ${1},
              now() + interval '12 hours'
            )
          `,
          runtime`
            INSERT INTO discovery.project_briefs (
              id,
              invitation_id,
              schema_version,
              locale
            ) VALUES (
              ${randomUUID()},
              ${rollbackInvitationId},
              ${'1.0'},
              ${'invalid-locale'}
            )
          `,
        ]),
      );

      const [result] = await runtime`
        SELECT count(*)::int AS count
        FROM discovery.sessions
        WHERE id = ${rollbackSessionId}
      `;

      assert.equal(result.count, 0);
    });

    await t.test('revocation cannot be reversed', async () => {
      await admin`
        UPDATE discovery.invitations
        SET
          revoked_at = now(),
          revocation_reason = ${'Database integration test'}
        WHERE id = ${rollbackInvitationId}
      `;

      await assert.rejects(admin`
        UPDATE discovery.invitations
        SET
          revoked_at = NULL,
          revocation_reason = NULL
        WHERE id = ${rollbackInvitationId}
      `);
    });
  } finally {
    await admin`
      DELETE FROM discovery.invitations
      WHERE id IN (${invitationId}, ${rollbackInvitationId})
    `;
  }
});
