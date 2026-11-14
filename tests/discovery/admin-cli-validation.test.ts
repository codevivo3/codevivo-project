import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DISCOVERY_VALIDATION_ADMIN_HOST,
  DISCOVERY_VALIDATION_ORIGIN,
  connectDiscoveryValidationDatabase,
  discoveryTokenPeppersMatch,
  prepareDiscoveryValidationInvitation,
  requireDiscoveryValidationOrigin,
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
