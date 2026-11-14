import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authorizeDiscoverySession,
  DiscoveryAuthorizationError,
} from '../../src/lib/discovery/authorization-core';
import {
  DISCOVERY_PRODUCTION_COOKIE,
  DISCOVERY_SESSION_SECONDS,
  getDiscoveryCookieOptions,
} from '../../src/lib/discovery/cookies';
import { generateDiscoveryCredential } from '../../src/lib/discovery/credential-core';
import { isAllowedDiscoveryOrigin } from '../../src/lib/discovery/origin';
import { handleDiscoverySessionPost } from '../../src/lib/discovery/session-handler';
import type { DiscoverySessionRepository } from '../../src/lib/discovery/types';

const NOW = new Date('2026-11-13T12:00:00.000Z');

function request(token = generateDiscoveryCredential(), origin = 'https://codevivo.dev') {
  return new Request('https://codevivo.dev/api/discovery/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      'Sec-Fetch-Site': 'same-origin',
      'X-Forwarded-For': '203.0.113.8',
    },
    body: JSON.stringify({ token }),
  });
}

test('cookie is HttpOnly, strict, host-only, secure, and capped at 12 hours', async () => {
  const rawSessionCredential = generateDiscoveryCredential();
  const response = await handleDiscoverySessionPost(request(), {
    exchange: async () => ({
      outcome: 'established',
      sessionExpiresAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
      rawSessionCredential,
    }),
    limit: async () => true,
    now: () => NOW,
    baseUrl: 'https://codevivo.dev',
    environment: 'production',
  });

  assert.equal(response.status, 201);
  const responseBody = await response.clone().text();
  const cookie = response.headers.get('set-cookie') ?? '';
  assert.match(cookie, new RegExp(`^${DISCOVERY_PRODUCTION_COOKIE}=`));
  assert.match(cookie, /HttpOnly/u);
  assert.match(cookie, /Secure/u);
  assert.match(cookie, /SameSite=Strict/u);
  assert.match(cookie, /Path=\//u);
  assert.match(cookie, new RegExp(`Max-Age=${DISCOVERY_SESSION_SECONDS}`));
  assert.doesNotMatch(cookie, /Domain=/u);
  assert.deepEqual(await response.json(), { status: 'established' });
  assert.doesNotMatch(responseBody, new RegExp(rawSessionCredential));
});

test('cookie lifetime is capped by invitation expiry', () => {
  const options = getDiscoveryCookieOptions(
    new Date(NOW.getTime() + 90 * 60 * 1000),
    NOW,
    'production',
  );
  assert.equal(options.maxAge, 90 * 60);
});

test('origin validation enforces canonical same-origin requests and CSRF signal', () => {
  assert.equal(
    isAllowedDiscoveryOrigin(request(), 'https://codevivo.dev'),
    true,
  );
  assert.equal(
    isAllowedDiscoveryOrigin(request(undefined, 'https://evil.example'), 'https://codevivo.dev'),
    false,
  );
  const crossSite = request();
  crossSite.headers.set('Sec-Fetch-Site', 'cross-site');
  assert.equal(isAllowedDiscoveryOrigin(crossSite, 'https://codevivo.dev'), false);
});

test('token exchange fails closed when rate limiting is unavailable', async () => {
  let exchangeCalled = false;
  const response = await handleDiscoverySessionPost(request(), {
    exchange: async () => {
      exchangeCalled = true;
      return { outcome: 'unavailable' };
    },
    limit: async () => {
      throw new Error('simulated limiter outage');
    },
    now: () => NOW,
    baseUrl: 'https://codevivo.dev',
  });
  assert.equal(response.status, 429);
  assert.equal(exchangeCalled, false);
});

test('rate-limit keys and responses never contain the raw invitation token', async () => {
  const token = generateDiscoveryCredential();
  let limiterInput: { ipAddress: string; tokenDigest: string } | undefined;
  const response = await handleDiscoverySessionPost(request(token), {
    exchange: async () => ({ outcome: 'unavailable' }),
    limit: async (input) => {
      limiterInput = input;
      return true;
    },
    now: () => NOW,
    baseUrl: 'https://codevivo.dev',
  });
  assert.equal(response.status, 404);
  assert.equal(limiterInput?.ipAddress, '203.0.113.8');
  assert.match(limiterInput?.tokenDigest ?? '', /^[a-f0-9]{64}$/u);
  assert.doesNotMatch(limiterInput?.tokenDigest ?? '', new RegExp(token));
  assert.doesNotMatch(await response.text(), new RegExp(token));
});

test('malformed credentials are rejected before rate limiting or exchange', async () => {
  let limitCalled = false;
  let exchangeCalled = false;
  const response = await handleDiscoverySessionPost(request('not-a-token'), {
    exchange: async () => {
      exchangeCalled = true;
      return { outcome: 'unavailable' };
    },
    limit: async () => {
      limitCalled = true;
      return true;
    },
    now: () => NOW,
    baseUrl: 'https://codevivo.dev',
  });
  assert.equal(response.status, 400);
  assert.equal(limitCalled, false);
  assert.equal(exchangeCalled, false);
});

test('expired and revoked/unavailable invitations return minimal responses', async () => {
  for (const [outcome, status] of [
    ['expired', 410],
    ['unavailable', 404],
  ] as const) {
    const response = await handleDiscoverySessionPost(request(), {
      exchange: async () => ({ outcome }),
      limit: async () => true,
      now: () => NOW,
      baseUrl: 'https://codevivo.dev',
    });
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { status: outcome });
    assert.equal(response.headers.get('set-cookie'), null);
  }
});

function repositoryWithSession(
  session: Awaited<ReturnType<DiscoverySessionRepository['findAuthorizedSession']>>,
): DiscoverySessionRepository {
  return {
    createSessionIfInvitationValid: async () => ({ outcome: 'unavailable' }),
    findAuthorizedSession: async () => session,
  };
}

test('authorization enforces session validity and invitation/brief ownership', async () => {
  const repository = repositoryWithSession({
    invitationId: 'invitation-a',
    briefId: 'brief-a',
    briefState: 'draft',
  });
  const session = await authorizeDiscoverySession({
    credential: 'opaque',
    repository,
    hashCredential: () => Buffer.alloc(32),
    expectedInvitationId: 'invitation-a',
    expectedBriefId: 'brief-a',
  });
  assert.equal(session.invitationId, 'invitation-a');

  await assert.rejects(
    authorizeDiscoverySession({
      credential: 'opaque',
      repository,
      hashCredential: () => Buffer.alloc(32),
      expectedBriefId: 'brief-b',
    }),
    (error: unknown) =>
      error instanceof DiscoveryAuthorizationError &&
      error.code === 'resource_mismatch',
  );

  await assert.rejects(
    authorizeDiscoverySession({
      credential: 'opaque',
      repository: repositoryWithSession(null),
      hashCredential: () => Buffer.alloc(32),
    }),
    (error: unknown) =>
      error instanceof DiscoveryAuthorizationError && error.code === 'unauthorized',
  );
});

test('submitted briefs reject mutations while remaining readable', async () => {
  const repository = repositoryWithSession({
    invitationId: 'invitation-a',
    briefId: 'brief-a',
    briefState: 'submitted',
  });
  await authorizeDiscoverySession({
    credential: 'opaque',
    repository,
    hashCredential: () => Buffer.alloc(32),
  });
  await assert.rejects(
    authorizeDiscoverySession({
      credential: 'opaque',
      repository,
      hashCredential: () => Buffer.alloc(32),
      mutation: true,
    }),
    (error: unknown) =>
      error instanceof DiscoveryAuthorizationError && error.code === 'submitted',
  );
});
