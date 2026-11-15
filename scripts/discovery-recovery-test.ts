import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  fetchRecoveryMetadata,
  RECOVERY_AUTHORIZATION,
  RECOVERY_KEYCHAIN_SERVICES,
  verifyRecoveryTestConfiguration,
} from './discovery-recovery-guard';
import { readKeychainSecret } from './discovery-keychain';

interface LauncherDependencies {
  readSecret?: typeof readKeychainSecret;
  fetchImplementation?: typeof fetch;
  runTests?: (environment: NodeJS.ProcessEnv) => number | null;
  now?: () => Date;
}

const runDatabaseTests = (environment: NodeJS.ProcessEnv) => {
  const testFiles = readdirSync('tests/database')
    .filter((file) => file.endsWith('.test.mjs'))
    .map((file) => `tests/database/${file}`);
  const result = spawnSync(process.execPath, ['--test', ...testFiles], {
    env: environment,
    stdio: 'inherit',
  });

  return result.status;
};

export async function runRecoveryTestLauncher(
  environment: Record<string, string | undefined>,
  dependencies: LauncherDependencies = {},
): Promise<number> {
  if (
    environment.DISCOVERY_RECOVERY_TEST_ALLOW !== RECOVERY_AUTHORIZATION
  ) {
    throw new Error('Recovery test guard: explicit authorization is required');
  }

  const branchId = environment.DISCOVERY_RECOVERY_BRANCH_ID;
  const endpointId = environment.DISCOVERY_RECOVERY_ENDPOINT_ID;

  if (!branchId || !endpointId) {
    throw new Error('Recovery test guard: recovery endpoint identity is required');
  }

  const readSecret = dependencies.readSecret ?? readKeychainSecret;
  const apiKey = readSecret(RECOVERY_KEYCHAIN_SERVICES.apiKey);
  const connections = {
    runtime: readSecret(RECOVERY_KEYCHAIN_SERVICES.runtime),
    admin: readSecret(RECOVERY_KEYCHAIN_SERVICES.admin),
    migration: readSecret(RECOVERY_KEYCHAIN_SERVICES.migration),
  };
  const metadata = await fetchRecoveryMetadata({
    apiKey,
    branchId,
    fetchImplementation: dependencies.fetchImplementation,
  });

  verifyRecoveryTestConfiguration({
    environment: {
      DISCOVERY_RECOVERY_TEST_ALLOW:
        environment.DISCOVERY_RECOVERY_TEST_ALLOW,
      DISCOVERY_RECOVERY_BRANCH_ID:
        environment.DISCOVERY_RECOVERY_BRANCH_ID,
      DISCOVERY_RECOVERY_ENDPOINT_ID:
        environment.DISCOVERY_RECOVERY_ENDPOINT_ID,
    },
    metadata,
    connections,
    now: (dependencies.now ?? (() => new Date()))(),
  });

  const childEnvironment: NodeJS.ProcessEnv = {
    ...environment,
    NODE_ENV: 'test',
    DATABASE_URL: connections.runtime,
    DISCOVERY_ADMIN_DATABASE_URL: connections.admin,
    DISCOVERY_MIGRATION_DATABASE_URL: connections.migration,
    DISCOVERY_DB_TEST_ALLOW: '1',
    DISCOVERY_RECOVERY_GUARD_VERIFIED: '1',
  };
  const status = (dependencies.runTests ?? runDatabaseTests)(childEnvironment);

  if (status !== 0) {
    throw new Error('Recovery database integration tests failed');
  }

  return 0;
}

const isMainModule =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  runRecoveryTestLauncher(process.env).catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'Recovery test launcher failed';
    console.error(message);
    process.exitCode = 1;
  });
}
