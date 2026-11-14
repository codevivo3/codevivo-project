import { randomUUID } from 'node:crypto';
import type { DiscoverySessionRepository } from './types';

export type SessionServiceDependencies = {
  repository: DiscoverySessionRepository;
  hashInvitationToken(token: unknown): Buffer;
  hashSessionCredential(credential: unknown): Buffer;
  generateSessionCredential(): string;
  now(): Date;
};

export async function exchangeInvitationToken(
  token: unknown,
  dependencies: SessionServiceDependencies,
) {
  const now = dependencies.now();
  const rawSessionCredential = dependencies.generateSessionCredential();
  const result = await dependencies.repository.createSessionIfInvitationValid({
    sessionId: randomUUID(),
    invitationHash: dependencies.hashInvitationToken(token),
    sessionHash: dependencies.hashSessionCredential(rawSessionCredential),
    requestedSessionExpiry: new Date(now.getTime() + 12 * 60 * 60 * 1000),
  });

  if (result.outcome !== 'established') return result;

  return {
    ...result,
    rawSessionCredential,
  };
}
