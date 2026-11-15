import { createHash } from 'node:crypto';
import {
  accessSync,
  constants as fsConstants,
  createReadStream,
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import {
  fetchRecoveryMetadata,
  MINIMUM_RECOVERY_LIFETIME_MS,
  RECOVERY_AUTHORIZATION,
  RECOVERY_BRANCH_ID,
  RECOVERY_DATABASE_NAME,
  RECOVERY_ENDPOINT_HOST,
  RECOVERY_ENDPOINT_ID,
  RECOVERY_KEYCHAIN_SERVICES,
  SOURCE_DATABASE_NAME,
  SOURCE_ENDPOINT_HOST,
  verifyRecoveryTestConfiguration,
  type RecoveryConnectionUrls,
  type VerifiedRecoveryTarget,
} from './discovery-recovery-guard';
import { readKeychainSecret } from './discovery-keychain';
import { runRecoveryTestLauncher } from './discovery-recovery-test';

export const RECOVERY_STAGES = [
  'preflight',
  'backup-source',
  'prepare-fixtures',
  'backup-exercise',
  'restore',
  'validate',
] as const;

export type RecoveryStage = (typeof RECOVERY_STAGES)[number];

const POSTGRES_BIN = '/opt/homebrew/opt/libpq/bin';
const PSQL = join(POSTGRES_BIN, 'psql');
const PG_DUMP = join(POSTGRES_BIN, 'pg_dump');
const PG_RESTORE = join(POSTGRES_BIN, 'pg_restore');
const GPG = '/opt/homebrew/bin/gpg';
const MIGRATION_ROLE = 'codevivo_discovery_migration';
const SOURCE_ARCHIVE = 'codevivo-source.pg18.dump.gpg';
const EXERCISE_ARCHIVE = 'codevivo-exercise.pg18.dump.gpg';
const SOURCE_MANIFEST = 'codevivo-source.manifest.json';
const EXERCISE_MANIFEST = 'codevivo-exercise.manifest.json';

export const RECOVERY_FIXTURES = {
  invitationId: 'b3b00000-0000-4000-8000-000000000001',
  sessionId: 'b3b00000-0000-4000-8000-000000000002',
  briefId: 'b3b00000-0000-4000-8000-000000000003',
  outboxId: 'b3b00000-0000-4000-8000-000000000004',
  marker: 'codevivo-recovery-gate-b3',
} as const;

interface RecoveryExecutorEnvironment {
  [key: string]: string | undefined;
  DISCOVERY_RECOVERY_ARCHIVE_DIR?: string;
  DISCOVERY_RECOVERY_BRANCH_ID?: string;
  DISCOVERY_RECOVERY_ENDPOINT_ID?: string;
  DISCOVERY_RECOVERY_STAGE_ALLOW?: string;
}

interface ArchiveDirectoryStatus {
  absolute: boolean;
  directory: boolean;
  mode: number;
  owner: number;
  currentUser: number;
  symbolicLink: boolean;
  insideRepository: boolean;
}

interface TargetState {
  database: string;
  user: string;
  owner: string;
  userTables: number;
  discoverySchemas: number;
}

interface RecoveryContext {
  archiveDirectory: string;
  connections: RecoveryConnectionUrls;
  cloneMigration: string;
  sourceMigration: string;
  target: VerifiedRecoveryTarget;
}

interface RecoveryManifest {
  archive: string;
  archiveSha256: string;
  createdAt: string;
  fingerprint?: Record<string, string | number>;
  fixtures?: typeof RECOVERY_FIXTURES;
}

type RecoveryProcessName = 'gpg' | 'pg_dump' | 'pg_restore';
type RecoveryProcessFailureCategory =
  | 'archive-format'
  | 'constraint'
  | 'decryption'
  | 'destination-not-empty'
  | 'missing-role'
  | 'permission-or-acl'
  | 'process-failed'
  | 'start-failed'
  | 'stream-failed';

interface RecoveryPipelineProcess {
  name: RecoveryProcessName;
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

export class RecoveryPipelineError extends Error {
  constructor(
    readonly processName: RecoveryProcessName,
    readonly category: RecoveryProcessFailureCategory,
    readonly exitCode: number | null,
  ) {
    const exit = exitCode === null ? '' : `; exit ${exitCode}`;
    super(`Recovery executor: ${processName} failed (${category}${exit})`);
    this.name = 'RecoveryPipelineError';
  }
}

function classifyRecoveryProcessFailure(
  processName: RecoveryProcessName,
  stderr: string,
): RecoveryProcessFailureCategory {
  if (
    processName === 'gpg' &&
    /bad passphrase|bad session key|cancel(?:led|ed)|decrypt(?:ion|_message) failed|no secret key/iu.test(
      stderr,
    )
  ) {
    return 'decryption';
  }
  if (processName === 'pg_restore') {
    if (
      /\bacl\b|default privileges|insufficient privilege|must be (?:a )?(?:member|owner)|not permitted|permission denied/iu.test(
        stderr,
      )
    ) {
      return 'permission-or-acl';
    }
    if (/role .* does not exist/iu.test(stderr)) return 'missing-role';
    if (/already exists|duplicate/iu.test(stderr)) {
      return 'destination-not-empty';
    }
    if (/constraint|violates/iu.test(stderr)) return 'constraint';
    if (
      /could not read from input|input file appears|unexpected end|unsupported version/iu.test(
        stderr,
      )
    ) {
      return 'archive-format';
    }
  }
  return 'process-failed';
}

export function recoveryProcessFailure(
  processName: RecoveryProcessName,
  exitCode: number | null,
  stderr: string,
): RecoveryPipelineError {
  return new RecoveryPipelineError(
    processName,
    classifyRecoveryProcessFailure(processName, stderr),
    exitCode,
  );
}

export interface RecoveryExecutorDependencies {
  now?: () => Date;
  readSecret?: typeof readKeychainSecret;
  fetchImplementation?: typeof fetch;
  inspectArchiveDirectory?: (path: string) => ArchiveDirectoryStatus;
  toolsAvailable?: () => boolean;
  inspectTarget?: (connection: string) => TargetState;
  fingerprintSource?: (connection: string) => Record<string, string | number>;
  createEncryptedBackup?: (
    connection: string,
    archivePath: string,
    readOnly: boolean,
  ) => Promise<void>;
  verifyArchive?: (archivePath: string) => Promise<string>;
  prepareFixtures?: (connection: string) => void;
  fixturesArePresent?: (connection: string) => boolean;
  restoreArchive?: (connection: string, archivePath: string) => Promise<void>;
  validateRecovery?: (connection: string) => boolean;
  readManifest?: (path: string) => RecoveryManifest;
  writeManifest?: (path: string, manifest: RecoveryManifest) => void;
  runGuardedTests?: (environment: NodeJS.ProcessEnv) => Promise<number>;
}

function required(value: string | undefined, label: string): string {
  if (!value) throw new Error(`Recovery executor: missing ${label}`);
  return value;
}

function safeBaseEnvironment(): NodeJS.ProcessEnv {
  const allowed = [
    'DISPLAY',
    'GPG_TTY',
    'GNUPGHOME',
    'HOME',
    'LANG',
    'LC_ALL',
    'PATH',
    'TERM',
    'TMPDIR',
    'USER',
  ] as const;
  return Object.fromEntries(
    allowed
      .filter((name) => process.env[name] !== undefined)
      .map((name) => [name, process.env[name]]),
  ) as NodeJS.ProcessEnv;
}

function parseConnection(
  connection: string,
  expected: { hostname: string; database: string; role: string },
): URL {
  let url: URL;
  try {
    url = new URL(connection);
  } catch {
    throw new Error('Recovery executor: malformed database credential');
  }

  const parameters = [...url.searchParams.keys()];
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== expected.hostname ||
    url.hostname.includes('-pooler') ||
    decodeURIComponent(url.pathname.slice(1)) !== expected.database ||
    decodeURIComponent(url.username) !== expected.role ||
    parameters.some(
      (parameter) => !['channel_binding', 'sslmode'].includes(parameter),
    )
  ) {
    throw new Error('Recovery executor: unsafe database credential');
  }
  return url;
}

function connectionEnvironment(url: URL, readOnly: boolean): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...safeBaseEnvironment(),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGHOST: url.hostname,
    PGPASSWORD: decodeURIComponent(url.password),
    PGPORT: url.port || '5432',
    PGSSLMODE: url.searchParams.get('sslmode') ?? 'require',
    PGUSER: decodeURIComponent(url.username),
  };
  if (readOnly) environment.PGOPTIONS = '-c default_transaction_read_only=on';
  return environment;
}

function cloneConnection(recoveryMigration: string): string {
  const url = parseConnection(recoveryMigration, {
    hostname: RECOVERY_ENDPOINT_HOST,
    database: RECOVERY_DATABASE_NAME,
    role: MIGRATION_ROLE,
  });
  url.pathname = `/${SOURCE_DATABASE_NAME}`;
  return url.toString();
}

export function assertSafeToolArguments(tool: string, args: string[]): void {
  const joined = args.join(' ');
  if (
    /postgres(?:ql)?:\/\//iu.test(joined) ||
    /password=/iu.test(joined) ||
    joined.includes(SOURCE_ENDPOINT_HOST) ||
    joined.includes(RECOVERY_ENDPOINT_HOST)
  ) {
    throw new Error('Recovery executor: credential or hostname in arguments');
  }

  if (
    tool === PG_RESTORE &&
    args.some((argument) =>
      ['--clean', '--create', '-c', '-C'].includes(argument),
    )
  ) {
    throw new Error('Recovery executor: unsafe pg_restore argument');
  }
}

function runPsql(connection: string, sql: string, readOnly: boolean): string {
  const url = new URL(connection);
  const result = spawnSync(
    PSQL,
    ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At'],
    {
      encoding: 'utf8',
      env: connectionEnvironment(url, readOnly),
      input: sql,
      maxBuffer: 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60_000,
    },
  );
  if (result.error || result.status !== 0) {
    throw new Error('Recovery executor: PostgreSQL operation failed');
  }
  return result.stdout.trim();
}

function inspectTarget(connection: string): TargetState {
  const output = runPsql(
    connection,
    `BEGIN READ ONLY;
SELECT json_build_object(
  'database', current_database(),
  'user', current_user,
  'owner', (
    SELECT owner.rolname
    FROM pg_database database
    JOIN pg_roles owner ON owner.oid = database.datdba
    WHERE database.datname = current_database()
  ),
  'userTables', (
    SELECT count(*)
    FROM pg_class object
    JOIN pg_namespace schema ON schema.oid = object.relnamespace
    WHERE schema.nspname NOT IN ('pg_catalog', 'information_schema')
      AND schema.nspname !~ '^pg_toast'
      AND object.relkind IN ('r', 'p')
  ),
  'discoverySchemas', (
    SELECT count(*) FROM pg_namespace WHERE nspname = 'discovery'
  )
);
COMMIT;`,
    true,
  );
  return JSON.parse(output.split('\n').find((line) => line.startsWith('{')) ?? '{}') as TargetState;
}

function assertEmptyTarget(state: TargetState): void {
  if (
    state.database !== RECOVERY_DATABASE_NAME ||
    state.user !== MIGRATION_ROLE ||
    state.owner !== MIGRATION_ROLE ||
    Number(state.userTables) !== 0 ||
    Number(state.discoverySchemas) !== 0
  ) {
    throw new Error('Recovery executor: restore destination is not empty');
  }
}

function sourceFingerprint(connection: string): Record<string, string | number> {
  const output = runPsql(
    connection,
    `BEGIN READ ONLY;
SELECT json_build_object(
  'database', current_database(),
  'invitations', (SELECT count(*) FROM discovery.invitations),
  'sessions', (SELECT count(*) FROM discovery.sessions),
  'briefs', (SELECT count(*) FROM discovery.project_briefs),
  'outbox', (SELECT count(*) FROM discovery.notification_outbox),
  'invitationHash', (
    SELECT md5(coalesce(string_agg(to_jsonb(row)::text, '|' ORDER BY row.id), ''))
    FROM discovery.invitations row
  ),
  'sessionHash', (
    SELECT md5(coalesce(string_agg(to_jsonb(row)::text, '|' ORDER BY row.id), ''))
    FROM discovery.sessions row
  ),
  'briefHash', (
    SELECT md5(coalesce(string_agg(to_jsonb(row)::text, '|' ORDER BY row.id), ''))
    FROM discovery.project_briefs row
  ),
  'outboxHash', (
    SELECT md5(coalesce(string_agg(to_jsonb(row)::text, '|' ORDER BY row.id), ''))
    FROM discovery.notification_outbox row
  )
);
COMMIT;`,
    true,
  );
  return JSON.parse(output.split('\n').find((line) => line.startsWith('{')) ?? '{}') as Record<string, string | number>;
}

async function processPipeline(
  left: RecoveryPipelineProcess,
  right: RecoveryPipelineProcess,
): Promise<void> {
  assertSafeToolArguments(left.command, left.args);
  assertSafeToolArguments(right.command, right.args);

  const producer = spawn(left.command, left.args, {
    env: left.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const consumer = spawn(right.command, right.args, {
    env: right.env,
    stdio: ['pipe', 'ignore', 'pipe'],
  });

  const stderr = new Map<RecoveryProcessName, string>();
  const captureStderr = (
    name: RecoveryProcessName,
    stream: NodeJS.ReadableStream,
  ) => {
    let captured = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk: string) => {
      if (captured.length < 65_536) {
        captured += chunk.slice(0, 65_536 - captured.length);
      }
    });
    stream.once('end', () => stderr.set(name, captured));
  };
  captureStderr(left.name, producer.stderr);
  captureStderr(right.name, consumer.stderr);

  const transfer = pipeline(producer.stdout, consumer.stdin).then(
    () => false,
    () => true,
  );

  const wait = (
    child: ReturnType<typeof spawn>,
    processName: RecoveryProcessName,
  ) =>
    new Promise<number | null>((resolvePromise, rejectPromise) => {
      child.once('error', () =>
        rejectPromise(
          new RecoveryPipelineError(processName, 'start-failed', null),
        ),
      );
      child.once('close', resolvePromise);
    });
  const [producerStatus, consumerStatus, streamFailed] = await Promise.all([
    wait(producer, left.name),
    wait(consumer, right.name),
    transfer,
  ]);

  const producerFailure = recoveryProcessFailure(
    left.name,
    producerStatus,
    stderr.get(left.name) ?? '',
  );
  const consumerFailure = recoveryProcessFailure(
    right.name,
    consumerStatus,
    stderr.get(right.name) ?? '',
  );
  if (producerStatus !== 0 && producerFailure.category !== 'process-failed') {
    throw producerFailure;
  }
  if (consumerStatus !== 0 && consumerFailure.category !== 'process-failed') {
    throw consumerFailure;
  }
  if (producerStatus !== 0) throw producerFailure;
  if (consumerStatus !== 0) throw consumerFailure;
  if (streamFailed) {
    throw new RecoveryPipelineError(right.name, 'stream-failed', null);
  }
}

async function createEncryptedBackup(
  connection: string,
  archivePath: string,
  readOnly: boolean,
): Promise<void> {
  if (existsSync(archivePath)) {
    throw new Error('Recovery executor: archive already exists');
  }
  const url = new URL(connection);
  const previousUmask = process.umask(0o077);
  try {
    await processPipeline(
      {
        name: 'pg_dump',
        command: PG_DUMP,
        args: [
          '--format=custom',
          '--no-owner',
          '--no-password',
          `--dbname=${decodeURIComponent(url.pathname.slice(1))}`,
        ],
        env: connectionEnvironment(url, readOnly),
      },
      {
        name: 'gpg',
        command: GPG,
        args: [
          '--symmetric',
          '--cipher-algo',
          'AES256',
          '--compress-algo',
          'none',
          '--output',
          archivePath,
        ],
        env: safeBaseEnvironment(),
      },
    );
  } finally {
    process.umask(previousUmask);
  }
  if ((statSync(archivePath).mode & 0o077) !== 0) {
    throw new Error('Recovery executor: encrypted archive permissions are unsafe');
  }
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const stream = createReadStream(path);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.once('error', rejectPromise);
    stream.once('end', resolvePromise);
  });
  return hash.digest('hex');
}

function assertPrivateFile(path: string): void {
  const link = lstatSync(path);
  const status = statSync(path);
  if (
    link.isSymbolicLink() ||
    !status.isFile() ||
    (status.mode & 0o077) !== 0 ||
    status.uid !== (process.getuid?.() ?? status.uid)
  ) {
    throw new Error('Recovery executor: recovery artifact permissions are unsafe');
  }
}

async function verifyArchive(archivePath: string): Promise<string> {
  if (!existsSync(archivePath)) {
    throw new Error('Recovery executor: encrypted archive is missing');
  }
  assertPrivateFile(archivePath);
  await processPipeline(
    {
      name: 'gpg',
      command: GPG,
      args: ['--quiet', '--decrypt', '--output', '-', archivePath],
      env: safeBaseEnvironment(),
    },
    {
      name: 'pg_restore',
      command: PG_RESTORE,
      args: ['--list'],
      env: safeBaseEnvironment(),
    },
  );
  const checksum = await sha256File(archivePath);
  const checksumPath = `${archivePath}.sha256`;
  const checksumRecord = `${checksum}  ${archivePath.split('/').at(-1)}\n`;
  if (existsSync(checksumPath)) {
    assertPrivateFile(checksumPath);
    if (readFileSync(checksumPath, 'utf8') !== checksumRecord) {
      throw new Error('Recovery executor: archive checksum mismatch');
    }
  } else {
    writeFileSync(checksumPath, checksumRecord, { flag: 'wx', mode: 0o600 });
  }
  return checksum;
}

function prepareFixtures(connection: string): void {
  runPsql(
    connection,
    `BEGIN;
DO $guard$
BEGIN
  IF current_database() <> '${SOURCE_DATABASE_NAME}'
     OR current_user <> '${MIGRATION_ROLE}' THEN
    RAISE EXCEPTION 'unsafe fixture target';
  END IF;
  IF EXISTS (
    SELECT 1 FROM discovery.invitations
    WHERE id = '${RECOVERY_FIXTURES.invitationId}'
  ) THEN
    RAISE EXCEPTION 'recovery fixture already exists';
  END IF;
END
$guard$;
INSERT INTO discovery.invitations (
  id, token_hash, client_name, client_email, preferred_locale, expires_at
) VALUES (
  '${RECOVERY_FIXTURES.invitationId}',
  decode(repeat('b3', 32), 'hex'),
  'Recovery Gate Fixture',
  'recovery-gate@example.invalid',
  'en',
  now() + interval '14 days'
);
INSERT INTO discovery.sessions (
  id, credential_hash, invitation_id, token_generation, expires_at
) VALUES (
  '${RECOVERY_FIXTURES.sessionId}',
  decode(repeat('c4', 32), 'hex'),
  '${RECOVERY_FIXTURES.invitationId}',
  1,
  now() + interval '12 hours'
);
INSERT INTO discovery.project_briefs (
  id, invitation_id, schema_version, locale, answers
) VALUES (
  '${RECOVERY_FIXTURES.briefId}',
  '${RECOVERY_FIXTURES.invitationId}',
  '1.0',
  'en',
  '{"marker":"${RECOVERY_FIXTURES.marker}"}'::jsonb
);
INSERT INTO discovery.notification_outbox (
  id, brief_id, event_type, idempotency_key
) VALUES (
  '${RECOVERY_FIXTURES.outboxId}',
  '${RECOVERY_FIXTURES.briefId}',
  'recovery.validation',
  '${RECOVERY_FIXTURES.marker}'
);
COMMIT;`,
    false,
  );
}

function fixturesArePresent(connection: string): boolean {
  const output = runPsql(
    connection,
    `BEGIN READ ONLY;
SELECT (
  (SELECT count(*) FROM discovery.invitations WHERE id = '${RECOVERY_FIXTURES.invitationId}') = 1
  AND (SELECT count(*) FROM discovery.sessions WHERE id = '${RECOVERY_FIXTURES.sessionId}') = 1
  AND (SELECT count(*) FROM discovery.project_briefs
       WHERE id = '${RECOVERY_FIXTURES.briefId}'
         AND answers = '{"marker":"${RECOVERY_FIXTURES.marker}"}'::jsonb) = 1
  AND (SELECT count(*) FROM discovery.notification_outbox
       WHERE id = '${RECOVERY_FIXTURES.outboxId}'
         AND idempotency_key = '${RECOVERY_FIXTURES.marker}') = 1
);
COMMIT;`,
    true,
  );
  return output.split('\n').includes('t');
}

async function restoreArchive(connection: string, archivePath: string): Promise<void> {
  const url = new URL(connection);
  await processPipeline(
    {
      name: 'gpg',
      command: GPG,
      args: ['--quiet', '--decrypt', '--output', '-', archivePath],
      env: safeBaseEnvironment(),
    },
    {
      name: 'pg_restore',
      command: PG_RESTORE,
      args: [
        '--exit-on-error',
        '--single-transaction',
        '--no-owner',
        `--dbname=${RECOVERY_DATABASE_NAME}`,
      ],
      env: connectionEnvironment(url, false),
    },
  );
}

function migrationChecksum(): string {
  return createHash('sha256')
    .update(readFileSync('db/migrations/0001_project_discovery_foundation.sql'))
    .digest('hex');
}

function validateRecovery(connection: string): boolean {
  const expectedChecksum = migrationChecksum();
  const output = runPsql(
    connection,
    `BEGIN READ ONLY;
SELECT json_build_object(
  'migration', EXISTS (
    SELECT 1 FROM discovery.schema_migrations
    WHERE version = '0001_project_discovery_foundation.sql'
      AND checksum = '${expectedChecksum}'
  ),
  'tables', (SELECT count(*) FROM pg_class object JOIN pg_namespace schema
    ON schema.oid = object.relnamespace
    WHERE schema.nspname = 'discovery' AND object.relkind IN ('r', 'p')),
  'indexes', (SELECT count(*) FROM pg_class object JOIN pg_namespace schema
    ON schema.oid = object.relnamespace
    WHERE schema.nspname = 'discovery' AND object.relkind = 'i'),
  'constraints', (SELECT count(*) FROM pg_constraint constraint_object
    JOIN pg_namespace schema ON schema.oid = constraint_object.connamespace
    WHERE schema.nspname = 'discovery'),
  'triggers', (SELECT count(*) FROM pg_trigger trigger_object
    JOIN pg_class relation ON relation.oid = trigger_object.tgrelid
    JOIN pg_namespace schema ON schema.oid = relation.relnamespace
    WHERE schema.nspname = 'discovery' AND NOT trigger_object.tgisinternal),
  'owners', (
    SELECT bool_and(owner.rolname = '${MIGRATION_ROLE}')
    FROM pg_class object
    JOIN pg_namespace schema ON schema.oid = object.relnamespace
    JOIN pg_roles owner ON owner.oid = object.relowner
    WHERE schema.nspname = 'discovery'
  ),
  'schemaOwner', (
    SELECT owner.rolname = '${MIGRATION_ROLE}'
    FROM pg_namespace schema JOIN pg_roles owner ON owner.oid = schema.nspowner
    WHERE schema.nspname = 'discovery'
  ),
  'runtimeAcl',
    has_schema_privilege('codevivo_discovery_runtime', 'discovery', 'USAGE')
    AND NOT has_schema_privilege('codevivo_discovery_runtime', 'discovery', 'CREATE')
    AND has_table_privilege('codevivo_discovery_runtime', 'discovery.project_briefs', 'SELECT')
    AND NOT has_table_privilege('codevivo_discovery_runtime', 'discovery.invitations', 'INSERT'),
  'adminAcl',
    has_schema_privilege('codevivo_discovery_admin', 'discovery', 'USAGE')
    AND NOT has_schema_privilege('codevivo_discovery_admin', 'discovery', 'CREATE')
    AND has_table_privilege('codevivo_discovery_admin', 'discovery.invitations', 'INSERT')
    AND NOT has_table_privilege('codevivo_discovery_admin', 'discovery.project_briefs', 'UPDATE')
);
COMMIT;`,
    true,
  );
  const validation = JSON.parse(
    output.split('\n').find((line) => line.startsWith('{')) ?? '{}',
  ) as Record<string, boolean | number>;
  return (
    validation.migration === true &&
    Number(validation.tables) === 5 &&
    Number(validation.indexes) === 19 &&
    Number(validation.constraints) === 74 &&
    Number(validation.triggers) === 5 &&
    validation.owners === true &&
    validation.schemaOwner === true &&
    validation.runtimeAcl === true &&
    validation.adminAcl === true &&
    fixturesArePresent(connection)
  );
}

function archiveDirectoryStatus(path: string): ArchiveDirectoryStatus {
  const repository = realpathSync(process.cwd());
  const resolved = resolve(path);
  const link = lstatSync(resolved);
  const status = statSync(resolved);
  const real = realpathSync(resolved);
  const relativePath = relative(repository, real);
  return {
    absolute: isAbsolute(path),
    directory: status.isDirectory(),
    mode: status.mode & 0o777,
    owner: status.uid,
    currentUser: process.getuid?.() ?? status.uid,
    symbolicLink: link.isSymbolicLink(),
    insideRepository:
      relativePath === '' ||
      (!relativePath.startsWith('..') && !isAbsolute(relativePath)),
  };
}

function toolsAvailable(): boolean {
  try {
    for (const tool of [GPG, PG_DUMP, PG_RESTORE, PSQL]) {
      accessSync(tool, fsConstants.X_OK);
    }
    return true;
  } catch {
    return false;
  }
}

function assertArchiveDirectory(status: ArchiveDirectoryStatus): void {
  if (
    !status.absolute ||
    !status.directory ||
    status.mode !== 0o700 ||
    status.owner !== status.currentUser ||
    status.symbolicLink ||
    status.insideRepository
  ) {
    throw new Error('Recovery executor: archive directory is unsafe');
  }
}

function writeManifest(path: string, manifest: RecoveryManifest): void {
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  });
}

function readManifest(path: string): RecoveryManifest {
  assertPrivateFile(path);
  return JSON.parse(readFileSync(path, 'utf8')) as RecoveryManifest;
}

function assertStageAuthorization(
  stage: RecoveryStage,
  environment: RecoveryExecutorEnvironment,
): void {
  if (stage === 'preflight') return;
  if (
    environment.DISCOVERY_RECOVERY_STAGE_ALLOW !==
    `${stage}:${RECOVERY_AUTHORIZATION}`
  ) {
    throw new Error(`Recovery executor: ${stage} authorization is required`);
  }
}

async function buildContext(
  environment: RecoveryExecutorEnvironment,
  dependencies: RecoveryExecutorDependencies,
): Promise<RecoveryContext> {
  if (environment.DISCOVERY_RECOVERY_BRANCH_ID !== RECOVERY_BRANCH_ID) {
    throw new Error('Recovery executor: invalid recovery branch ID');
  }
  if (environment.DISCOVERY_RECOVERY_ENDPOINT_ID !== RECOVERY_ENDPOINT_ID) {
    throw new Error('Recovery executor: invalid recovery endpoint ID');
  }

  const archiveDirectory = required(
    environment.DISCOVERY_RECOVERY_ARCHIVE_DIR,
    'archive directory',
  );
  assertArchiveDirectory(
    (dependencies.inspectArchiveDirectory ?? archiveDirectoryStatus)(
      archiveDirectory,
    ),
  );
  if (!(dependencies.toolsAvailable ?? toolsAvailable)()) {
    throw new Error('Recovery executor: required PostgreSQL or GnuPG tool missing');
  }

  const readSecret = dependencies.readSecret ?? readKeychainSecret;
  const apiKey = required(
    readSecret(RECOVERY_KEYCHAIN_SERVICES.apiKey),
    'Neon API credential',
  );
  const connections = {
    runtime: required(
      readSecret(RECOVERY_KEYCHAIN_SERVICES.runtime),
      'runtime credential',
    ),
    admin: required(
      readSecret(RECOVERY_KEYCHAIN_SERVICES.admin),
      'administration credential',
    ),
    migration: required(
      readSecret(RECOVERY_KEYCHAIN_SERVICES.migration),
      'migration credential',
    ),
  };
  const sourceMigration = required(
    readSecret(RECOVERY_KEYCHAIN_SERVICES.sourceMigration),
    'source migration credential',
  );
  parseConnection(sourceMigration, {
    hostname: SOURCE_ENDPOINT_HOST,
    database: SOURCE_DATABASE_NAME,
    role: MIGRATION_ROLE,
  });

  const metadata = await fetchRecoveryMetadata({
    apiKey,
    branchId: RECOVERY_BRANCH_ID,
    fetchImplementation: dependencies.fetchImplementation,
  });
  const target = verifyRecoveryTestConfiguration({
    environment: {
      DISCOVERY_RECOVERY_TEST_ALLOW: RECOVERY_AUTHORIZATION,
      DISCOVERY_RECOVERY_BRANCH_ID: environment.DISCOVERY_RECOVERY_BRANCH_ID,
      DISCOVERY_RECOVERY_ENDPOINT_ID: environment.DISCOVERY_RECOVERY_ENDPOINT_ID,
    },
    metadata,
    connections,
    minimumRemainingMs: MINIMUM_RECOVERY_LIFETIME_MS,
    now: (dependencies.now ?? (() => new Date()))(),
  });
  const cloneMigration = cloneConnection(connections.migration);
  parseConnection(cloneMigration, {
    hostname: RECOVERY_ENDPOINT_HOST,
    database: SOURCE_DATABASE_NAME,
    role: MIGRATION_ROLE,
  });
  return {
    archiveDirectory,
    cloneMigration,
    connections,
    sourceMigration,
    target,
  };
}

export async function runRecoveryExecutor(
  stage: RecoveryStage,
  environment: RecoveryExecutorEnvironment,
  dependencies: RecoveryExecutorDependencies = {},
): Promise<void> {
  assertStageAuthorization(stage, environment);
  const context = await buildContext(environment, dependencies);
  const inspect = dependencies.inspectTarget ?? inspectTarget;
  const fingerprint = dependencies.fingerprintSource ?? sourceFingerprint;
  const backup = dependencies.createEncryptedBackup ?? createEncryptedBackup;
  const verify = dependencies.verifyArchive ?? verifyArchive;
  const addFixtures = dependencies.prepareFixtures ?? prepareFixtures;
  const fixtures = dependencies.fixturesArePresent ?? fixturesArePresent;
  const restore = dependencies.restoreArchive ?? restoreArchive;
  const validate = dependencies.validateRecovery ?? validateRecovery;
  const loadManifest = dependencies.readManifest ?? readManifest;
  const saveManifest = dependencies.writeManifest ?? writeManifest;

  const sourceArchive = join(context.archiveDirectory, SOURCE_ARCHIVE);
  const exerciseArchive = join(context.archiveDirectory, EXERCISE_ARCHIVE);
  const sourceManifestPath = join(context.archiveDirectory, SOURCE_MANIFEST);
  const exerciseManifestPath = join(context.archiveDirectory, EXERCISE_MANIFEST);

  if (stage === 'preflight') {
    assertEmptyTarget(inspect(context.connections.migration));
    return;
  }

  if (stage === 'backup-source') {
    const sourceState = fingerprint(context.sourceMigration);
    await backup(context.sourceMigration, sourceArchive, true);
    const archiveSha256 = await verify(sourceArchive);
    if (
      JSON.stringify(sourceState) !==
      JSON.stringify(fingerprint(context.sourceMigration))
    ) {
      throw new Error('Recovery executor: source changed during backup');
    }
    saveManifest(sourceManifestPath, {
      archive: SOURCE_ARCHIVE,
      archiveSha256,
      createdAt: (dependencies.now ?? (() => new Date()))().toISOString(),
      fingerprint: sourceState,
    });
    return;
  }

  if (stage === 'prepare-fixtures') {
    addFixtures(context.cloneMigration);
    if (!fixtures(context.cloneMigration)) {
      throw new Error('Recovery executor: fixture transaction validation failed');
    }
    return;
  }

  if (stage === 'backup-exercise') {
    if (!fixtures(context.cloneMigration)) {
      throw new Error('Recovery executor: recovery fixtures are missing');
    }
    await backup(context.cloneMigration, exerciseArchive, true);
    const archiveSha256 = await verify(exerciseArchive);
    saveManifest(exerciseManifestPath, {
      archive: EXERCISE_ARCHIVE,
      archiveSha256,
      createdAt: (dependencies.now ?? (() => new Date()))().toISOString(),
      fixtures: RECOVERY_FIXTURES,
    });
    return;
  }

  if (stage === 'restore') {
    assertEmptyTarget(inspect(context.connections.migration));
    const exerciseManifest = loadManifest(exerciseManifestPath);
    const archiveSha256 = await verify(exerciseArchive);
    if (
      exerciseManifest.archive !== EXERCISE_ARCHIVE ||
      exerciseManifest.archiveSha256 !== archiveSha256 ||
      JSON.stringify(exerciseManifest.fixtures) !==
        JSON.stringify(RECOVERY_FIXTURES)
    ) {
      throw new Error('Recovery executor: exercise archive manifest mismatch');
    }
    try {
      await restore(context.connections.migration, exerciseArchive);
    } catch (error) {
      const state = inspect(context.connections.migration);
      if (Number(state.userTables) !== 0 || Number(state.discoverySchemas) !== 0) {
        throw new Error('Recovery executor: partial restore detected');
      }
      if (error instanceof RecoveryPipelineError) {
        const containment =
          error.processName === 'pg_restore' &&
          !['start-failed', 'stream-failed'].includes(error.category)
            ? 'restore transaction rolled back; destination remained empty'
            : 'destination remained empty; no partial restore detected';
        throw new Error(`${error.message}; ${containment}`);
      }
      throw new Error('Recovery executor: restore failed and rolled back');
    }
    if (Number(inspect(context.connections.migration).userTables) === 0) {
      throw new Error('Recovery executor: restore produced no user tables');
    }
    return;
  }

  if (!validate(context.connections.migration)) {
    throw new Error('Recovery executor: restored database validation failed');
  }
  const sourceManifest = loadManifest(sourceManifestPath);
  if (
    !sourceManifest.fingerprint ||
    JSON.stringify(sourceManifest.fingerprint) !==
      JSON.stringify(fingerprint(context.sourceMigration))
  ) {
    throw new Error('Recovery executor: original source fingerprint changed');
  }
  const runTests =
    dependencies.runGuardedTests ??
    ((testEnvironment: NodeJS.ProcessEnv) =>
      runRecoveryTestLauncher(testEnvironment));
  const testStatus = await runTests({
    ...process.env,
    DISCOVERY_RECOVERY_TEST_ALLOW: RECOVERY_AUTHORIZATION,
    DISCOVERY_RECOVERY_BRANCH_ID: RECOVERY_BRANCH_ID,
    DISCOVERY_RECOVERY_ENDPOINT_ID: RECOVERY_ENDPOINT_ID,
  });
  if (testStatus !== 0 || !validate(context.connections.migration)) {
    throw new Error('Recovery executor: guarded recovery tests failed');
  }
  if (
    JSON.stringify(sourceManifest.fingerprint) !==
    JSON.stringify(fingerprint(context.sourceMigration))
  ) {
    throw new Error('Recovery executor: source changed during validation');
  }
}

function parseStage(value: string | undefined): RecoveryStage {
  if (!value || !RECOVERY_STAGES.includes(value as RecoveryStage)) {
    throw new Error(
      `Usage: npm run discovery:recovery -- ${RECOVERY_STAGES.join('|')}`,
    );
  }
  return value as RecoveryStage;
}

const isMainModule =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  runRecoveryExecutor(parseStage(process.argv[2]), process.env).catch(
    (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Recovery executor failed';
      console.error(message);
      process.exitCode = 1;
    },
  );
}
