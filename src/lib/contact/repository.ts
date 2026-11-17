import 'server-only';

import { getContactRuntimeDatabase } from '@/lib/database/contact-connection';
import {
  createContactInquiryRepository,
  createNeonContactPersistence,
} from './repository-core';

export const contactInquiryRepository = createContactInquiryRepository(
  createNeonContactPersistence(getContactRuntimeDatabase),
);

export type {
  AcceptContactInquiryInput,
  ContactInquiryPersistenceResult,
  ContactInquiryRepository,
} from './repository-core';
export { ContactRepositoryError } from './repository-core';
