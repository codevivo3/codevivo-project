import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DISCOVERY_VALIDATION_ADMIN_HOST,
  DISCOVERY_VALIDATION_ORIGIN,
  connectDiscoveryValidationDatabase,
  discoveryTokenPeppersMatch,
  prepareDiscoveryValidationInvitation,
  requireDiscoveryValidationOrigin,
  connectDiscoveryAdministrationDatabase,
  getDiscoveryAdministrationTarget,
  parseDiscoveryAdministrationInvocation,
  prepareDiscoveryAdministrationInvitation,
  verifyDiscoveryAdministrationIdentity,
} from '../../scripts/discovery-admin-validation';

const VALID_DATABASE_URL =
  `postgresql://codevivo_discovery_admin:test-only@${DISCOVERY_VALIDATION_ADMIN_HOST}/neondb?sslmode=require`;

test('valid validation configuration reaches the database factory', () => {
  let connectionCount = 0;
  const context = prepareDiscoveryValidationInvitation({
    baseUrl: DISCOVERY_VALIDATION_ORIGIN,
    connectionString: VALID_DATABASE_URL,
    connect: () => {
      connectionCount += 1;
      return { target: 'validation' };
    },
  });

  assert.equal(connectionCount, 1);
  assert.equal(context.database.target, 'validation');
  assert.equal(context.baseUrl.origin, DISCOVERY_VALIDATION_ORIGIN);
});

test('incorrect database hostname fails before creating a client', () => {
  let connectionCount = 0;
  assert.throws(
    () =>
      connectDiscoveryValidationDatabase(
        'postgresql://codevivo_discovery_admin:test-only@production.invalid/neondb',
        () => {
          connectionCount += 1;
          return {};
        },
      ),
    /approved Discovery validation database/u,
  );
  assert.equal(connectionCount, 0);
});

test('incorrect database role fails before creating a client', () => {
  let connectionCount = 0;
  assert.throws(
    () =>
      connectDiscoveryValidationDatabase(
        `postgresql://neondb_owner:test-only@${DISCOVERY_VALIDATION_ADMIN_HOST}/neondb`,
        () => {
          connectionCount += 1;
          return {};
        },
      ),
    /approved Discovery validation database/u,
  );
  assert.equal(connectionCount, 0);
});

test('incorrect database name fails before creating a client', () => {
  let connectionCount = 0;
  assert.throws(
    () =>
      connectDiscoveryValidationDatabase(
        `postgresql://codevivo_discovery_admin:test-only@${DISCOVERY_VALIDATION_ADMIN_HOST}/production`,
        () => {
          connectionCount += 1;
          return {};
        },
      ),
    /approved Discovery validation database/u,
  );
  assert.equal(connectionCount, 0);
});

test('missing or production origin fails before creating a database client', () => {
  for (const baseUrl of [undefined, 'https://codevivo.dev']) {
    let connectionCount = 0;
    assert.throws(
      () =>
        prepareDiscoveryValidationInvitation({
          baseUrl,
          connectionString: VALID_DATABASE_URL,
          connect: () => {
            connectionCount += 1;
            return {};
          },
        }),
      /approved Discovery validation Preview origin/u,
    );
    assert.equal(connectionCount, 0);
  }
});

test('malformed or non-origin base URLs are rejected', () => {
  for (const value of [
    'not-a-url',
    `${DISCOVERY_VALIDATION_ORIGIN}/unexpected`,
    `${DISCOVERY_VALIDATION_ORIGIN}?unexpected=true`,
  ]) {
    assert.throws(
      () => requireDiscoveryValidationOrigin(value),
      /approved Discovery validation Preview origin/u,
    );
  }
});

test('pepper comparison returns only an equality result', () => {
  assert.equal(
    discoveryTokenPeppersMatch('validation-pepper', 'validation-pepper'),
    true,
  );
  assert.equal(
    discoveryTokenPeppersMatch('validation-pepper', 'different-pepper'),
    false,
  );
});

const productionConfiguration = {
  DISCOVERY_PRODUCTION_ADMIN_HOST:
    'ep-production-test.c-8.eu-central-1.aws.neon.tech',
  DISCOVERY_PRODUCTION_DATABASE: 'neondb',
  DISCOVERY_PRODUCTION_ORIGIN: 'https://codevivo.dev',
};

test('administration requires explicit validation or production selection', () => {
  assert.deepEqual(
    parseDiscoveryAdministrationInvocation([
      '--environment',
      'validation',
      'inspect',
    ]),
    { command: 'inspect', environment: 'validation' },
  );
  for (const invocation of [
    ['inspect'],
    ['--environment', 'staging', 'inspect'],
    ['--environment', 'production'],
  ]) {
    assert.throws(
      () => parseDiscoveryAdministrationInvocation(invocation),
      /explicit|Usage/iu,
    );
  }
});

test('production target must be explicitly and completely configured', () => {
  assert.deepEqual(
    getDiscoveryAdministrationTarget('production', productionConfiguration),
    {
      database: 'neondb',
      environment: 'production',
      host: productionConfiguration.DISCOVERY_PRODUCTION_ADMIN_HOST,
      origin: 'https://codevivo.dev',
      role: 'codevivo_discovery_admin',
    },
  );
  for (const configuration of [
    {},
    { ...productionConfiguration, DISCOVERY_PRODUCTION_ADMIN_HOST: 'production.invalid' },
    { ...productionConfiguration, DISCOVERY_PRODUCTION_ADMIN_HOST: 'ep-test-pooler.c-8.eu-central-1.aws.neon.tech' },
    { ...productionConfiguration, DISCOVERY_PRODUCTION_ADMIN_HOST: DISCOVERY_VALIDATION_ADMIN_HOST },
    { ...productionConfiguration, DISCOVERY_PRODUCTION_ORIGIN: 'https://preview.example' },
  ]) {
    assert.throws(
      () => getDiscoveryAdministrationTarget(
        'production',
        configuration,
      ),
      /not safely configured/u,
    );
  }
});

test('selected environment mismatches fail before database client creation', () => {
  const production = getDiscoveryAdministrationTarget(
    'production',
    productionConfiguration,
  );
  let connectionCount = 0;
  assert.throws(
    () => connectDiscoveryAdministrationDatabase(
      VALID_DATABASE_URL,
      production,
      () => { connectionCount += 1; return {}; },
    ),
    /does not match the selected environment/u,
  );
  assert.equal(connectionCount, 0);

  assert.throws(
    () => prepareDiscoveryAdministrationInvitation({
      baseUrl: DISCOVERY_VALIDATION_ORIGIN,
      connectionString:
        `postgresql://codevivo_discovery_admin:test-only@${production.host}/neondb`,
      connect: () => { connectionCount += 1; return {}; },
      target: production,
    }),
    /does not match the selected environment/u,
  );
  assert.equal(connectionCount, 0);
});

test('connected database identity is independently checked', async () => {
  const validation = getDiscoveryAdministrationTarget('validation', {});
  await verifyDiscoveryAdministrationIdentity(
    (async () => [{ database: 'neondb', role: 'codevivo_discovery_admin' }]) as never,
    validation,
  );
  await assert.rejects(
    verifyDiscoveryAdministrationIdentity(
      (async () => [{ database: 'neondb', role: 'unexpected_role' }]) as never,
      validation,
    ),
    /connected database identity/u,
  );
});
