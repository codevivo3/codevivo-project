import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DiscoveryCredentialError,
  generateDiscoveryCredential,
  hashDiscoveryCredential,
  parseDiscoveryCredential,
  validateDiscoveryPepper,
} from '../../src/lib/discovery/credential-core';

const PEPPER = 'test-only-pepper-material-with-more-than-32-bytes';

test('credentials use a versioned 256-bit URL-safe format with unique entropy', () => {
  const credentials = new Set(
    Array.from({ length: 128 }, () => generateDiscoveryCredential()),
  );

  assert.equal(credentials.size, 128);
  for (const credential of credentials) {
    assert.match(credential, /^v1\.[A-Za-z0-9_-]{43}$/u);
    assert.equal(Buffer.from(credential.slice(3), 'base64url').length, 32);
    assert.equal(parseDiscoveryCredential(credential), credential);
  }
});

test('HMAC hashes are deterministic, 32 bytes, and domain separated', () => {
  const credential = generateDiscoveryCredential();
  const invitation = hashDiscoveryCredential(credential, 'invitation', PEPPER);
  const repeated = hashDiscoveryCredential(credential, 'invitation', PEPPER);
  const session = hashDiscoveryCredential(credential, 'session', PEPPER);

  assert.equal(invitation.length, 32);
  assert.deepEqual(invitation, repeated);
  assert.notDeepEqual(invitation, session);
});

test('malformed credentials are rejected without echoing their value', () => {
  const malformed = 'v1.secret-value-that-must-not-appear';
  assert.throws(
    () => parseDiscoveryCredential(malformed),
    (error: unknown) => {
      assert.ok(error instanceof DiscoveryCredentialError);
      assert.doesNotMatch(error.message, /secret-value/u);
      return true;
    },
  );
});

test('missing and weak pepper configuration fails closed', () => {
  assert.throws(() => validateDiscoveryPepper(undefined), /at least 32 bytes/u);
  assert.throws(() => validateDiscoveryPepper('too-short'), /at least 32 bytes/u);
  assert.equal(validateDiscoveryPepper(PEPPER), PEPPER);
});
