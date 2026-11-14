import 'server-only';

import {
  generateDiscoveryCredential,
  hashDiscoveryCredential,
  validateDiscoveryPepper,
} from './credential-core';

function getPepper(): string {
  return validateDiscoveryPepper(process.env.DISCOVERY_TOKEN_PEPPER);
}

export function generateSessionCredential(): string {
  return generateDiscoveryCredential();
}

export function hashInvitationToken(token: unknown): Buffer {
  return hashDiscoveryCredential(token, 'invitation', getPepper());
}

export function hashSessionCredential(credential: unknown): Buffer {
  return hashDiscoveryCredential(credential, 'session', getPepper());
}
