import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { readKeychainSecret } from './discovery-keychain';
import {
  PHASE2_AUTHORIZATION,
  PHASE2_KEYCHAIN_SERVICES,
  fetchPhase2Metadata,
  verifyPhase2Target,
  type Phase2Connections,
} from './discovery-phase2-validation-core';

const command = process.argv[2];
if (command !== 'preflight' && command !== 'validate') {
  throw new Error('Usage: npm run discovery:phase2:validate -- <preflight|validate>');
}

function run(label: string, args: string[], environment: NodeJS.ProcessEnv) {
  const result = spawnSync('/usr/bin/env', args, {
    cwd: process.cwd(),
    env: environment,
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Phase 2 validation guard: ${label} failed`);
  }
}

async function expectedChecksum(file: string) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function main() {
const apiKey = readKeychainSecret(PHASE2_KEYCHAIN_SERVICES.apiKey);
const connections: Phase2Connections = {
  admin: readKeychainSecret(PHASE2_KEYCHAIN_SERVICES.admin),
  migration: readKeychainSecret(PHASE2_KEYCHAIN_SERVICES.migration),
  runtime: readKeychainSecret(PHASE2_KEYCHAIN_SERVICES.runtime),
};
const metadata = await fetchPhase2Metadata({ apiKey });
const target = verifyPhase2Target({
  authorization: process.env.DISCOVERY_PHASE2_LIVE_ALLOW,
  connections,
  metadata,
});

const migration = neon(connections.migration);
const admin = neon(connections.admin);
const runtime = neon(connections.runtime);
const [migrationIdentity, adminIdentity, runtimeIdentity] = await Promise.all([
  migration`SELECT current_database() AS database, current_user AS role,
    current_setting('server_version_num')::int AS version`,
  admin`SELECT current_database() AS database, current_user AS role`,
  runtime`SELECT current_database() AS database, current_user AS role`,
]);
if (
  migrationIdentity[0]?.database !== 'neondb' ||
  migrationIdentity[0]?.role !== 'codevivo_discovery_migration' ||
  migrationIdentity[0]?.version < 180000 ||
  adminIdentity[0]?.database !== 'neondb' ||
  adminIdentity[0]?.role !== 'codevivo_discovery_admin' ||
  runtimeIdentity[0]?.database !== 'neondb' ||
  runtimeIdentity[0]?.role !== 'codevivo_discovery_runtime'
) {
  throw new Error('Phase 2 validation guard: database identity mismatch');
}

const schemas = await migration`
  SELECT nspname AS schema, pg_get_userbyid(nspowner) AS owner
  FROM pg_namespace WHERE nspname IN ('contact', 'discovery')
`;
const discoverySchemaOwner = schemas.find((schema) => schema.schema === 'discovery')?.owner;
const contactSchemaOwner = schemas.find((schema) => schema.schema === 'contact')?.owner;
if (
  discoverySchemaOwner !== 'codevivo_discovery_migration' ||
  contactSchemaOwner !== 'codevivo_discovery_migration'
) {
  throw new Error(
    'Phase 2 validation guard: schema owner mismatch '
    + `(discovery=${discoverySchemaOwner ?? 'missing'}, contact=${contactSchemaOwner ?? 'missing'})`,
  );
}
const [contactRole] = await migration`
  SELECT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'codevivo_contact_runtime'
  ) AS exists
`;
if (contactRole?.exists !== true) {
  throw new Error('Phase 2 validation guard: contact runtime prerequisite is missing');
}

const history = await migration`
  SELECT version, checksum FROM discovery.schema_migrations ORDER BY version
`;
for (const version of ['0001_project_discovery_foundation.sql', '0002_contact_database_foundation.sql']) {
  const expected = await expectedChecksum(`db/migrations/${version}`);
  const applied = history.find((row) => row.version === version);
  const isAllowedPendingPrerequisite =
    version === '0002_contact_database_foundation.sql' && !applied;
  if (!isAllowedPendingPrerequisite && (!applied || applied.checksum !== expected)) {
    const appliedPrefix = typeof applied?.checksum === 'string'
      ? applied.checksum.slice(0, 12)
      : 'missing';
    throw new Error(
      `Phase 2 validation guard: migration history mismatch for ${version} `
      + `(applied=${appliedPrefix}, local=${expected.slice(0, 12)})`,
    );
  }
  if (isAllowedPendingPrerequisite) {
    console.log('PREREQUISITE_PENDING version=0002');
  }
}
const expected0003 = await expectedChecksum(
  'db/migrations/0003_discovery_persistence_foundation.sql',
);
const applied0003 = history.find(
  (row) => row.version === '0003_discovery_persistence_foundation.sql',
);
if (applied0003 && applied0003.checksum !== expected0003) {
  throw new Error('Phase 2 validation guard: applied migration 0003 checksum mismatch');
}

console.log(
  `TARGET_OK branch=${target.branchId} endpoint=${target.endpointId} expires=${target.expiresAt}`,
);
if (command === 'preflight') {
  console.log(
    `PREFLIGHT_OK migration_0002=${history.some((row) => row.version === '0002_contact_database_foundation.sql') ? 'applied' : 'pending'} migration_0003=${applied0003 ? 'applied' : 'pending'}`,
  );
  return;
}

const childEnvironment = {
  ...process.env,
  DATABASE_URL: connections.runtime,
  DISCOVERY_ADMIN_DATABASE_URL: connections.admin,
  DISCOVERY_MIGRATION_DATABASE_URL: connections.migration,
  DISCOVERY_DB_TEST_ALLOW: '1',
  DISCOVERY_DRAFT_LIVE_ALLOW: PHASE2_AUTHORIZATION,
  DISCOVERY_DRAFT_PERSISTENCE_ENABLED: 'false',
};
run('migration', ['npm', 'run', 'db:migrate'], childEnvironment);

const postHistory = await migration`
  SELECT version, checksum FROM discovery.schema_migrations
  WHERE version IN (
    '0002_contact_database_foundation.sql',
    '0003_discovery_persistence_foundation.sql'
  )
`;
const expected0002 = await expectedChecksum(
  'db/migrations/0002_contact_database_foundation.sql',
);
if (
  postHistory.find((row) => row.version === '0002_contact_database_foundation.sql')
    ?.checksum !== expected0002 ||
  postHistory.find((row) => row.version === '0003_discovery_persistence_foundation.sql')
    ?.checksum !== expected0003
) {
  throw new Error('Phase 2 validation guard: migration 0003 verification failed');
}

const [verification] = await migration`
  SELECT
    EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'project_briefs_mutation_metadata_valid'
        AND pg_get_constraintdef(oid) LIKE '%last_mutation_hash IS NOT NULL%'
    ) AS mutation_hash_constraint,
    has_column_privilege(
      'codevivo_discovery_runtime', 'discovery.project_briefs', 'answers', 'UPDATE'
    ) AS answers_update,
    has_column_privilege(
      'codevivo_discovery_runtime', 'discovery.project_briefs', 'state', 'UPDATE'
    ) AS state_update,
    has_column_privilege(
      'codevivo_discovery_runtime', 'discovery.project_briefs',
      'submission_reference', 'UPDATE'
    ) AS submission_update,
    has_schema_privilege('codevivo_discovery_runtime', 'contact', 'USAGE')
      AS contact_usage,
    has_table_privilege(
      'codevivo_discovery_runtime', 'discovery.invitation_inquiry_links', 'SELECT'
    ) AS provenance_select
`;
if (
  verification?.mutation_hash_constraint !== true ||
  verification?.answers_update !== true ||
  verification?.state_update !== false ||
  verification?.submission_update !== false ||
  verification?.contact_usage !== false ||
  verification?.provenance_select !== false
) {
  throw new Error('Phase 2 validation guard: post-migration permissions mismatch');
}
console.log('MIGRATION_OK version=0003 permissions=verified');

run('database foundation tests', ['npm', 'run', 'test:db'], childEnvironment);
run(
  'draft persistence tests',
  ['npm', 'run', 'test:discovery:drafts:live'],
  childEnvironment,
);
console.log('PHASE2_LIVE_VALIDATION_OK');
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown failure';
  console.error(`Phase 2 validation failed: ${message}`);
  process.exitCode = 1;
});
