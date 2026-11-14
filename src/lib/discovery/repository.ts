import 'server-only';

import { getRuntimeDatabase } from '@/lib/database/connection';
import { createDiscoverySessionRepository } from './repository-core';

export const discoverySessionRepository =
  createDiscoverySessionRepository(getRuntimeDatabase);
