import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { Client, type ClientBase } from '@neondatabase/serverless';
import { readKeychainSecret } from './discovery-keychain';
import {
  executeAuthorizedPermanentValidationMigration,
  parsePermanentValidationMigrationInvocation,
  verifyPermanentValidationPostMigrationState,
  verifyPermanentValidationPreMigrationState,
  type PermanentValidationMigrationState,
  type PermanentValidationPostMigrationState,
  type PermanentValidationRecordCounts,
} from './discovery-permanent-validation-migration-core';
import {
  PERMANENT_VALIDATION_AUTHORIZATION,
  PERMANENT_VALIDATION_KEYCHAIN_SERVICES,
  PERMANENT_VALIDATION_PENDING_MIGRATION,
  fetchPermanentValidationMetadata,
  validatePermanentValidationConnections,
  verifyPermanentValidationTarget,
  type PermanentValidationChecksums,
  type PermanentValidationConnections,
} from './discovery-permanent-validation-preflight-core';

parsePermanentValidationMigrationInvocation(process.argv.slice(2));

async function checksum(file: string): Promise<string> {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function readOnlyTransaction<T>(
  connectionString: string,
  operation: (client: ClientBase) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();
  let began = false;
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    began = true;
    const mode = await client.query<{ read_only: string }>(
      "SELECT current_setting('transaction_read_only') AS read_only",
    );
    if (mode.rows[0]?.read_only !== 'on') {
      throw new Error('Permanent validation migration: read-only inspection unavailable');
    }
    const result = await operation(client);
    await client.query('COMMIT');
    began = false;
    return result;
  } catch (error) {
    if (began) await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function readCounts(client: ClientBase): Promise<PermanentValidationRecordCounts> {
  const result = await client.query<{
    invitations: number;
    notification_events: number;
    project_briefs: number;
  }>(`
    SELECT
      (SELECT count(*)::int FROM discovery.invitations) AS invitations,
      (SELECT count(*)::int FROM discovery.project_briefs) AS project_briefs,
      (SELECT count(*)::int FROM discovery.notification_outbox)
        AS notification_events
  `);
  return {
    invitations: result.rows[0]?.invitations ?? -1,
    notificationEvents: result.rows[0]?.notification_events ?? -1,
    projectBriefs: result.rows[0]?.project_briefs ?? -1,
  };
}

async function readPreMigrationState(
  connections: PermanentValidationConnections,
): Promise<PermanentValidationMigrationState> {
  const [migrationState, adminState] = await Promise.all([
    readOnlyTransaction(connections.migration, async (client) => {
      const identity = await client.query<{ database: string; role: string }>(`
        SELECT current_database() AS database, current_user AS role
      `);
      if (
        identity.rows[0]?.database !== 'neondb'
        || identity.rows[0]?.role !== 'codevivo_discovery_migration'
      ) {
        throw new Error('Permanent validation migration: migration identity mismatch');
      }
      const migrations = await client.query<{ checksum: string; version: string }>(`
        SELECT version, checksum
        FROM discovery.schema_migrations
        ORDER BY version
      `);
      return migrations.rows;
    }),
    readOnlyTransaction(connections.admin, async (client) => {
      const identity = await client.query<{ database: string; role: string }>(`
        SELECT current_database() AS database, current_user AS role
      `);
      if (
        identity.rows[0]?.database !== 'neondb'
        || identity.rows[0]?.role !== 'codevivo_discovery_admin'
      ) {
        throw new Error('Permanent validation migration: admin identity mismatch');
      }
      const submitted = await client.query<{ count: number }>(`
        SELECT count(*)::int AS count
        FROM discovery.project_briefs
        WHERE state = 'submitted'
      `);
      return {
        counts: await readCounts(client),
        submittedBriefs: submitted.rows[0]?.count ?? -1,
      };
    }),
  ]);
  return {
    migrations: migrationState,
    recordCounts: adminState.counts,
    submittedBriefs: adminState.submittedBriefs,
  };
}

async function readPostMigrationState(
  connections: PermanentValidationConnections,
): Promise<PermanentValidationPostMigrationState> {
  const [migrationState, recordCounts] = await Promise.all([
    readOnlyTransaction(connections.migration, async (client) => {
      const migrations = await client.query<{ checksum: string; version: string }>(`
        SELECT version, checksum
        FROM discovery.schema_migrations
        ORDER BY version
      `);
      const columns = await client.query<{ identifier: string }>(`
        SELECT table_name || '.' || column_name AS identifier
        FROM information_schema.columns
        WHERE table_schema = 'discovery'
          AND (
            (table_name = 'project_briefs'
              AND column_name IN (
                'submission_idempotency_id', 'submission_payload_hash'
              ))
            OR (table_name = 'notification_outbox'
              AND column_name = 'provider_message_id')
          )
        ORDER BY identifier
      `);
      const functions = await client.query<{
        name: string;
        owner: string;
        public_execute: boolean;
        runtime_execute: boolean;
        search_path_pinned: boolean;
      }>(`
        SELECT procedure.proname AS name,
          pg_get_userbyid(procedure.proowner) AS owner,
          procedure.proconfig @> ARRAY['search_path=pg_catalog']::text[]
            AS search_path_pinned,
          has_function_privilege('public', procedure.oid, 'EXECUTE')
            AS public_execute,
          has_function_privilege(
            'codevivo_discovery_runtime', procedure.oid, 'EXECUTE'
          ) AS runtime_execute
        FROM pg_proc AS procedure
        INNER JOIN pg_namespace AS namespace
          ON namespace.oid = procedure.pronamespace
        WHERE namespace.nspname = 'discovery'
          AND procedure.proname IN (
            'submit_project_brief',
            'claim_notification_events',
            'mark_notification_delivered',
            'mark_notification_failed'
          )
        ORDER BY procedure.proname
      `);
      const permissions = await client.query<{
        outbox_delivery_update: boolean;
        outbox_insert: boolean;
        state_update: boolean;
        submission_reference_update: boolean;
      }>(`
        SELECT
          has_column_privilege(
            'codevivo_discovery_runtime', 'discovery.project_briefs',
            'state', 'UPDATE'
          ) AS state_update,
          has_column_privilege(
            'codevivo_discovery_runtime', 'discovery.project_briefs',
            'submission_reference', 'UPDATE'
          ) AS submission_reference_update,
          has_table_privilege(
            'codevivo_discovery_runtime', 'discovery.notification_outbox', 'INSERT'
          ) AS outbox_insert,
          has_column_privilege(
            'codevivo_discovery_runtime', 'discovery.notification_outbox',
            'delivery_status', 'UPDATE'
          ) AS outbox_delivery_update
      `);
      const permission = permissions.rows[0];
      return {
        columns: columns.rows.map((row) => row.identifier),
        functions: functions.rows.map((row) => ({
          name: row.name,
          owner: row.owner,
          publicExecute: row.public_execute,
          runtimeExecute: row.runtime_execute,
          searchPathPinned: row.search_path_pinned,
        })),
        migrations: migrations.rows,
        permissions: {
          outboxDeliveryUpdate: permission?.outbox_delivery_update ?? true,
          outboxInsert: permission?.outbox_insert ?? true,
          stateUpdate: permission?.state_update ?? true,
          submissionReferenceUpdate: permission?.submission_reference_update ?? true,
        },
      };
    }),
    readOnlyTransaction(connections.admin, readCounts),
  ]);
  return { ...migrationState, recordCounts };
}

function runExistingReadOnlyPreflight(): void {
  const result = spawnSync(
    '/usr/bin/env',
    ['npm', 'run', 'discovery:validation:preflight', '--', 'preflight'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DISCOVERY_PERMANENT_VALIDATION_PREFLIGHT_ALLOW:
          PERMANENT_VALIDATION_AUTHORIZATION,
      },
      stdio: 'inherit',
    },
  );
  if (result.error || result.status !== 0) {
    throw new Error('Permanent validation migration: read-only preflight failed');
  }
}

function applyExistingMigrationRunner(migrationUrl: string): void {
  const result = spawnSync('/usr/bin/env', ['npm', 'run', 'db:migrate'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DISCOVERY_MIGRATION_DATABASE_URL: migrationUrl,
    },
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0) {
    throw new Error('Permanent validation migration: migration runner failed');
  }
}

async function main(): Promise<void> {
  await executeAuthorizedPermanentValidationMigration({
    authorization: process.env.DISCOVERY_PERMANENT_VALIDATION_MIGRATION_ALLOW,
    preflight: async () => runExistingReadOnlyPreflight(),
    execute: async () => {
      const connections: PermanentValidationConnections = {
        admin: readKeychainSecret(PERMANENT_VALIDATION_KEYCHAIN_SERVICES.admin),
        migration: readKeychainSecret(
          PERMANENT_VALIDATION_KEYCHAIN_SERVICES.migration,
        ),
        runtime: readKeychainSecret(PERMANENT_VALIDATION_KEYCHAIN_SERVICES.runtime),
      };
      validatePermanentValidationConnections(connections);
      const apiKey = readKeychainSecret(PERMANENT_VALIDATION_KEYCHAIN_SERVICES.apiKey);
      const metadata = await fetchPermanentValidationMetadata({ apiKey });
      const target = verifyPermanentValidationTarget({
        authorization: PERMANENT_VALIDATION_AUTHORIZATION,
        connections,
        metadata,
      });

      const repositoryMigrations = (await readdir('db/migrations'))
        .filter((file) => /^\d{4}_[a-z0-9_]+\.sql$/u.test(file))
        .sort((left, right) => left.localeCompare(right));
      const checksums = Object.fromEntries(await Promise.all(
        repositoryMigrations.map(async (file) => [
          file,
          await checksum(`db/migrations/${file}`),
        ]),
      )) as PermanentValidationChecksums;
      const pre = await readPreMigrationState(connections);
      verifyPermanentValidationPreMigrationState({
        checksums,
        repositoryMigrations,
        state: pre,
      });

      console.log(
        `TARGET_OK branch=${target.branchId} endpoint=${target.endpointId} parent=${target.parentBranchId}`,
      );
      console.log(
        `MIGRATION_READY version=${PERMANENT_VALIDATION_PENDING_MIGRATION} checksum=${checksums[PERMANENT_VALIDATION_PENDING_MIGRATION]} invitations=${pre.recordCounts.invitations} briefs=${pre.recordCounts.projectBriefs} notifications=${pre.recordCounts.notificationEvents}`,
      );

      applyExistingMigrationRunner(connections.migration);

      const post = await readPostMigrationState(connections);
      verifyPermanentValidationPostMigrationState({
        checksums,
        post,
        preCounts: pre.recordCounts,
      });
      console.log(
        `MIGRATION_OK version=${PERMANENT_VALIDATION_PENDING_MIGRATION} checksum=${checksums[PERMANENT_VALIDATION_PENDING_MIGRATION]} functions=verified permissions=verified`,
      );
      console.log(
        `RECORD_COUNTS_OK invitations=${post.recordCounts.invitations} briefs=${post.recordCounts.projectBriefs} notifications=${post.recordCounts.notificationEvents}`,
      );
    },
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown failure';
  console.error(`Permanent validation migration failed: ${message}`);
  process.exitCode = 1;
});
