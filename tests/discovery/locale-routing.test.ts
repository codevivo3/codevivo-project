import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import proxy from '../../src/proxy';
import { DISCOVERY_SECURITY_HEADERS } from '../../src/lib/discovery/security-headers';

function request(
  pathname: string,
  language = 'en-US,en;q=0.9',
  headers: Record<string, string> = {},
) {
  return proxy(
    new NextRequest(`https://codevivo.dev${pathname}`, {
      headers: {
        'accept-language': language,
        'sec-fetch-dest': 'document',
        ...headers,
      },
    }),
  );
}

function assertDiscoveryHeaders(response: Response) {
  for (const [name, value] of Object.entries(DISCOVERY_SECURITY_HEADERS)) {
    assert.equal(response.headers.get(name), value);
  }
}

test('legacy English Discovery URL redirects once to its canonical unprefixed URL', () => {
  const headerCases: Record<string, string>[] = [
    {},
    { 'x-codevivo-discovery-internal-locale': 'en' },
  ];
  for (const headers of headerCases) {
    const response = request(
      '/en/discovery?source=legacy',
      'en-US,en;q=0.9',
      headers,
    );
    assert.equal(response.status, 307);
    assert.equal(
      response.headers.get('location'),
      'https://codevivo.dev/discovery?source=legacy',
    );
    assertDiscoveryHeaders(response);
  }
});

test('canonical English Discovery URL is served directly without locale rewriting', () => {
  const response = request('/discovery?source=canonical', 'it-IT,it;q=0.9');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
  assert.equal(response.headers.get('x-middleware-rewrite'), null);
  assertDiscoveryHeaders(response);
});

test('Italian Discovery URL remains canonical and unrelated locale routing is unchanged', () => {
  const italian = request('/it/discovery', 'it-IT,it;q=0.9');
  assert.equal(italian.status, 200);
  assert.equal(italian.headers.get('location'), null);
  assertDiscoveryHeaders(italian);

  const unrelatedLegacyEnglish = request('/en/projects');
  assert.equal(unrelatedLegacyEnglish.status, 307);
  assert.equal(
    unrelatedLegacyEnglish.headers.get('location'),
    'https://codevivo.dev/projects',
  );
});
