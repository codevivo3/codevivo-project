import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSafeToolArguments,
  filterProviderManagedDefaultAcls,
  RECOVERY_FIXTURES,
  RecoveryPipelineError,
  recoveryRestoreArguments,
  recoveryProcessFailure,
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
  for (const argument of [
    '--clean',
    '--create',
    '--no-acl',
    '--no-privileges',
    '-c',
    '-C',
    '-x',
  ]) {
    assert.throws(
      () =>
        assertSafeToolArguments('/opt/homebrew/opt/libpq/bin/pg_restore', [
          argument,
        ]),
      /unsafe pg_restore/u,
    );
  }
});

const tocEntry = (
  id: number,
  objectType: string,
  owner: string,
  schema = 'public',
) =>
  `${id}; 0 0 DEFAULT ACL ${schema} DEFAULT PRIVILEGES FOR ${objectType} ${owner}`;

const validTableOfContents = [
  '; Archive created by pg_dump',
  '100; 1259 200 TABLE discovery invitations codevivo_discovery_migration',
  tocEntry(2071, 'SEQUENCES', 'cloud_admin'),
  tocEntry(2072, 'TABLES', 'cloud_admin'),
  tocEntry(2073, 'TABLES', 'codevivo_discovery_migration', 'discovery'),
  '2074; 0 0 ACL discovery TABLE invitations codevivo_discovery_migration',
  '',
].join('\n');

test('selectively excludes the exact provider default ACL entries', () => {
  const filtered = filterProviderManagedDefaultAcls(validTableOfContents);
  assert.match(filtered, /^;2071;.*SEQUENCES cloud_admin$/mu);
  assert.match(filtered, /^;2072;.*TABLES cloud_admin$/mu);
  assert.match(filtered, /^2073;.*TABLES codevivo_discovery_migration$/mu);
  assert.match(filtered, /^2074;.*ACL discovery TABLE invitations/mu);
  assert.equal(
    filtered.split('\n').length,
    validTableOfContents.split('\n').length,
  );

  const renumbered = filterProviderManagedDefaultAcls(
    validTableOfContents.replace('2071;', '9001;').replace('2072;', '9002;'),
  );
  assert.match(renumbered, /^;9001;.*SEQUENCES cloud_admin$/mu);
  assert.match(renumbered, /^;9002;.*TABLES cloud_admin$/mu);
});

test('restore uses the filtered list without weakening transaction safeguards', () => {
  const args = recoveryRestoreArguments();
  assert.deepEqual(args, [
    '--exit-on-error',
    '--single-transaction',
    '--no-owner',
    '--use-list=/dev/fd/3',
    `--dbname=${RECOVERY_DATABASE_NAME}`,
  ]);
  assert.doesNotThrow(() =>
    assertSafeToolArguments('/opt/homebrew/opt/libpq/bin/pg_restore', args),
  );
});

test('provider default ACL filtering fails closed for missing or duplicate entries', () => {
  assert.throws(
    () =>
      filterProviderManagedDefaultAcls(
        validTableOfContents.replace(
          `${tocEntry(2071, 'SEQUENCES', 'cloud_admin')}\n`,
          '',
        ),
      ),
    /not unique/u,
  );
  assert.throws(
    () =>
      filterProviderManagedDefaultAcls(
        `${validTableOfContents}${tocEntry(3072, 'TABLES', 'cloud_admin')}\n`,
      ),
    /not unique/u,
  );
});

test('provider default ACL filtering rejects altered metadata', () => {
  assert.throws(
    () =>
      filterProviderManagedDefaultAcls(
        validTableOfContents.replace(
          tocEntry(2072, 'TABLES', 'cloud_admin'),
          tocEntry(2072, 'TABLES', 'unexpected_owner'),
        ),
      ),
    /not unique/u,
  );
  assert.throws(
    () =>
      filterProviderManagedDefaultAcls(
        validTableOfContents.replace(
          tocEntry(2072, 'TABLES', 'cloud_admin'),
          tocEntry(2072, 'FUNCTIONS', 'cloud_admin'),
        ),
      ),
    /unexpected provider/u,
  );
  assert.throws(
    () =>
      filterProviderManagedDefaultAcls(
        validTableOfContents.replace(
          tocEntry(2071, 'SEQUENCES', 'cloud_admin'),
          tocEntry(2071, 'SEQUENCES', 'cloud_admin', 'discovery'),
        ),
      ),
    /unexpected provider/u,
  );
});

test('provider default ACL filtering rejects malformed TOC data', () => {
  assert.throws(
    () => filterProviderManagedDefaultAcls(''),
    /malformed archive/u,
  );
  assert.throws(
    () =>
      filterProviderManagedDefaultAcls(
        validTableOfContents.replace(
          tocEntry(2071, 'SEQUENCES', 'cloud_admin'),
          '2071; malformed DEFAULT ACL cloud_admin',
        ),
      ),
    /malformed DEFAULT ACL/u,
  );
  assert.throws(
    () => filterProviderManagedDefaultAcls(`${validTableOfContents}\0`),
    /malformed archive/u,
  );
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

test('pipeline failures are attributed without exposing captured diagnostics', () => {
  const gpgFailure = recoveryProcessFailure(
    'gpg',
    2,
    'gpg: decryption failed: Bad session key secret-marker',
  );
  assert.match(gpgFailure.message, /gpg failed \(decryption; exit 2\)/u);
  assert.doesNotMatch(gpgFailure.message, /secret-marker/u);

  const restoreFailure = recoveryProcessFailure(
    'pg_restore',
    1,
    'ERROR: must be member of role cloud_admin\nCommand was: ALTER DEFAULT PRIVILEGES; client@example.test',
  );
  assert.match(
    restoreFailure.message,
    /pg_restore failed \(permission-or-acl; exit 1\)/u,
  );
  assert.doesNotMatch(
    restoreFailure.message,
    /cloud_admin|ALTER DEFAULT|client@example/u,
  );

  assert.equal(
    new RecoveryPipelineError('pg_restore', 'stream-failed', null).message,
    'Recovery executor: pg_restore failed (stream-failed)',
  );
});

test('restore preserves safe process attribution after an empty rollback', async () => {
  await assert.rejects(
    runRecoveryExecutor(
      'restore',
      environment('restore'),
      dependencies({
        verifyArchive: async () => 'checksum',
        readManifest: () => ({
          archive: 'codevivo-exercise.pg18.dump.gpg',
          archiveSha256: 'checksum',
          createdAt: NOW.toISOString(),
          fixtures: RECOVERY_FIXTURES,
        }),
        restoreArchive: async () => {
          throw new RecoveryPipelineError('pg_restore', 'permission-or-acl', 1);
        },
      }),
    ),
    /pg_restore failed \(permission-or-acl; exit 1\); restore transaction rolled back; destination remained empty/u,
  );
});

test('restore redacts unknown failure details after an empty rollback', async () => {
  await assert.rejects(
    runRecoveryExecutor(
      'restore',
      environment('restore'),
      dependencies({
        verifyArchive: async () => 'checksum',
        readManifest: () => ({
          archive: 'codevivo-exercise.pg18.dump.gpg',
          archiveSha256: 'checksum',
          createdAt: NOW.toISOString(),
          fixtures: RECOVERY_FIXTURES,
        }),
        restoreArchive: async () => {
          throw new Error('sensitive-marker client-data');
        },
      }),
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /restore failed and rolled back/u);
      assert.doesNotMatch(error.message, /sensitive-marker|client-data/u);
      return true;
    },
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
