import 'server-only';

import { cookies } from 'next/headers';
import { getDiscoveryCookieName } from './cookies';
import { hashSessionCredential } from './credentials';
import { discoverySessionRepository } from './repository';
import { authorizeDiscoverySession } from './authorization-core';

export { DiscoveryAuthorizationError } from './authorization-core';

export async function requireDiscoverySession(options: {
  expectedInvitationId?: string;
  expectedBriefId?: string;
  mutation?: boolean;
} = {}) {
  const cookieStore = await cookies();
  const credential = cookieStore.get(getDiscoveryCookieName())?.value;

  return authorizeDiscoverySession({
    credential,
    repository: discoverySessionRepository,
    hashCredential: hashSessionCredential,
    ...options,
  });
}
