export type InvitationExchangeResult =
  | { outcome: 'established'; sessionExpiresAt: Date }
  | { outcome: 'expired' | 'unavailable' };

export interface DiscoverySessionRepository {
  createSessionIfInvitationValid(input: {
    sessionId: string;
    invitationHash: Buffer;
    sessionHash: Buffer;
    requestedSessionExpiry: Date;
  }): Promise<InvitationExchangeResult>;

  findAuthorizedSession(input: {
    sessionHash: Buffer;
  }): Promise<{
    invitationId: string;
    briefId: string | null;
    briefState: 'draft' | 'submitted' | null;
  } | null>;
}
