import { NextRequest } from 'next/server';
import {
  generateSessionCredential,
  hashInvitationToken,
  hashSessionCredential,
} from '@/lib/discovery/credentials';
import { discoverySessionRepository } from '@/lib/discovery/repository';
import { limitDiscoveryExchange } from '@/lib/discovery/rate-limit';
import { handleDiscoverySessionPost } from '@/lib/discovery/session-handler';
import { exchangeInvitationToken } from '@/lib/discovery/session-service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  return handleDiscoverySessionPost(request, {
    exchange: (token) =>
      exchangeInvitationToken(token, {
        repository: discoverySessionRepository,
        generateSessionCredential,
        hashInvitationToken,
        hashSessionCredential,
        now: () => new Date(),
      }),
    limit: limitDiscoveryExchange,
    now: () => new Date(),
    baseUrl: process.env.DISCOVERY_BASE_URL,
    environment: process.env.NODE_ENV,
  });
}
