import { createHash, randomBytes } from 'node:crypto';
import {
  accessSync,
  closeSync,
  constants as fsConstants,
  createReadStream,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { Readable, Writable } from 'node:stream';
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

interface RecoveryArchiveVerification {
  archiveSha256: string;
  tableOfContents: string;
}

type RecoveryProcessName = 'gpg' | 'pg_dump' | 'pg_restore' | 'sink';
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

export type RecoveryDiagnosticStage =
  | 'archive-full-stream-verification'
  | 'archive-catalog-extraction'
  | 'toc-filtering'
  | 'database-restore-streaming'
  | 'temporary-toc-preparation'
  | 'temporary-toc-cleanup'
  | 'rollback-inspection';

export type RecoveryDiagnosticCause =
  | 'catalog-validation'
  | 'filesystem-cleanup'
  | 'filesystem-preparation'
  | 'inspection-failed'
  | 'partial-restore'
  | 'pipeline-failure'
  | 'unexpected-failure';

type RecoveryStreamState =
  | 'broken-pipe'
  | 'complete'
  | 'failed'
  | 'not-applicable';

export type RecoveryGpgFailureDetail =
  | 'agent-or-pinentry'
  | 'bad-session-key'
  | 'broken-pipe'
  | 'cancelled'
  | 'credential-unavailable'
  | 'generic-decryption'
  | 'integrity-failure';

interface RecoveryPipelineProcess {
  name: RecoveryProcessName;
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

interface RecoveryPipelineOptions {
  acceptSuccessfulEarlyConsumer?: boolean;
  captureConsumerStdout?: boolean;
}

export interface RecoveryStreamResult {
  brokenPipe: boolean;
  failed: boolean;
}

interface UseListFileStatus {
  currentUser: number;
  file: boolean;
  mode: number;
  owner: number;
}

export interface RecoveryUseListDependencies {
  closeFile?: (descriptor: number) => void;
  createName?: () => string;
  inspectFile?: (descriptor: number) => UseListFileStatus;
  openFile?: (path: string) => number;
  removeFile?: (path: string) => void;
  syncFile?: (descriptor: number) => void;
  verifyPath?: (path: string) => void;
  writeFile?: (descriptor: number, contents: string) => void;
}

export interface ArchiveVerificationOptions {
  arguments?: string[];
  command?: string;
  environment?: NodeJS.ProcessEnv;
  sinkCommand?: string;
}

export interface RecoveryArchiveStreamDependencies {
  readCatalog?: (archivePath: string) => Promise<string>;
  verifyFullStream?: (archivePath: string) => Promise<void>;
}

export class RecoveryPipelineError extends Error {
  constructor(
    readonly processName: RecoveryProcessName,
    readonly category: RecoveryProcessFailureCategory,
    readonly exitCode: number | null,
    readonly signal: NodeJS.Signals | null = null,
    readonly streamState: RecoveryStreamState = 'not-applicable',
    readonly detailCode?: RecoveryGpgFailureDetail,
  ) {
    const exit = exitCode === null ? '' : `; exit ${exitCode}`;
    super(`Recovery executor: ${processName} failed (${category}${exit})`);
    this.name = 'RecoveryPipelineError';
  }
}

export class RecoveryDiagnosticError extends Error {
  constructor(
    readonly stage: RecoveryDiagnosticStage,
    readonly causeCode: RecoveryDiagnosticCause,
    readonly pipelineFailure?: RecoveryPipelineError,
  ) {
    const pipeline = pipelineFailure
      ? ` process=${pipelineFailure.processName} category=${pipelineFailure.category}` +
        ` exit=${pipelineFailure.exitCode ?? 'none'}` +
        ` signal=${pipelineFailure.signal ?? 'none'}` +
        ` stream=${pipelineFailure.streamState}` +
        (pipelineFailure.detailCode
          ? ` detail=${pipelineFailure.detailCode}`
          : '')
      : '';
    super(`Recovery executor: stage=${stage} cause=${causeCode}${pipeline}`);
    this.name = 'RecoveryDiagnosticError';
  }
}

function diagnosticFailure(
  stage: RecoveryDiagnosticStage,
  error: unknown,
  causeCode: RecoveryDiagnosticCause = 'unexpected-failure',
): RecoveryDiagnosticError {
  if (error instanceof RecoveryDiagnosticError) return error;
  if (error instanceof RecoveryPipelineError) {
    return new RecoveryDiagnosticError(stage, 'pipeline-failure', error);
  }
  return new RecoveryDiagnosticError(stage, causeCode);
}

async function withinDiagnosticStage<T>(
  stage: RecoveryDiagnosticStage,
  operation: () => Promise<T>,
  causeCode: RecoveryDiagnosticCause = 'unexpected-failure',
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw diagnosticFailure(stage, error, causeCode);
  }
}

function withinDiagnosticStageSync<T>(
  stage: RecoveryDiagnosticStage,
  operation: () => T,
  causeCode: RecoveryDiagnosticCause = 'unexpected-failure',
): T {
  try {
    return operation();
  } catch (error) {
    throw diagnosticFailure(stage, error, causeCode);
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

function classifyGpgFailureDetail(
  stderr: string,
  streamState: RecoveryStreamState,
): RecoveryGpgFailureDetail | undefined {
  if (
    streamState === 'broken-pipe' &&
    /broken pipe|error writing to ['"]?-['"]?|handle plaintext failed/iu.test(stderr)
  ) {
    return 'broken-pipe';
  }
  if (/bad mdc|manipulated|integrity|invalid packet|crc error/iu.test(stderr)) {
    return 'integrity-failure';
  }
  if (/pinentry|problem with the agent|inappropriate ioctl|cannot open .*tty/iu.test(stderr)) {
    return 'agent-or-pinentry';
  }
  if (/bad passphrase|bad session key/iu.test(stderr)) {
    return 'bad-session-key';
  }
  if (/cancel(?:led|ed)/iu.test(stderr)) return 'cancelled';
  if (/no secret key/iu.test(stderr)) return 'credential-unavailable';
  if (/decrypt(?:ion|_message) failed/iu.test(stderr)) {
    return 'generic-decryption';
  }
  return undefined;
}

export function recoveryProcessFailure(
  processName: RecoveryProcessName,
  exitCode: number | null,
  stderr: string,
  signal: NodeJS.Signals | null = null,
  streamState: RecoveryStreamState = 'not-applicable',
): RecoveryPipelineError {
  return new RecoveryPipelineError(
    processName,
    classifyRecoveryProcessFailure(processName, stderr),
    exitCode,
    signal,
    streamState,
    processName === 'gpg'
      ? classifyGpgFailureDetail(stderr, streamState)
      : undefined,
  );
}

export interface RecoveryPipelineFailureEvidence {
  acceptSuccessfulEarlyConsumer?: boolean;
  consumerName: RecoveryProcessName;
  consumerSignal?: NodeJS.Signals | null;
  consumerStatus: number | null;
  consumerStderr: string;
  producerName: RecoveryProcessName;
  producerSignal?: NodeJS.Signals | null;
  producerStatus: number | null;
  producerStderr: string;
  stream: RecoveryStreamResult;
}

function hasBrokenPipeEvidence(stderr: string): boolean {
  return /broken pipe|error writing to ['"]?-['"]?|handle plaintext failed/iu.test(
    stderr,
  );
}

function hasOnlyExpectedGpgBrokenPipeDiagnostics(stderr: string): boolean {
  const lines = stderr
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    lines.length > 0 &&
    lines.some((line) => hasBrokenPipeEvidence(line)) &&
    lines.every(
      (line) =>
        hasBrokenPipeEvidence(line) ||
        /^gpg:\s+(?:[A-Z0-9.]+ encrypted data|encrypted with \d+ passphrase)/iu.test(
          line,
        ),
    )
  );
}

export function selectRecoveryPipelineFailure(
  evidence: RecoveryPipelineFailureEvidence,
): RecoveryPipelineError | undefined {
  const streamState: RecoveryStreamState = evidence.stream.failed
    ? evidence.stream.brokenPipe
      ? 'broken-pipe'
      : 'failed'
    : 'complete';
  const producerFailure = recoveryProcessFailure(
    evidence.producerName,
    evidence.producerStatus,
    evidence.producerStderr,
    evidence.producerSignal ?? null,
    streamState,
  );
  const consumerFailure = recoveryProcessFailure(
    evidence.consumerName,
    evidence.consumerStatus,
    evidence.consumerStderr,
    evidence.consumerSignal ?? null,
    streamState,
  );
  const consumerCausedBrokenPipe =
    evidence.producerName === 'gpg' &&
    evidence.producerStatus !== 0 &&
    evidence.consumerStatus !== 0 &&
    evidence.stream.failed &&
    evidence.stream.brokenPipe &&
    hasBrokenPipeEvidence(evidence.producerStderr);

  const successfulEarlyConsumer =
    evidence.acceptSuccessfulEarlyConsumer === true &&
    evidence.producerName === 'gpg' &&
    evidence.producerStatus === 2 &&
    evidence.consumerStatus === 0 &&
    evidence.stream.failed &&
    evidence.stream.brokenPipe &&
    hasOnlyExpectedGpgBrokenPipeDiagnostics(evidence.producerStderr);

  if (successfulEarlyConsumer) return undefined;
  if (consumerCausedBrokenPipe) return consumerFailure;
  if (
    evidence.producerStatus !== 0 &&
    producerFailure.category !== 'process-failed'
  ) {
    return producerFailure;
  }
  if (
    evidence.consumerStatus !== 0 &&
    consumerFailure.category !== 'process-failed'
  ) {
    return consumerFailure;
  }
  if (evidence.producerStatus !== 0) return producerFailure;
  if (evidence.consumerStatus !== 0) return consumerFailure;
  if (evidence.stream.failed) {
    return new RecoveryPipelineError(
      evidence.consumerName,
      'stream-failed',
      null,
      evidence.consumerSignal ?? null,
      streamState,
    );
  }
  return undefined;
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
  verifyArchive?: (
    archivePath: string,
  ) => Promise<RecoveryArchiveVerification>;
  prepareFixtures?: (connection: string) => void;
  fixturesArePresent?: (connection: string) => boolean;
  restoreArchive?: (
    connection: string,
    archivePath: string,
    tableOfContents: string,
  ) => Promise<void>;
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
      [
        '--clean',
        '--create',
        '--no-acl',
        '--no-privileges',
        '-c',
        '-C',
        '-x',
      ].includes(argument),
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
  options: RecoveryPipelineOptions = {},
): Promise<string> {
  assertSafeToolArguments(left.command, left.args);
  assertSafeToolArguments(right.command, right.args);

  const producer = spawn(left.command, left.args, {
    env: left.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const consumer = spawn(right.command, right.args, {
    env: right.env,
    stdio: [
      'pipe',
      options.captureConsumerStdout ? 'pipe' : 'ignore',
      'pipe',
    ],
  });

  let consumerStdout = '';
  let consumerStdoutExceeded = false;
  if (options.captureConsumerStdout && consumer.stdout) {
    consumer.stdout.setEncoding('utf8');
    consumer.stdout.on('data', (chunk: string) => {
      if (consumerStdout.length + chunk.length > 4 * 1024 * 1024) {
        consumerStdoutExceeded = true;
        return;
      }
      consumerStdout += chunk;
    });
  }

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
  if (
    !(producer.stdout instanceof Readable) ||
    !(producer.stderr instanceof Readable) ||
    !(consumer.stdin instanceof Writable) ||
    !(consumer.stderr instanceof Readable)
  ) {
    throw new RecoveryPipelineError(right.name, 'start-failed', null);
  }
  captureStderr(left.name, producer.stderr);
  captureStderr(right.name, consumer.stderr);

  const transfer = pipeline(producer.stdout, consumer.stdin).then(
    (): RecoveryStreamResult => ({ brokenPipe: false, failed: false }),
    (error: unknown): RecoveryStreamResult => {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : '';
      return {
        brokenPipe:
          code === 'EPIPE' || code === 'ERR_STREAM_PREMATURE_CLOSE',
        failed: true,
      };
    },
  );

  const wait = (
    child: ReturnType<typeof spawn>,
    processName: RecoveryProcessName,
  ) =>
    new Promise<{
      signal: NodeJS.Signals | null;
      status: number | null;
    }>((resolvePromise, rejectPromise) => {
      child.once('error', () =>
        rejectPromise(
          new RecoveryPipelineError(processName, 'start-failed', null),
        ),
      );
      child.once('close', (status, signal) =>
        resolvePromise({ signal, status }),
      );
    });
  const [producerExit, consumerExit, stream] = await Promise.all([
    wait(producer, left.name),
    wait(consumer, right.name),
    transfer,
  ]);

  const failure = selectRecoveryPipelineFailure({
    acceptSuccessfulEarlyConsumer:
      options.acceptSuccessfulEarlyConsumer,
    consumerName: right.name,
    consumerSignal: consumerExit.signal,
    consumerStatus: consumerExit.status,
    consumerStderr: stderr.get(right.name) ?? '',
    producerName: left.name,
    producerSignal: producerExit.signal,
    producerStatus: producerExit.status,
    producerStderr: stderr.get(left.name) ?? '',
    stream,
  });
  if (failure) throw failure;
  if (consumerStdoutExceeded) {
    throw new RecoveryPipelineError(right.name, 'archive-format', null);
  }
  return consumerStdout;
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

async function readArchiveTableOfContents(
  archivePath: string,
): Promise<string> {
  return processPipeline(
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
    {
      acceptSuccessfulEarlyConsumer: true,
      captureConsumerStdout: true,
    },
  );
}

export async function verifyEncryptedArchiveStream(
  archivePath: string,
  options: ArchiveVerificationOptions = {},
): Promise<void> {
  await processPipeline(
    {
      name: 'gpg',
      command: options.command ?? GPG,
      args:
        options.arguments ??
        ['--quiet', '--decrypt', '--output', '-', archivePath],
      env: options.environment ?? safeBaseEnvironment(),
    },
    {
      name: 'sink',
      command: options.sinkCommand ?? '/bin/cat',
      args: [],
      env: safeBaseEnvironment(),
    },
  );
}

export async function verifyRecoveryArchiveStreams(
  archivePath: string,
  dependencies: RecoveryArchiveStreamDependencies = {},
): Promise<string> {
  await withinDiagnosticStage(
    'archive-full-stream-verification',
    () =>
      (dependencies.verifyFullStream ?? verifyEncryptedArchiveStream)(
        archivePath,
      ),
  );
  return withinDiagnosticStage(
    'archive-catalog-extraction',
    () =>
      (dependencies.readCatalog ?? readArchiveTableOfContents)(archivePath),
  );
}

async function verifyArchive(
  archivePath: string,
): Promise<RecoveryArchiveVerification> {
  if (!existsSync(archivePath)) {
    throw new Error('Recovery executor: encrypted archive is missing');
  }
  assertPrivateFile(archivePath);
  const tableOfContents = await verifyRecoveryArchiveStreams(archivePath);
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
  return { archiveSha256: checksum, tableOfContents };
}

const DEFAULT_ACL_TOC_PATTERN =
  /^(\d+);\s+\d+\s+\d+\s+DEFAULT ACL\s+(\S+)\s+DEFAULT PRIVILEGES FOR\s+(\S+)\s+(\S+)\s*$/u;

export function filterProviderManagedDefaultAcls(
  tableOfContents: string,
): string {
  if (!tableOfContents || tableOfContents.includes('\0')) {
    throw new Error('Recovery executor: malformed archive table of contents');
  }

  const matches = { sequences: 0, tables: 0 };
  const filtered = tableOfContents.split('\n').map((line) => {
    if (!line.includes('DEFAULT ACL') || line.trimStart().startsWith(';')) {
      return line;
    }

    const parsed = DEFAULT_ACL_TOC_PATTERN.exec(line);
    if (!parsed) {
      throw new Error('Recovery executor: malformed DEFAULT ACL entry');
    }

    const [, , schema, objectType, owner] = parsed;
    if (owner !== 'cloud_admin') return line;
    if (
      schema !== 'public' ||
      (objectType !== 'TABLES' && objectType !== 'SEQUENCES')
    ) {
      throw new Error(
        'Recovery executor: unexpected provider DEFAULT ACL entry',
      );
    }

    const key = objectType === 'TABLES' ? 'tables' : 'sequences';
    matches[key] += 1;
    return `;${line}`;
  });

  if (matches.tables !== 1 || matches.sequences !== 1) {
    throw new Error(
      'Recovery executor: expected provider DEFAULT ACL entries were not unique',
    );
  }
  return filtered.join('\n');
}

const USE_LIST_NAME_PATTERN =
  /^\.codevivo-restore-[a-f0-9]{32}\.toc$/u;

function useListFileStatus(descriptor: number): UseListFileStatus {
  const status = fstatSync(descriptor);
  return {
    currentUser: process.getuid?.() ?? status.uid,
    file: status.isFile(),
    mode: status.mode & 0o777,
    owner: status.uid,
  };
}

export async function withRecoveryUseListFile<T>(
  archiveDirectory: string,
  contents: string,
  action: (path: string) => Promise<T>,
  dependencies: RecoveryUseListDependencies = {},
): Promise<T> {
  const fileName =
    dependencies.createName?.() ??
    `.codevivo-restore-${randomBytes(16).toString('hex')}.toc`;
  if (!USE_LIST_NAME_PATTERN.test(fileName)) {
    throw new Error('Recovery executor: unsafe temporary use-list name');
  }
  const path = join(archiveDirectory, fileName);
  const openFile =
    dependencies.openFile ??
    ((target: string) =>
      openSync(
        target,
        fsConstants.O_CREAT |
          fsConstants.O_EXCL |
          fsConstants.O_WRONLY |
          fsConstants.O_NOFOLLOW,
        0o600,
      ));
  const inspectFile = dependencies.inspectFile ?? useListFileStatus;
  const writeFile =
    dependencies.writeFile ??
    ((descriptor: number, value: string) =>
      writeFileSync(descriptor, value, { encoding: 'utf8' }));
  const syncFile = dependencies.syncFile ?? fsyncSync;
  const closeFile = dependencies.closeFile ?? closeSync;
  const verifyPath = dependencies.verifyPath ?? assertPrivateFile;
  const removeFile = dependencies.removeFile ?? unlinkSync;

  let created = false;
  let descriptor: number | undefined;
  let actionStarted = false;
  let operationError: unknown;
  let result: T | undefined;

  try {
    try {
      descriptor = openFile(path);
      created = true;
      const status = inspectFile(descriptor);
      if (
        !status.file ||
        status.mode !== 0o600 ||
        status.owner !== status.currentUser
      ) {
        throw new Error('unsafe temporary use-list file');
      }
      writeFile(descriptor, contents);
      syncFile(descriptor);
      closeFile(descriptor);
      descriptor = undefined;
      verifyPath(path);
      actionStarted = true;
      result = await action(path);
    } catch (error) {
      operationError = actionStarted
        ? error
        : new RecoveryDiagnosticError(
            'temporary-toc-preparation',
            'filesystem-preparation',
          );
    }
  } finally {
    let cleanupFailed = false;
    if (descriptor !== undefined) {
      try {
        closeFile(descriptor);
      } catch {
        cleanupFailed = true;
      }
    }
    if (created) {
      try {
        removeFile(path);
      } catch {
        cleanupFailed = true;
      }
    }
    if (cleanupFailed) {
      throw new RecoveryDiagnosticError(
        'temporary-toc-cleanup',
        'filesystem-cleanup',
      );
    }
  }
  if (operationError) throw operationError;
  return result as T;
}

export function recoveryRestoreArguments(useListPath: string): string[] {
  if (
    !isAbsolute(useListPath) ||
    !USE_LIST_NAME_PATTERN.test(basename(useListPath))
  ) {
    throw new Error('Recovery executor: unsafe temporary use-list path');
  }
  return [
    '--exit-on-error',
    '--single-transaction',
    '--no-owner',
    `--use-list=${useListPath}`,
    `--dbname=${RECOVERY_DATABASE_NAME}`,
  ];
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

async function restoreArchive(
  connection: string,
  archivePath: string,
  tableOfContents: string,
): Promise<void> {
  const url = new URL(connection);
  const filteredTableOfContents = withinDiagnosticStageSync(
    'toc-filtering',
    () => filterProviderManagedDefaultAcls(tableOfContents),
    'catalog-validation',
  );
  await withRecoveryUseListFile(
    dirname(archivePath),
    filteredTableOfContents,
    async (useListPath) =>
      withinDiagnosticStage('database-restore-streaming', () =>
        processPipeline(
          {
            name: 'gpg',
            command: GPG,
            args: ['--quiet', '--decrypt', '--output', '-', archivePath],
            env: safeBaseEnvironment(),
          },
          {
            name: 'pg_restore',
            command: PG_RESTORE,
            args: recoveryRestoreArguments(useListPath),
            env: connectionEnvironment(url, false),
          },
        ),
      ),
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
    const verification = await verify(sourceArchive);
    if (
      JSON.stringify(sourceState) !==
      JSON.stringify(fingerprint(context.sourceMigration))
    ) {
      throw new Error('Recovery executor: source changed during backup');
    }
    saveManifest(sourceManifestPath, {
      archive: SOURCE_ARCHIVE,
      archiveSha256: verification.archiveSha256,
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
    const verification = await verify(exerciseArchive);
    saveManifest(exerciseManifestPath, {
      archive: EXERCISE_ARCHIVE,
      archiveSha256: verification.archiveSha256,
      createdAt: (dependencies.now ?? (() => new Date()))().toISOString(),
      fixtures: RECOVERY_FIXTURES,
    });
    return;
  }

  if (stage === 'restore') {
    assertEmptyTarget(inspect(context.connections.migration));
    const exerciseManifest = loadManifest(exerciseManifestPath);
    const verification = await verify(exerciseArchive);
    if (
      exerciseManifest.archive !== EXERCISE_ARCHIVE ||
      exerciseManifest.archiveSha256 !== verification.archiveSha256 ||
      JSON.stringify(exerciseManifest.fixtures) !==
        JSON.stringify(RECOVERY_FIXTURES)
    ) {
      throw new Error('Recovery executor: exercise archive manifest mismatch');
    }
    try {
      await restore(
        context.connections.migration,
        exerciseArchive,
        verification.tableOfContents,
      );
    } catch (error) {
      let state: TargetState;
      try {
        state = inspect(context.connections.migration);
      } catch {
        throw new RecoveryDiagnosticError(
          'rollback-inspection',
          'inspection-failed',
        );
      }
      if (Number(state.userTables) !== 0 || Number(state.discoverySchemas) !== 0) {
        throw new RecoveryDiagnosticError(
          'rollback-inspection',
          'partial-restore',
        );
      }
      const failure = diagnosticFailure(
        'database-restore-streaming',
        error,
      );
      if (failure.pipelineFailure) {
        const containment =
          failure.pipelineFailure.processName === 'pg_restore' &&
          !['start-failed', 'stream-failed'].includes(
            failure.pipelineFailure.category,
          )
            ? 'transaction-rolled-back-empty'
            : 'destination-empty-no-partial-restore';
        throw new Error(`${failure.message} containment=${containment}`);
      }
      throw new Error(
        `${failure.message} containment=destination-empty-no-partial-restore`,
      );
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
