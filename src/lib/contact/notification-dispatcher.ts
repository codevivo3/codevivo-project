import 'server-only';

import { contactNotificationSender } from './notification-email';
import { createContactOutboxDispatcher } from './outbox-core';
import { contactOutboxRepository } from './outbox-repository';

/**
 * Server-only dispatcher. No route or schedule is exposed in Phase 3.
 * A future authenticated scheduler may invoke one bounded batch at a time.
 */
export const contactNotificationDispatcher = createContactOutboxDispatcher(
  contactOutboxRepository,
  contactNotificationSender,
);
