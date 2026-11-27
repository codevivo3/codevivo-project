import 'server-only';

import { discoveryNotificationSender } from './notification-email';
import { createDiscoveryOutboxDispatcher } from './notification-outbox-core';
import { discoveryNotificationOutboxRepository } from './notification-outbox-repository';

export const discoveryNotificationDispatcher = createDiscoveryOutboxDispatcher(
  discoveryNotificationOutboxRepository,
  discoveryNotificationSender,
);
