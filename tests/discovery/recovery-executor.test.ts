import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSafeToolArguments,
  RECOVERY_FIXTURES,
  runRecoveryExecutor,
  type RecoveryExecutorDependencies,
} from '../../scripts/discovery-recovery-executor';
import {
  RECOVERY_AUTHORIZATION,
  RECOVERY_BRANCH_ID,
  RECOVERY_BRANCH_NAME,
  RECOVERY_DATABASE_NAME,
  RECOVERY_ENDPOINT_HOST,
  RECOVERY_ENDPOINT_ID,
  SOURCE_BRANCH_ID,
  SOURCE_DATABASE_NAME,
  SOURCE_ENDPOINT_HOST,
} from '../../scripts/discovery-recovery-guard';

const NOW = new Date('2026-11-15T10:00:00.000Z');
const ARCHIVE_DIRECTORY = '/secure/recovery-archives';

const connection = (hostname: string, database: string, role: string) =>
  `postgresql://${role}@${hostname}/${database}?sslmode=require`;

const secrets = new Map([
  ['codevivo.discovery.recovery.neon-api-key', 'mock-api-key'],
  [
    'codevivo.discovery.recovery.runtime.database-url',
    connection(
      RECOVERY_ENDPOINT_HOST,
      RECOVERY_DATABASE_NAME,
      'codevivo_discovery_runtime',
    ),
  ],
  [
    'codevivo.discovery.recovery.admin.database-url',
    connection(
      RECOVERY_ENDPOINT_HOST,
      RECOVERY_DATABASE_NAME,
      'codevivo_discovery_admin',
    ),
  ],
  [
    'codevivo.discovery.recovery.migration.database-url',
    connection(
      RECOVERY_ENDPOINT_HOST,
      RECOVERY_DATABASE_NAME,
      'codevivo_discovery_migration',
    ),
  ],
  [
    'codevivo.discovery.migration.database-url',
    connection(
      SOURCE_ENDPOINT_HOST,
      SOURCE_DATABASE_NAME,
      'codevivo_discovery_migration',
    ),
  ],
]);

const metadataResponse = (expiresAt = '2026-11-16T10:29:36Z') =>
  async (url: URL | RequestInfo) =>
    new Response(
      JSON.stringify(
        String(url).endsWith('/endpoints')
          ? {
              endpoints: [
                {
                  id: RECOVERY_ENDPOINT_ID,
                  branch_id: RECOVERY_BRANCH_ID,
                  host: RECOVERY_ENDPOINT_HOST,
                  type: 'read_write',
                },
              ],
            }
          : {
              branch: {
                id: RECOVERY_BRANCH_ID,
                name: RECOVERY_BRANCH_NAME,
                parent_id: SOURCE_BRANCH_ID,
                expires_at: expiresAt,
              },
            },
      ),
    );

const environment = (stage = 'preflight') => ({
  DISCOVERY_RECOVERY_ARCHIVE_DIR: ARCHIVE_DIRECTORY,
  DISCOVERY_RECOVERY_BRANCH_ID: RECOVERY_BRANCH_ID,
  DISCOVERY_RECOVERY_ENDPOINT_ID: RECOVERY_ENDPOINT_ID,
  DISCOVERY_RECOVERY_STAGE_ALLOW: `${stage}:${RECOVERY_AUTHORIZATION}`,
});

const emptyTarget = {
  database: RECOVERY_DATABASE_NAME,
  user: 'codevivo_discovery_migration',
  owner: 'codevivo_discovery_migration',
  userTables: 0,
  discoverySchemas: 0,
};

const dependencies = (
  overrides: RecoveryExecutorDependencies = {},
): RecoveryExecutorDependencies => ({
  now: () => NOW,
  readSecret: (service) => {
    const secret = secrets.get(service);
    if (!secret) throw new Error('missing mock credential');
    return secret;
  },
  fetchImplementation: metadataResponse(),
  inspectArchiveDirectory: () => ({
    absolute: true,
    directory: true,
    mode: 0o700,
    owner: 501,
    currentUser: 501,
    symbolicLink: false,
    insideRepository: false,
  }),
  toolsAvailable: () => true,
  inspectTarget: () => emptyTarget,
  ...overrides,
});

test('accepts an exact mocked recovery preflight', async () => {
  await runRecoveryExecutor('preflight', environment(), dependencies());
});

test('write-capable stages require exact stage-specific authorization', async () => {
  const input = environment('restore');
  input.DISCOVERY_RECOVERY_STAGE_ALLOW =
    `backup-exercise:${RECOVERY_AUTHORIZATION}`;
  let credentialReads = 0;
  await assert.rejects(
    runRecoveryExecutor(
      'restore',
      input,
      dependencies({
        readSecret: () => {
          credentialReads += 1;
          return 'not-used';
        },
      }),
    ),
    /restore authorization/u,
  );
  assert.equal(credentialReads, 0);
});

test('rejects wrong branch and endpoint before reading credentials', async () => {
  let credentialReads = 0;
  const input = environment();
  input.DISCOVERY_RECOVERY_BRANCH_ID = SOURCE_BRANCH_ID;
  await assert.rejects(
    runRecoveryExecutor(
      'preflight',
      input,
      dependencies({
        readSecret: () => {
          credentialReads += 1;
          return 'not-used';
        },
      }),
    ),
    /branch ID/u,
  );
  assert.equal(credentialReads, 0);

  input.DISCOVERY_RECOVERY_BRANCH_ID = RECOVERY_BRANCH_ID;
  input.DISCOVERY_RECOVERY_ENDPOINT_ID = 'ep-production-example';
  await assert.rejects(
    runRecoveryExecutor('preflight', input, dependencies()),
    /endpoint ID/u,
  );
});

test('rejects wrong recovery database and role', async () => {
  const wrongDatabase = new Map(secrets);
  wrongDatabase.set(
    'codevivo.discovery.recovery.runtime.database-url',
    connection(
      RECOVERY_ENDPOINT_HOST,
      SOURCE_DATABASE_NAME,
      'codevivo_discovery_runtime',
    ),
  );
  await assert.rejects(
    runRecoveryExecutor(
      'preflight',
      environment(),
      dependencies({ readSecret: (service) => wrongDatabase.get(service) ?? '' }),
    ),
    /database/u,
  );

  const wrongRole = new Map(secrets);
  wrongRole.set(
    'codevivo.discovery.recovery.migration.database-url',
    connection(RECOVERY_ENDPOINT_HOST, RECOVERY_DATABASE_NAME, 'neondb_owner'),
  );
  await assert.rejects(
    runRecoveryExecutor(
      'preflight',
      environment(),
      dependencies({ readSecret: (service) => wrongRole.get(service) ?? '' }),
    ),
    /role/u,
  );
});

test('fails closed for missing credentials', async () => {
  await assert.rejects(
    runRecoveryExecutor(
      'preflight',
      environment(),
      dependencies({ readSecret: () => { throw new Error('missing'); } }),
    ),
    /missing/u,
  );

  let metadataRequests = 0;
  await assert.rejects(
    runRecoveryExecutor(
      'preflight',
      environment(),
      dependencies({
        readSecret: (service) =>
          service === 'codevivo.discovery.recovery.neon-api-key'
            ? ''
            : secrets.get(service) ?? '',
        fetchImplementation: async () => {
          metadataRequests += 1;
          return new Response('{}');
        },
      }),
    ),
    /API credential/u,
  );
  assert.equal(metadataRequests, 0);
});

test('rejects expired and short-lived recovery branches', async () => {
  await assert.rejects(
    runRecoveryExecutor(
      'preflight',
      environment(),
      dependencies({
        fetchImplementation: metadataResponse('2026-11-15T09:59:59.000Z'),
      }),
    ),
    /expired/u,
  );
  await assert.rejects(
    runRecoveryExecutor(
      'preflight',
      environment(),
      dependencies({
        fetchImplementation: metadataResponse('2026-11-15T12:59:59.000Z'),
      }),
    ),
    /insufficient/u,
  );
});

test('restore rejects a nonempty destination before archive access', async () => {
  let archiveChecks = 0;
  await assert.rejects(
    runRecoveryExecutor(
      'restore',
      environment('restore'),
      dependencies({
        inspectTarget: () => ({ ...emptyTarget, userTables: 1 }),
        verifyArchive: async () => {
          archiveChecks += 1;
          return 'checksum';
        },
      }),
    ),
    /not empty/u,
  );
  assert.equal(archiveChecks, 0);
});

test('restore rejects an archive that does not match its recorded manifest', async () => {
  let restoreRuns = 0;
  await assert.rejects(
    runRecoveryExecutor(
      'restore',
      environment('restore'),
      dependencies({
        readManifest: () => ({
          archive: 'codevivo-exercise.pg18.dump.gpg',
          archiveSha256: 'recorded-checksum',
          createdAt: NOW.toISOString(),
          fixtures: RECOVERY_FIXTURES,
        }),
        verifyArchive: async () => 'different-checksum',
        restoreArchive: async () => {
          restoreRuns += 1;
        },
      }),
    ),
    /manifest mismatch/u,
  );
  assert.equal(restoreRuns, 0);
});

test('unsafe backup and restore arguments are rejected', () => {
  assert.throws(
    () =>
      assertSafeToolArguments('/opt/homebrew/opt/libpq/bin/pg_dump', [
        ['postgresql://user', 'credential@example.invalid/neondb'].join(':'),
      ]),
    /credential/u,
  );
  for (const argument of ['--clean', '--create', '-c', '-C']) {
    assert.throws(
      () =>
        assertSafeToolArguments('/opt/homebrew/opt/libpq/bin/pg_restore', [
          argument,
        ]),
      /unsafe pg_restore/u,
    );
  }
});

test('backup stops on encryption and archive verification failures', async () => {
  let verificationRuns = 0;
  await assert.rejects(
    runRecoveryExecutor(
      'backup-source',
      environment('backup-source'),
      dependencies({
        fingerprintSource: () => ({ source: 'unchanged' }),
        createEncryptedBackup: async () => {
          throw new Error('encryption failed');
        },
        verifyArchive: async () => {
          verificationRuns += 1;
          return 'checksum';
        },
      }),
    ),
    /encryption failed/u,
  );
  assert.equal(verificationRuns, 0);

  await assert.rejects(
    runRecoveryExecutor(
      'backup-source',
      environment('backup-source'),
      dependencies({
        fingerprintSource: () => ({ source: 'unchanged' }),
        createEncryptedBackup: async () => undefined,
        verifyArchive: async () => {
          throw new Error('archive verification failed');
        },
      }),
    ),
    /archive verification failed/u,
  );
});

test('restore reports partial state after a failed transaction', async () => {
  let inspections = 0;
  await assert.rejects(
    runRecoveryExecutor(
      'restore',
      environment('restore'),
      dependencies({
        inspectTarget: () => {
          inspections += 1;
          return inspections === 1
            ? emptyTarget
            : { ...emptyTarget, discoverySchemas: 1, userTables: 2 };
        },
        verifyArchive: async () => 'checksum',
        readManifest: () => ({
          archive: 'codevivo-exercise.pg18.dump.gpg',
          archiveSha256: 'checksum',
          createdAt: NOW.toISOString(),
          fixtures: RECOVERY_FIXTURES,
        }),
        restoreArchive: async () => {
          throw new Error('restore failed');
        },
      }),
    ),
    /partial restore/u,
  );
});

test('validate fails closed and never starts guarded tests on validation errors', async () => {
  let testRuns = 0;
  await assert.rejects(
    runRecoveryExecutor(
      'validate',
      environment('validate'),
      dependencies({
        validateRecovery: () => false,
        runGuardedTests: async () => {
          testRuns += 1;
          return 0;
        },
      }),
    ),
    /validation failed/u,
  );
  assert.equal(testRuns, 0);
});
