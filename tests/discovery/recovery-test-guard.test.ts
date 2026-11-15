import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RECOVERY_AUTHORIZATION,
  RECOVERY_BRANCH_ID,
  RECOVERY_BRANCH_NAME,
  RECOVERY_DATABASE_NAME,
  RECOVERY_ENDPOINT_HOST,
  RECOVERY_ENDPOINT_ID,
  SOURCE_BRANCH_ID,
  SOURCE_ENDPOINT_ID,
  verifyRecoveryTestConfiguration,
} from '../../scripts/discovery-recovery-guard';
import { runRecoveryTestLauncher } from '../../scripts/discovery-recovery-test';

const branchId = RECOVERY_BRANCH_ID;
const endpointId = RECOVERY_ENDPOINT_ID;
const hostname = RECOVERY_ENDPOINT_HOST;
const NOW = new Date('2026-11-15T10:00:00.000Z');
const EXPIRES_AT = '2026-11-16T10:29:36Z';

const connection = (role: string, overrides: Partial<URL> = {}) => {
  const url = new URL(
    `postgresql://${role}@${hostname}/${RECOVERY_DATABASE_NAME}?sslmode=require`,
  );
  Object.assign(url, overrides);
  return url.toString();
};

const validInput = () => ({
  environment: {
    DISCOVERY_RECOVERY_TEST_ALLOW: RECOVERY_AUTHORIZATION,
    DISCOVERY_RECOVERY_BRANCH_ID: branchId,
    DISCOVERY_RECOVERY_ENDPOINT_ID: endpointId,
  },
  metadata: {
    branch: {
      id: branchId,
      name: RECOVERY_BRANCH_NAME,
      parent_id: SOURCE_BRANCH_ID,
      expires_at: EXPIRES_AT,
    },
    endpoints: [
      {
        id: endpointId,
        branch_id: branchId,
        host: hostname,
        type: 'read_write',
      },
    ],
  },
  connections: {
    runtime: connection('codevivo_discovery_runtime'),
    admin: connection('codevivo_discovery_admin'),
    migration: connection('codevivo_discovery_migration'),
  },
  now: NOW,
});

test('accepts an exact mocked recovery target', () => {
  assert.deepEqual(verifyRecoveryTestConfiguration(validInput()), {
    branchId,
    endpointId,
    hostname,
    expiresAt: EXPIRES_AT,
  });
});

test('rejects missing authorization', () => {
  const input = validInput();
  Reflect.deleteProperty(input.environment, 'DISCOVERY_RECOVERY_TEST_ALLOW');
  assert.throws(() => verifyRecoveryTestConfiguration(input), /authorization/u);
});

test('rejects missing recovery endpoint identity', () => {
  const input = validInput();
  Reflect.deleteProperty(input.environment, 'DISCOVERY_RECOVERY_ENDPOINT_ID');
  assert.throws(() => verifyRecoveryTestConfiguration(input), /endpoint ID/u);
});

test('rejects the source validation endpoint', () => {
  const input = validInput();
  input.environment.DISCOVERY_RECOVERY_ENDPOINT_ID = SOURCE_ENDPOINT_ID;
  assert.throws(() => verifyRecoveryTestConfiguration(input), /source/u);
});

test('rejects a production endpoint', () => {
  const input = validInput();
  input.connections.admin = connection('codevivo_discovery_admin', {
    hostname: 'ep-production-example.c-8.eu-central-1.aws.neon.tech',
  });
  assert.throws(() => verifyRecoveryTestConfiguration(input), /hostname/u);
});

test('rejects an incorrect database', () => {
  const input = validInput();
  input.connections.runtime = connection('codevivo_discovery_runtime', {
    pathname: '/neondb',
  });
  assert.throws(() => verifyRecoveryTestConfiguration(input), /database/u);
});

test('rejects an incorrect role', () => {
  const input = validInput();
  input.connections.migration = connection('neondb_owner');
  assert.throws(() => verifyRecoveryTestConfiguration(input), /role/u);
});

test('rejects a pooled connection', () => {
  const input = validInput();
  input.connections.runtime = connection('codevivo_discovery_runtime', {
    hostname: `${endpointId}-pooler.c-8.eu-central-1.aws.neon.tech`,
  });
  assert.throws(() => verifyRecoveryTestConfiguration(input), /hostname/u);
});

test('rejects a malformed connection URL', () => {
  const input = validInput();
  input.connections.admin = 'not a URL';
  assert.throws(() => verifyRecoveryTestConfiguration(input), /malformed/u);
});

test('rejects mismatched Neon branch identity', () => {
  const input = validInput();
  input.metadata.branch.name = 'production';
  assert.throws(() => verifyRecoveryTestConfiguration(input), /branch identity/u);
});

test('does not start tests when validation fails', async () => {
  let testRuns = 0;
  const secrets = new Map([
    ['codevivo.discovery.recovery.neon-api-key', 'mock-api-key'],
    [
      'codevivo.discovery.recovery.runtime.database-url',
      connection('codevivo_discovery_runtime'),
    ],
    [
      'codevivo.discovery.recovery.admin.database-url',
      connection('codevivo_discovery_admin'),
    ],
    [
      'codevivo.discovery.recovery.migration.database-url',
      connection('codevivo_discovery_migration'),
    ],
  ]);

  await assert.rejects(
    runRecoveryTestLauncher(
      {
        DISCOVERY_RECOVERY_TEST_ALLOW: RECOVERY_AUTHORIZATION,
        DISCOVERY_RECOVERY_BRANCH_ID: branchId,
        DISCOVERY_RECOVERY_ENDPOINT_ID: endpointId,
      },
      {
        readSecret: (service) => secrets.get(service) ?? '',
        fetchImplementation: async (url) =>
          new Response(
            JSON.stringify(
              String(url).endsWith('/endpoints')
                ? { endpoints: validInput().metadata.endpoints }
                : {
                    branch: {
                      ...validInput().metadata.branch,
                      name: 'production',
                    },
                  },
            ),
          ),
        runTests: () => {
          testRuns += 1;
          return 0;
        },
        now: () => NOW,
      },
    ),
    /branch identity/u,
  );
  assert.equal(testRuns, 0);
});

test('starts the existing suite only after mocked metadata is verified', async () => {
  let childEnvironment: NodeJS.ProcessEnv | undefined;
  const secrets = new Map([
    ['codevivo.discovery.recovery.neon-api-key', 'mock-api-key'],
    [
      'codevivo.discovery.recovery.runtime.database-url',
      connection('codevivo_discovery_runtime'),
    ],
    [
      'codevivo.discovery.recovery.admin.database-url',
      connection('codevivo_discovery_admin'),
    ],
    [
      'codevivo.discovery.recovery.migration.database-url',
      connection('codevivo_discovery_migration'),
    ],
  ]);

  const status = await runRecoveryTestLauncher(
    {
      DISCOVERY_RECOVERY_TEST_ALLOW: RECOVERY_AUTHORIZATION,
      DISCOVERY_RECOVERY_BRANCH_ID: branchId,
      DISCOVERY_RECOVERY_ENDPOINT_ID: endpointId,
    },
    {
      readSecret: (service) => secrets.get(service) ?? '',
      fetchImplementation: async (url) =>
        new Response(
          JSON.stringify(
            String(url).endsWith('/endpoints')
              ? { endpoints: validInput().metadata.endpoints }
              : { branch: validInput().metadata.branch },
          ),
        ),
      runTests: (environment) => {
        childEnvironment = environment;
        return 0;
      },
        now: () => NOW,
    },
  );

  assert.equal(status, 0);
  assert.equal(childEnvironment?.DISCOVERY_DB_TEST_ALLOW, '1');
  assert.equal(childEnvironment?.DISCOVERY_RECOVERY_GUARD_VERIFIED, '1');
});
