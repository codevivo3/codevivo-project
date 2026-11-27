import { cookies } from 'next/headers';
import { runDiscoveryOperation } from '@/lib/discovery/activation';
import { getDiscoveryCookieName } from '@/lib/discovery/cookies';
import { hashSessionCredential } from '@/lib/discovery/credentials';
import { limitDiscoveryDraftWrite } from '@/lib/discovery/draft-rate-limit';
import { handleDiscoverySubmission } from '@/lib/discovery/submission-handler';
import { discoverySubmissionRepository } from '@/lib/discovery/submission-repository';

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

export async function POST(request: Request) {
  return runDiscoveryOperation(process.env.DISCOVERY_ENABLED, () =>
    handleDiscoverySubmission(request, {
      baseUrl: process.env.DISCOVERY_BASE_URL,
      enabled: process.env.DISCOVERY_DRAFT_PERSISTENCE_ENABLED,
      getSessionHash,
      limit: limitDiscoveryDraftWrite,
      repository: discoverySubmissionRepository,
    }),
  );
}
