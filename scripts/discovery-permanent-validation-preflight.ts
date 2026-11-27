import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Client, type ClientBase } from '@neondatabase/serverless';
import { readKeychainSecret } from './discovery-keychain';
import {
  PERMANENT_VALIDATION_APPLIED_MIGRATIONS,
  PERMANENT_VALIDATION_KEYCHAIN_SERVICES,
  PERMANENT_VALIDATION_PENDING_MIGRATION,
  fetchPermanentValidationMetadata,
  parsePermanentValidationPreflightInvocation,
  validatePermanentValidationConnections,
  verifyPermanentValidationEvidence,
  verifyPermanentValidationTarget,
  type PermanentValidationChecksums,
  type PermanentValidationConnections,
  type PermanentValidationEvidence,
} from './discovery-permanent-validation-preflight-core';

parsePermanentValidationPreflightInvocation(process.argv.slice(2));

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
      throw new Error('Permanent validation preflight: read-only transaction unavailable');
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

async function readIdentity(
  connectionString: string,
): Promise<PermanentValidationEvidence['identities']['runtime']> {
  return readOnlyTransaction(connectionString, async (client) => {
    const result = await client.query<{
      database: string;
      read_only: string;
      role: string;
      version: number;
    }>(`
      SELECT current_database() AS database,
        current_user AS role,
        current_setting('server_version_num')::int AS version,
        current_setting('transaction_read_only') AS read_only
    `);
    const row = result.rows[0];
    return {
      database: row?.database ?? '',
      readOnly: row?.read_only === 'on',
      role: row?.role ?? '',
      serverVersion: row?.version ?? 0,
    };
  });
}

async function readMigrationEvidence(
  connectionString: string,
): Promise<Pick<
  PermanentValidationEvidence,
  'functions' | 'migrations' | 'permissions' | 'roles' | 'schemas'
>> {
  return readOnlyTransaction(connectionString, async (client) => {
    const schemas = await client.query<{ name: string; owner: string }>(`
      SELECT nspname AS name, pg_get_userbyid(nspowner) AS owner
      FROM pg_namespace
      WHERE nspname IN ('contact', 'discovery')
      ORDER BY nspname
    `);
    const migrations = await client.query<{ checksum: string; version: string }>(`
      SELECT version, checksum
      FROM discovery.schema_migrations
      ORDER BY version
    `);
    const roles = await client.query<{
      bypass_rls: boolean;
      can_login: boolean;
      create_db: boolean;
      create_role: boolean;
      member_of_admin: boolean;
      member_of_migration: boolean;
      name: string;
      replication: boolean;
      superuser: boolean;
    }>(`
      SELECT rolname AS name,
        rolcanlogin AS can_login,
        rolsuper AS superuser,
        rolcreatedb AS create_db,
        rolcreaterole AS create_role,
        rolreplication AS replication,
        rolbypassrls AS bypass_rls,
        pg_has_role(rolname, 'codevivo_discovery_admin', 'member')
          AND rolname <> 'codevivo_discovery_admin' AS member_of_admin,
        pg_has_role(rolname, 'codevivo_discovery_migration', 'member')
          AND rolname <> 'codevivo_discovery_migration' AS member_of_migration
      FROM pg_roles
      WHERE rolname IN (
        'codevivo_discovery_admin',
        'codevivo_discovery_migration',
        'codevivo_discovery_runtime'
      )
      ORDER BY rolname
    `);
    const functions = await client.query<{
      name: string;
      owner: string;
      public_execute: boolean;
      runtime_execute: boolean;
    }>(`
      SELECT procedure.proname AS name,
        pg_get_userbyid(procedure.proowner) AS owner,
        has_function_privilege('public', procedure.oid, 'EXECUTE') AS public_execute,
        has_function_privilege(
          'codevivo_discovery_runtime', procedure.oid, 'EXECUTE'
        ) AS runtime_execute
      FROM pg_proc AS procedure
      INNER JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'discovery'
      ORDER BY procedure.proname
    `);
    const permissions = await client.query<{
      answers_update: boolean;
      contact_usage: boolean;
      outbox_delivery_update: boolean;
      outbox_insert: boolean;
      provenance_select: boolean;
      provider_message_column: boolean;
      public_schema_usage: boolean;
      state_update: boolean;
      submission_idempotency_column: boolean;
      submission_reference_update: boolean;
      submitted_immutable_trigger: boolean;
    }>(`
      SELECT
        has_column_privilege(
          'codevivo_discovery_runtime', 'discovery.project_briefs',
          'answers', 'UPDATE'
        ) AS answers_update,
        has_column_privilege(
          'codevivo_discovery_runtime', 'discovery.project_briefs',
          'state', 'UPDATE'
        ) AS state_update,
        has_column_privilege(
          'codevivo_discovery_runtime', 'discovery.project_briefs',
          'submission_reference', 'UPDATE'
        ) AS submission_reference_update,
        has_schema_privilege(
          'codevivo_discovery_runtime', 'contact', 'USAGE'
        ) AS contact_usage,
        has_table_privilege(
          'codevivo_discovery_runtime', 'discovery.invitation_inquiry_links',
          'SELECT'
        ) AS provenance_select,
        has_schema_privilege('public', 'discovery', 'USAGE') AS public_schema_usage,
        has_table_privilege(
          'codevivo_discovery_runtime', 'discovery.notification_outbox', 'INSERT'
        ) AS outbox_insert,
        has_column_privilege(
          'codevivo_discovery_runtime', 'discovery.notification_outbox',
          'delivery_status', 'UPDATE'
        ) AS outbox_delivery_update,
        EXISTS (
          SELECT 1 FROM pg_trigger
          WHERE tgname = 'project_briefs_submission_immutable'
            AND NOT tgisinternal
        ) AS submitted_immutable_trigger,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'discovery'
            AND table_name = 'notification_outbox'
            AND column_name = 'provider_message_id'
        ) AS provider_message_column,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'discovery'
            AND table_name = 'project_briefs'
            AND column_name = 'submission_idempotency_id'
        ) AS submission_idempotency_column
    `);
    const permission = permissions.rows[0];
    return {
      functions: functions.rows.map((row) => ({
        name: row.name,
        owner: row.owner,
        publicExecute: row.public_execute,
        runtimeExecute: row.runtime_execute,
      })),
      migrations: migrations.rows,
      permissions: {
        answersUpdate: permission?.answers_update ?? false,
        contactUsage: permission?.contact_usage ?? false,
        outboxDeliveryUpdate: permission?.outbox_delivery_update ?? false,
        outboxInsert: permission?.outbox_insert ?? false,
        provenanceSelect: permission?.provenance_select ?? false,
        providerMessageColumn: permission?.provider_message_column ?? false,
        publicSchemaUsage: permission?.public_schema_usage ?? false,
        stateUpdate: permission?.state_update ?? false,
        submissionIdempotencyColumn:
          permission?.submission_idempotency_column ?? false,
        submissionReferenceUpdate: permission?.submission_reference_update ?? false,
        submittedImmutableTrigger: permission?.submitted_immutable_trigger ?? false,
      },
      roles: roles.rows.map((row) => ({
        bypassRls: row.bypass_rls,
        canLogin: row.can_login,
        createDb: row.create_db,
        createRole: row.create_role,
        memberOfAdmin: row.member_of_admin,
        memberOfMigration: row.member_of_migration,
        name: row.name,
        replication: row.replication,
        superuser: row.superuser,
      })),
      schemas: schemas.rows,
    };
  });
}

async function main(): Promise<void> {
  const connections: PermanentValidationConnections = {
    admin: readKeychainSecret(PERMANENT_VALIDATION_KEYCHAIN_SERVICES.admin),
    migration: readKeychainSecret(PERMANENT_VALIDATION_KEYCHAIN_SERVICES.migration),
    runtime: readKeychainSecret(PERMANENT_VALIDATION_KEYCHAIN_SERVICES.runtime),
  };

  // This validation intentionally occurs before metadata lookup or Client creation.
  validatePermanentValidationConnections(connections);
  const apiKey = readKeychainSecret(PERMANENT_VALIDATION_KEYCHAIN_SERVICES.apiKey);
  const metadata = await fetchPermanentValidationMetadata({ apiKey });
  const target = verifyPermanentValidationTarget({
    authorization: process.env.DISCOVERY_PERMANENT_VALIDATION_PREFLIGHT_ALLOW,
    connections,
    metadata,
  });

  const files = [
    ...PERMANENT_VALIDATION_APPLIED_MIGRATIONS,
    PERMANENT_VALIDATION_PENDING_MIGRATION,
  ] as const;
  const checksums = Object.fromEntries(await Promise.all(files.map(async (file) => [
    file,
    await checksum(`db/migrations/${file}`),
  ]))) as PermanentValidationChecksums;

  const [migrationIdentity, adminResult, runtimeIdentity, databaseEvidence] =
    await Promise.all([
      readIdentity(connections.migration),
      readOnlyTransaction(connections.admin, async (client) => {
        const identity = await client.query<{
          database: string;
          read_only: string;
          role: string;
          version: number;
        }>(`
          SELECT current_database() AS database,
            current_user AS role,
            current_setting('server_version_num')::int AS version,
            current_setting('transaction_read_only') AS read_only
        `);
        const count = await client.query<{ count: number }>(`
          SELECT count(*)::int AS count
          FROM discovery.project_briefs
          WHERE state = 'submitted'
        `);
        return {
          identity: {
            database: identity.rows[0]?.database ?? '',
            readOnly: identity.rows[0]?.read_only === 'on',
            role: identity.rows[0]?.role ?? '',
            serverVersion: identity.rows[0]?.version ?? 0,
          },
          submittedBriefs: count.rows[0]?.count ?? -1,
        };
      }),
      readIdentity(connections.runtime),
      readMigrationEvidence(connections.migration),
    ]);

  verifyPermanentValidationEvidence({
    checksums,
    evidence: {
      ...databaseEvidence,
      identities: {
        admin: adminResult.identity,
        migration: migrationIdentity,
        runtime: runtimeIdentity,
      },
      submittedBriefs: adminResult.submittedBriefs,
    },
  });

  console.log(
    `TARGET_OK branch=${target.branchId} endpoint=${target.endpointId} parent=${target.parentBranchId}`,
  );
  console.log(
    `PREFLIGHT_OK migrations_0001_0003=verified migration_0004=pending checksum_0004=${checksums[PERMANENT_VALIDATION_PENDING_MIGRATION].slice(0, 12)} submitted_briefs=0 permissions=verified mode=read-only`,
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown failure';
  console.error(`Permanent validation preflight failed: ${message}`);
  process.exitCode = 1;
});
