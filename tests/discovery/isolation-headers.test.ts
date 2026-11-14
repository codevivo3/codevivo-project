import assert from 'node:assert/strict';
import test from 'node:test';
import { isDiscoveryPath } from '../../src/lib/discovery/paths';
import {
  applyDiscoverySecurityHeaders,
  DISCOVERY_SECURITY_HEADERS,
} from '../../src/lib/discovery/security-headers';

test('analytics path isolation covers both localized Discovery routes only', () => {
  assert.equal(isDiscoveryPath('/discovery'), true);
  assert.equal(isDiscoveryPath('/discovery/review'), true);
  assert.equal(isDiscoveryPath('/en/discovery'), true);
  assert.equal(isDiscoveryPath('/it/discovery'), true);
  assert.equal(isDiscoveryPath('/it/discovery/review'), true);
  assert.equal(isDiscoveryPath('/projects'), false);
  assert.equal(isDiscoveryPath('/it/projects'), false);
  assert.equal(isDiscoveryPath('/discovery-example'), false);
});

test('Discovery responses receive no-store, indexing, referrer, MIME and CSP protections', () => {
  const headers = applyDiscoverySecurityHeaders(new Headers());
  for (const [name, value] of Object.entries(DISCOVERY_SECURITY_HEADERS)) {
    assert.equal(headers.get(name), value);
  }
});
