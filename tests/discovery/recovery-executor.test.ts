import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import test from 'node:test';
import {
  assertSafeToolArguments,
  filterProviderManagedDefaultAcls,
  RECOVERY_FIXTURES,
  RecoveryDiagnosticError,
  RecoveryPipelineError,
  recoveryRestoreArguments,
  recoveryProcessFailure,
  runRecoveryExecutor,
  selectRecoveryPipelineFailure,
  verifyEncryptedArchiveStream,
  verifyRecoveryArchiveStreams,
  withRecoveryUseListFile,
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
          return {
            archiveSha256: 'checksum',
            tableOfContents: validTableOfContents,
          };
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
        verifyArchive: async () => ({
          archiveSha256: 'different-checksum',
          tableOfContents: validTableOfContents,
        }),
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
  const useListPath =
    `/secure/recovery-archives/.codevivo-restore-${'a'.repeat(32)}.toc`;
  const args = recoveryRestoreArguments(useListPath);
  assert.deepEqual(args, [
    '--exit-on-error',
    '--single-transaction',
    '--no-owner',
    `--use-list=${useListPath}`,
    `--dbname=${RECOVERY_DATABASE_NAME}`,
  ]);
  assert.doesNotThrow(() =>
    assertSafeToolArguments('/opt/homebrew/opt/libpq/bin/pg_restore', args),
  );
  assert.doesNotMatch(args.join(' '), /\/dev\/fd|--no-acl|--clean|--create/u);
  assert.throws(
    () => recoveryRestoreArguments('/secure/recovery-archives/unsafe.toc'),
    /unsafe temporary use-list path/u,
  );
});

test('temporary use-list is private, contains only supplied metadata, and is removed', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'codevivo-use-list-'));
  let observedPath = '';
  try {
    const result = await withRecoveryUseListFile(
      directory,
      validTableOfContents,
      async (path) => {
        observedPath = path;
        assert.equal(statSync(path).mode & 0o777, 0o600);
        assert.equal(readFileSync(path, 'utf8'), validTableOfContents);
        return 'restored';
      },
    );
    assert.equal(result, 'restored');
    assert.equal(existsSync(observedPath), false);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test('temporary use-list is removed when the restore action fails', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'codevivo-use-list-failure-'));
  let observedPath = '';
  try {
    await assert.rejects(
      withRecoveryUseListFile(
        directory,
        validTableOfContents,
        async (path) => {
          observedPath = path;
          throw new RecoveryPipelineError('pg_restore', 'process-failed', 1);
        },
      ),
      /pg_restore failed \(process-failed; exit 1\)/u,
    );
    assert.equal(existsSync(observedPath), false);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test('temporary use-list creation and write failures fail closed', async () => {
  let actionRuns = 0;
  let removals = 0;
  await assert.rejects(
    withRecoveryUseListFile(
      ARCHIVE_DIRECTORY,
      validTableOfContents,
      async () => {
        actionRuns += 1;
      },
      {
        createName: () => `.codevivo-restore-${'b'.repeat(32)}.toc`,
        openFile: () => {
          throw new Error('path already exists');
        },
        removeFile: () => {
          removals += 1;
        },
      },
    ),
    /stage=temporary-toc-preparation cause=filesystem-preparation/u,
  );
  assert.equal(actionRuns, 0);
  assert.equal(removals, 0);

  let closes = 0;
  await assert.rejects(
    withRecoveryUseListFile(
      ARCHIVE_DIRECTORY,
      validTableOfContents,
      async () => {
        actionRuns += 1;
      },
      {
        closeFile: () => {
          closes += 1;
        },
        createName: () => `.codevivo-restore-${'c'.repeat(32)}.toc`,
        inspectFile: () => ({
          currentUser: 501,
          file: true,
          mode: 0o600,
          owner: 501,
        }),
        openFile: () => 9,
        removeFile: () => {
          removals += 1;
        },
        syncFile: () => undefined,
        verifyPath: () => undefined,
        writeFile: () => {
          throw new Error('write failed');
        },
      },
    ),
    /stage=temporary-toc-preparation cause=filesystem-preparation/u,
  );
  assert.equal(actionRuns, 0);
  assert.equal(closes, 1);
  assert.equal(removals, 1);
});

test('temporary use-list rejects pre-existing files and symlinks without removing them', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'codevivo-use-list-existing-'));
  const regularName = `.codevivo-restore-${'f'.repeat(32)}.toc`;
  const symlinkName = `.codevivo-restore-${'1'.repeat(32)}.toc`;
  const regularPath = join(directory, regularName);
  const symlinkPath = join(directory, symlinkName);
  writeFileSync(regularPath, 'existing', { mode: 0o600 });
  symlinkSync('/dev/null', symlinkPath);
  try {
    for (const name of [regularName, symlinkName]) {
      await assert.rejects(
        withRecoveryUseListFile(
          directory,
          validTableOfContents,
          async () => undefined,
          { createName: () => name },
        ),
        /stage=temporary-toc-preparation cause=filesystem-preparation/u,
      );
    }
    assert.equal(readFileSync(regularPath, 'utf8'), 'existing');
    assert.equal(lstatSync(symlinkPath).isSymbolicLink(), true);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test('temporary use-list rejects unsafe files and reports cleanup failures', async () => {
  let actionRuns = 0;
  let removals = 0;
  await assert.rejects(
    withRecoveryUseListFile(
      ARCHIVE_DIRECTORY,
      validTableOfContents,
      async () => {
        actionRuns += 1;
      },
      {
        closeFile: () => undefined,
        createName: () => `.codevivo-restore-${'d'.repeat(32)}.toc`,
        inspectFile: () => ({
          currentUser: 501,
          file: true,
          mode: 0o644,
          owner: 501,
        }),
        openFile: () => 10,
        removeFile: () => {
          removals += 1;
        },
      },
    ),
    /stage=temporary-toc-preparation cause=filesystem-preparation/u,
  );
  assert.equal(actionRuns, 0);
  assert.equal(removals, 1);

  await assert.rejects(
    withRecoveryUseListFile(
      ARCHIVE_DIRECTORY,
      validTableOfContents,
      async () => {
        actionRuns += 1;
      },
      {
        closeFile: () => undefined,
        createName: () => `.codevivo-restore-${'e'.repeat(32)}.toc`,
        inspectFile: () => ({
          currentUser: 501,
          file: true,
          mode: 0o600,
          owner: 501,
        }),
        openFile: () => 11,
        removeFile: () => {
          throw new Error('cleanup failed');
        },
        syncFile: () => undefined,
        verifyPath: () => undefined,
        writeFile: () => undefined,
      },
    ),
    /stage=temporary-toc-cleanup cause=filesystem-cleanup/u,
  );
  assert.equal(actionRuns, 1);
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
          return {
            archiveSha256: 'checksum',
            tableOfContents: validTableOfContents,
          };
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

  const signalledPipeline = new RecoveryPipelineError(
    'gpg',
    'decryption',
    null,
    'SIGTERM',
    'failed',
  );
  const diagnostic = new RecoveryDiagnosticError(
    'archive-full-stream-verification',
    'pipeline-failure',
    signalledPipeline,
  );
  assert.equal(
    diagnostic.message,
    'Recovery executor: stage=archive-full-stream-verification cause=pipeline-failure process=gpg category=decryption exit=none signal=SIGTERM stream=failed',
  );
  assert.doesNotMatch(diagnostic.message, /stderr|passphrase|credential/iu);
});

test('archive verification reports the exact sanitized failing stage', async () => {
  await assert.rejects(
    verifyRecoveryArchiveStreams('/synthetic/archive.gpg', {
      readCatalog: async () => 'unused',
      verifyFullStream: async () => {
        throw new RecoveryPipelineError(
          'gpg',
          'decryption',
          2,
          null,
          'complete',
        );
      },
    }),
    /stage=archive-full-stream-verification cause=pipeline-failure process=gpg category=decryption exit=2 signal=none stream=complete/u,
  );

  await assert.rejects(
    verifyRecoveryArchiveStreams('/synthetic/archive.gpg', {
      readCatalog: async () => {
        throw new RecoveryPipelineError(
          'pg_restore',
          'archive-format',
          1,
          null,
          'complete',
        );
      },
      verifyFullStream: async () => undefined,
    }),
    /stage=archive-catalog-extraction cause=pipeline-failure process=pg_restore category=archive-format exit=1 signal=none stream=complete/u,
  );
});

test('consumer failure wins only when GPG has corroborated broken-pipe evidence', () => {
  const failure = selectRecoveryPipelineFailure({
    consumerName: 'pg_restore',
    consumerStatus: 1,
    consumerStderr: 'permission denied while restoring sensitive-object',
    producerName: 'gpg',
    producerStatus: 2,
    producerStderr:
      "gpg: error writing to '-': Broken pipe\ngpg: decryption failed: Broken pipe",
    stream: { brokenPipe: true, failed: true },
  });
  assert.ok(failure);
  assert.equal(failure.processName, 'pg_restore');
  assert.equal(failure.category, 'permission-or-acl');
  assert.doesNotMatch(failure.message, /sensitive-object|broken pipe/iu);

  const insufficientEvidence = selectRecoveryPipelineFailure({
    consumerName: 'pg_restore',
    consumerStatus: 1,
    consumerStderr: 'permission denied',
    producerName: 'gpg',
    producerStatus: 2,
    producerStderr: 'gpg: decryption failed: Broken pipe',
    stream: { brokenPipe: false, failed: false },
  });
  assert.equal(insufficientEvidence?.processName, 'gpg');
  assert.equal(insufficientEvidence?.category, 'decryption');
});

test('successful early catalog completion accepts only an expected GPG broken pipe', () => {
  const evidence = {
    acceptSuccessfulEarlyConsumer: true,
    consumerName: 'pg_restore' as const,
    consumerStatus: 0,
    consumerStderr: '',
    producerName: 'gpg' as const,
    producerStatus: 2,
    producerStderr:
      "gpg: error writing to '-': Broken pipe\ngpg: decryption failed: Broken pipe",
    stream: { brokenPipe: true, failed: true },
  };
  assert.equal(selectRecoveryPipelineFailure(evidence), undefined);

  const withoutExplicitAllowance = selectRecoveryPipelineFailure({
    ...evidence,
    acceptSuccessfulEarlyConsumer: false,
  });
  assert.equal(withoutExplicitAllowance?.processName, 'gpg');

  const mixedGpgFailure = selectRecoveryPipelineFailure({
    ...evidence,
    producerStderr:
      "gpg: decryption failed: Bad session key\ngpg: error writing to '-': Broken pipe",
  });
  assert.equal(mixedGpgFailure?.processName, 'gpg');
  assert.equal(mixedGpgFailure?.category, 'decryption');

  const failedCatalog = selectRecoveryPipelineFailure({
    ...evidence,
    consumerStatus: 1,
    consumerStderr: 'input file appears to be truncated',
  });
  assert.equal(failedCatalog?.processName, 'pg_restore');
  assert.equal(failedCatalog?.category, 'archive-format');
});

test('genuine GPG decryption failure wins over truncated consumer input', () => {
  const failure = selectRecoveryPipelineFailure({
    consumerName: 'pg_restore',
    consumerStatus: 1,
    consumerStderr: 'input file appears to be truncated',
    producerName: 'gpg',
    producerStatus: 2,
    producerStderr: 'gpg: decryption failed: Bad session key secret-marker',
    stream: { brokenPipe: true, failed: true },
  });
  assert.ok(failure);
  assert.equal(failure.processName, 'gpg');
  assert.equal(failure.category, 'decryption');
  assert.doesNotMatch(failure.message, /secret-marker/u);
});

test(
  'full-stream archive verification detects wrong passphrases and truncated ciphertext',
  { timeout: 60_000 },
  async (context) => {
    const directory = mkdtempSync(join(tmpdir(), 'codevivo-gpg-verification-'));
    const archive = join(directory, 'synthetic.gpg');
    const truncatedArchive = join(directory, 'synthetic-truncated.gpg');
    const gpg = '/opt/homebrew/bin/gpg';
    const gpgconf = '/opt/homebrew/bin/gpgconf';
    const passphrase = 'offline-synthetic-fixture';
    const subprocessEnvironment: NodeJS.ProcessEnv = {
      GNUPGHOME: directory,
      HOME: process.env.HOME,
      LANG: process.env.LANG ?? 'C',
      NODE_ENV: 'test',
      PATH: process.env.PATH,
    };
    const decryptionArguments = (candidate: string, path: string) => [
      '--batch',
      '--no-symkey-cache',
      '--pinentry-mode',
      'loopback',
      '--passphrase',
      candidate,
      '--decrypt',
      '--output',
      '-',
      path,
    ];

    try {
      const encryption = spawnSync(
        gpg,
        [
          '--batch',
          '--yes',
          '--no-symkey-cache',
          '--pinentry-mode',
          'loopback',
          '--passphrase',
          passphrase,
          '--symmetric',
          '--compress-algo',
          'none',
          '--output',
          archive,
        ],
        {
          env: subprocessEnvironment,
          input: Buffer.alloc(1024 * 1024, 0x41),
          stdio: ['pipe', 'ignore', 'pipe'],
        },
      );
      assert.equal(encryption.status, 0, 'synthetic archive creation failed');

      await context.test('drains and verifies the complete plaintext stream', async () => {
        await assert.doesNotReject(
          verifyEncryptedArchiveStream(archive, {
            arguments: decryptionArguments(passphrase, archive),
            command: gpg,
            environment: subprocessEnvironment,
          }),
        );
      });

      await context.test('supports sequential full-stream verification', async () => {
        for (let run = 0; run < 2; run += 1) {
          await verifyEncryptedArchiveStream(archive, {
            arguments: decryptionArguments(passphrase, archive),
            command: gpg,
            environment: subprocessEnvironment,
          });
        }
      });

      await context.test(
        'accepts the producer broken pipe from a successful prefix consumer',
        async () => {
          const producer = spawn(
            gpg,
            decryptionArguments(passphrase, archive),
            {
              env: subprocessEnvironment,
              stdio: ['ignore', 'pipe', 'pipe'],
            },
          );
          const consumer = spawn('/usr/bin/head', ['-c', '1'], {
            env: subprocessEnvironment,
            stdio: ['pipe', 'ignore', 'pipe'],
          });
          assert.ok(producer.stdout);
          assert.ok(producer.stderr);
          assert.ok(consumer.stdin);
          assert.ok(consumer.stderr);
          let producerStderr = '';
          let consumerStderr = '';
          producer.stderr.setEncoding('utf8');
          consumer.stderr.setEncoding('utf8');
          producer.stderr.on('data', (chunk: string) => {
            producerStderr += chunk;
          });
          consumer.stderr.on('data', (chunk: string) => {
            consumerStderr += chunk;
          });
          const transfer = pipeline(producer.stdout, consumer.stdin).then(
            () => ({ brokenPipe: false, failed: false }),
            (error: unknown) => ({
              brokenPipe:
                typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                ['EPIPE', 'ERR_STREAM_PREMATURE_CLOSE'].includes(
                  String(error.code),
                ),
              failed: true,
            }),
          );
          const wait = (child: ReturnType<typeof spawn>) =>
            new Promise<number | null>((resolve, reject) => {
              child.once('error', reject);
              child.once('close', resolve);
            });
          const [producerStatus, consumerStatus, stream] = await Promise.all([
            wait(producer),
            wait(consumer),
            transfer,
          ]);
          assert.equal(consumerStatus, 0);
          assert.equal(producerStatus, 2);
          assert.deepEqual(stream, { brokenPipe: true, failed: true });
          assert.equal(
            selectRecoveryPipelineFailure({
              acceptSuccessfulEarlyConsumer: true,
              consumerName: 'pg_restore',
              consumerStatus,
              consumerStderr,
              producerName: 'gpg',
              producerStatus,
              producerStderr,
              stream,
            }),
            undefined,
          );
        },
      );

      await context.test('rejects a genuine wrong-passphrase failure', async () => {
        await assert.rejects(
          verifyEncryptedArchiveStream(archive, {
            arguments: decryptionArguments('incorrect-passphrase', archive),
            command: gpg,
            environment: subprocessEnvironment,
          }),
          (error: unknown) => {
            assert.ok(error instanceof RecoveryPipelineError);
            assert.equal(error.processName, 'gpg');
            return true;
          },
        );
      });

      copyFileSync(archive, truncatedArchive);
      truncateSync(
        truncatedArchive,
        Math.max(1, Math.floor(statSync(truncatedArchive).size / 2)),
      );
      await context.test('rejects truncated encrypted input', async () => {
        await assert.rejects(
          verifyEncryptedArchiveStream(truncatedArchive, {
            arguments: decryptionArguments(passphrase, truncatedArchive),
            command: gpg,
            environment: subprocessEnvironment,
          }),
          (error: unknown) => {
            assert.ok(error instanceof RecoveryPipelineError);
            assert.equal(error.processName, 'gpg');
            return true;
          },
        );
      });
    } finally {
      spawnSync(gpgconf, ['--homedir', directory, '--kill', 'gpg-agent'], {
        env: subprocessEnvironment,
        stdio: 'ignore',
      });
      rmSync(directory, { force: true, recursive: true });
    }
  },
);

test('restore preserves safe process attribution after an empty rollback', async () => {
  await assert.rejects(
    runRecoveryExecutor(
      'restore',
      environment('restore'),
      dependencies({
        verifyArchive: async () => ({
          archiveSha256: 'checksum',
          tableOfContents: validTableOfContents,
        }),
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
    /stage=database-restore-streaming cause=pipeline-failure process=pg_restore category=permission-or-acl exit=1 signal=none stream=not-applicable containment=transaction-rolled-back-empty/u,
  );
});

test('restore redacts unknown failure details after an empty rollback', async () => {
  await assert.rejects(
    runRecoveryExecutor(
      'restore',
      environment('restore'),
      dependencies({
        verifyArchive: async () => ({
          archiveSha256: 'checksum',
          tableOfContents: validTableOfContents,
        }),
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
      assert.match(
        error.message,
        /stage=database-restore-streaming cause=unexpected-failure containment=destination-empty-no-partial-restore/u,
      );
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
        verifyArchive: async () => ({
          archiveSha256: 'checksum',
          tableOfContents: validTableOfContents,
        }),
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
    /stage=rollback-inspection cause=partial-restore/u,
  );
});

test('restore reports rollback inspection failure without masking the stage', async () => {
  let inspections = 0;
  await assert.rejects(
    runRecoveryExecutor(
      'restore',
      environment('restore'),
      dependencies({
        inspectTarget: () => {
          inspections += 1;
          if (inspections > 1) throw new Error('sensitive inspection detail');
          return emptyTarget;
        },
        readManifest: () => ({
          archive: 'codevivo-exercise.pg18.dump.gpg',
          archiveSha256: 'checksum',
          createdAt: NOW.toISOString(),
          fixtures: RECOVERY_FIXTURES,
        }),
        restoreArchive: async () => {
          throw new Error('sensitive restore detail');
        },
        verifyArchive: async () => ({
          archiveSha256: 'checksum',
          tableOfContents: validTableOfContents,
        }),
      }),
    ),
    (error: unknown) => {
      assert.ok(error instanceof RecoveryDiagnosticError);
      assert.equal(error.stage, 'rollback-inspection');
      assert.equal(error.causeCode, 'inspection-failed');
      assert.doesNotMatch(error.message, /sensitive|detail/u);
      return true;
    },
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
