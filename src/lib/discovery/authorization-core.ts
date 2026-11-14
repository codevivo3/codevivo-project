import type { DiscoverySessionRepository } from './types';

export class DiscoveryAuthorizationError extends Error {
  constructor(public readonly code: 'unauthorized' | 'resource_mismatch' | 'submitted') {
    super('Discovery access denied');
    this.name = 'DiscoveryAuthorizationError';
  }
}

export async function authorizeDiscoverySession(input: {
  credential: unknown;
  repository: DiscoverySessionRepository;
  hashCredential(credential: unknown): Buffer;
  expectedInvitationId?: string;
  expectedBriefId?: string;
  mutation?: boolean;
}) {
  let sessionHash: Buffer;
  try {
    sessionHash = input.hashCredential(input.credential);
  } catch {
    throw new DiscoveryAuthorizationError('unauthorized');
  }

  const session = await input.repository.findAuthorizedSession({ sessionHash });
  if (!session) throw new DiscoveryAuthorizationError('unauthorized');

  if (
    (input.expectedInvitationId &&
      session.invitationId !== input.expectedInvitationId) ||
    (input.expectedBriefId && session.briefId !== input.expectedBriefId)
  ) {
    throw new DiscoveryAuthorizationError('resource_mismatch');
  }

  if (input.mutation && session.briefState === 'submitted') {
    throw new DiscoveryAuthorizationError('submitted');
  }

  return session;
}
