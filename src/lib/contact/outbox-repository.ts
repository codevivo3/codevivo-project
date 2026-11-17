import 'server-only';

import { getContactRuntimeDatabase } from '@/lib/database/contact-connection';
import { createNeonContactOutboxRepository } from './outbox-repository-core';

export const contactOutboxRepository = createNeonContactOutboxRepository(
  getContactRuntimeDatabase,
);
