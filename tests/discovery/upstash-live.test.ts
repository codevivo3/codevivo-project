import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Redis } from '@upstash/redis';
import { createDiscoveryExchangeLimiter } from '../../src/lib/discovery/rate-limit-core';

const enabled = process.env.DISCOVERY_UPSTASH_TEST_ALLOW === '1';
const hasCredentials = Boolean(
  process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN,
);
const skip = !enabled
  ? 'Set DISCOVERY_UPSTASH_TEST_ALLOW=1 for the isolated live test'
  : !hasCredentials
    ? 'Upstash REST credentials are unavailable'
    : false;

test('Discovery Upstash policy', { skip }, async (t) => {
  const namespace = `codevivo:m2b:validation:${randomUUID()}`;
  const limiter = createDiscoveryExchangeLimiter(Redis.fromEnv(), namespace);

  await t.test('permits requests and enforces the IP threshold', async () => {
    for (let index = 0; index < 10; index += 1) {
      assert.equal(
        await limiter({
          ipAddress: 'validation-ip-a',
          tokenDigest: `validation-token-${index}`,
        }),
        true,
      );
    }
    assert.equal(
      await limiter({
        ipAddress: 'validation-ip-a',
        tokenDigest: 'validation-token-over-ip-limit',
      }),
      false,
    );
  });

  await t.test('keeps independent IP keys independent', async () => {
    assert.equal(
      await limiter({
        ipAddress: 'validation-ip-b',
        tokenDigest: 'validation-token-independent',
      }),
      true,
    );
  });

  await t.test('enforces the token-digest threshold independently', async () => {
    for (let index = 0; index < 5; index += 1) {
      assert.equal(
        await limiter({
          ipAddress: `validation-token-ip-${index}`,
          tokenDigest: 'validation-token-shared',
        }),
        true,
      );
    }
    assert.equal(
      await limiter({
        ipAddress: 'validation-token-ip-over-limit',
        tokenDigest: 'validation-token-shared',
      }),
      false,
    );
  });

  await t.test('fails closed when the service is unreachable', async () => {
    const unavailable = createDiscoveryExchangeLimiter(
      new Redis({
        url: 'http://127.0.0.1:1',
        token: 'test-only-unreachable-service',
      }),
      `${namespace}:unavailable`,
    );
    assert.equal(
      await unavailable({
        ipAddress: 'validation-ip',
        tokenDigest: 'validation-token',
      }),
      false,
    );
  });
});
