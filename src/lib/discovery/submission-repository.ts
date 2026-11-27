import 'server-only';

import { getRuntimeDatabase } from '@/lib/database/connection';
import { createDiscoverySubmissionRepository } from './submission-repository-core';

export const discoverySubmissionRepository = createDiscoverySubmissionRepository(
  getRuntimeDatabase,
);
