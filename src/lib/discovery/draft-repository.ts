import 'server-only';

import { getRuntimeDatabase } from '@/lib/database/connection';
import { createDiscoveryDraftRepository } from './draft-repository-core';

export const discoveryDraftRepository = createDiscoveryDraftRepository(
  getRuntimeDatabase,
);
