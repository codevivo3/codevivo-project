import 'server-only';

import { getRuntimeDatabase } from '@/lib/database/connection';
import { createDiscoveryNotificationOutboxRepository } from './notification-outbox-repository-core';

export const discoveryNotificationOutboxRepository =
  createDiscoveryNotificationOutboxRepository(getRuntimeDatabase);
