import { createHmac, randomBytes } from 'node:crypto';

const CREDENTIAL_VERSION = 'v1';
const CREDENTIAL_BYTES = 32;
const ENCODED_CREDENTIAL_LENGTH = 43;
const CREDENTIAL_PATTERN = /^v1\.([A-Za-z0-9_-]{43})$/u;
const MINIMUM_PEPPER_BYTES = 32;

export type DiscoveryCredentialPurpose = 'invitation' | 'session';

export function validateDiscoveryPepper(pepper: string | undefined): string {
  if (!pepper || Buffer.byteLength(pepper, 'utf8') < MINIMUM_PEPPER_BYTES) {
    throw new Error(
      'DISCOVERY_TOKEN_PEPPER must contain at least 32 bytes',
    );
  }

  return pepper;
}

export function generateDiscoveryCredential(): string {
  return `${CREDENTIAL_VERSION}.${randomBytes(CREDENTIAL_BYTES).toString('base64url')}`;
}

export function parseDiscoveryCredential(credential: unknown): string {
  if (typeof credential !== 'string') {
    throw new DiscoveryCredentialError();
  }

  const match = CREDENTIAL_PATTERN.exec(credential);
  if (!match) {
    throw new DiscoveryCredentialError();
  }

  const decoded = Buffer.from(match[1], 'base64url');
  if (
    decoded.length !== CREDENTIAL_BYTES ||
    decoded.toString('base64url').length !== ENCODED_CREDENTIAL_LENGTH ||
    decoded.toString('base64url') !== match[1]
  ) {
    throw new DiscoveryCredentialError();
  }

  return credential;
}

export function hashDiscoveryCredential(
  credential: unknown,
  purpose: DiscoveryCredentialPurpose,
  pepper: string,
): Buffer {
  const validCredential = parseDiscoveryCredential(credential);
  const validPepper = validateDiscoveryPepper(pepper);

  return createHmac('sha256', validPepper)
    .update(`codevivo.discovery.${purpose}.v1\0`, 'utf8')
    .update(validCredential, 'utf8')
    .digest();
}

export class DiscoveryCredentialError extends Error {
  constructor() {
    super('Invalid discovery credential');
    this.name = 'DiscoveryCredentialError';
  }
}
