import type { NeonQueryFunction } from '@neondatabase/serverless';
import type {
  DiscoverySessionRepository,
  InvitationExchangeResult,
} from './types';

type ExchangeRow = {
  outcome: 'established' | 'expired' | 'unavailable';
  session_expires_at: string | null;
};

type AuthorizationRow = {
  invitation_id: string;
  brief_id: string | null;
  brief_state: 'draft' | 'submitted' | null;
};

export function createDiscoverySessionRepository(
  getDatabase: () => NeonQueryFunction<false, false>,
): DiscoverySessionRepository {
  return {
    async createSessionIfInvitationValid(input) {
      const sql = getDatabase();
      const rows = await sql`
        WITH matched AS (
          SELECT
            id,
            token_generation,
            expires_at,
            CASE
              WHEN revoked_at IS NOT NULL THEN 'unavailable'
              WHEN expires_at <= now() THEN 'expired'
              ELSE 'valid'
            END AS outcome
          FROM discovery.invitations
          WHERE token_hash = ${input.invitationHash}
          FOR UPDATE
        ),
        inserted AS (
          INSERT INTO discovery.sessions (
            id,
            credential_hash,
            invitation_id,
            token_generation,
            expires_at
          )
          SELECT
            ${input.sessionId}::uuid,
            ${input.sessionHash},
            matched.id,
            matched.token_generation,
            LEAST(${input.requestedSessionExpiry.toISOString()}::timestamptz, matched.expires_at)
          FROM matched
          WHERE matched.outcome = 'valid'
          RETURNING invitation_id, expires_at
        ),
        advanced AS (
          UPDATE discovery.invitations
          SET lifecycle_status = 'in_progress'
          WHERE id = (SELECT invitation_id FROM inserted)
            AND lifecycle_status = 'pending'
          RETURNING id
        )
        SELECT
          CASE
            WHEN EXISTS (SELECT 1 FROM inserted) THEN 'established'
            ELSE COALESCE((SELECT outcome FROM matched), 'unavailable')
          END AS outcome,
          (SELECT expires_at FROM inserted) AS session_expires_at,
          (SELECT count(*) FROM advanced) AS invitations_advanced
      ` as ExchangeRow[];

      const row = rows[0];
      if (row?.outcome === 'established' && row.session_expires_at) {
        return {
          outcome: 'established',
          sessionExpiresAt: new Date(row.session_expires_at),
        } satisfies InvitationExchangeResult;
      }

      return {
        outcome: row?.outcome === 'expired' ? 'expired' : 'unavailable',
      } satisfies InvitationExchangeResult;
    },

    async findAuthorizedSession(input) {
      const sql = getDatabase();
      const rows = await sql`
        SELECT
          invitations.id AS invitation_id,
          project_briefs.id AS brief_id,
          project_briefs.state AS brief_state
        FROM discovery.sessions
        INNER JOIN discovery.invitations
          ON invitations.id = sessions.invitation_id
        LEFT JOIN discovery.project_briefs
          ON project_briefs.invitation_id = invitations.id
        WHERE sessions.credential_hash = ${input.sessionHash}
          AND sessions.invalidated_at IS NULL
          AND sessions.expires_at > now()
          AND invitations.revoked_at IS NULL
          AND invitations.expires_at > now()
          AND sessions.token_generation = invitations.token_generation
        LIMIT 1
      ` as AuthorizationRow[];

      const row = rows[0];
      return row
        ? {
            invitationId: row.invitation_id,
            briefId: row.brief_id,
            briefState: row.brief_state,
          }
        : null;
    },
  };
}
