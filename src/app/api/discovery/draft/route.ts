import { cookies } from 'next/headers';
import { runDiscoveryOperation } from '@/lib/discovery/activation';
import { getDiscoveryCookieName } from '@/lib/discovery/cookies';
import { hashSessionCredential } from '@/lib/discovery/credentials';
import {
  handleDiscoveryDraftGet,
  handleDiscoveryDraftPost,
  handleDiscoveryDraftPut,
} from '@/lib/discovery/draft-handler';
import { limitDiscoveryDraftWrite } from '@/lib/discovery/draft-rate-limit';
import { discoveryDraftRepository } from '@/lib/discovery/draft-repository';

export const runtime = 'nodejs';

async function getSessionHash(): Promise<Buffer | null> {
  const cookieStore = await cookies();
  const credential = cookieStore.get(getDiscoveryCookieName())?.value;
  try {
    return hashSessionCredential(credential);
  } catch {
    return null;
  }
}

function dependencies() {
  return {
    baseUrl: process.env.DISCOVERY_BASE_URL,
    enabled: process.env.DISCOVERY_DRAFT_PERSISTENCE_ENABLED,
    getSessionHash,
    limit: limitDiscoveryDraftWrite,
    repository: discoveryDraftRepository,
    retentionDays: process.env.DISCOVERY_ABANDONED_RETENTION_DAYS,
  };
}

export async function GET() {
  return runDiscoveryOperation(process.env.DISCOVERY_ENABLED, () =>
    handleDiscoveryDraftGet(dependencies()),
  );
}

export async function POST(request: Request) {
  return runDiscoveryOperation(process.env.DISCOVERY_ENABLED, () =>
    handleDiscoveryDraftPost(request, dependencies()),
  );
}

export async function PUT(request: Request) {
  return runDiscoveryOperation(process.env.DISCOVERY_ENABLED, () =>
    handleDiscoveryDraftPut(request, dependencies()),
  );
}
