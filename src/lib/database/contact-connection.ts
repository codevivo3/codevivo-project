import 'server-only';

import {
  neon,
  type NeonQueryFunction,
} from '@neondatabase/serverless';

let contactRuntimeClient: NeonQueryFunction<false, false> | undefined;

/**
 * Returns the isolated contact-runtime client. Discovery credentials must not
 * be reused for contact persistence.
 */
export function getContactRuntimeDatabase(): NeonQueryFunction<false, false> {
  if (contactRuntimeClient) return contactRuntimeClient;

  const connectionString = process.env.CONTACT_DATABASE_URL;
  if (!connectionString) {
    throw Object.assign(
      new Error('CONTACT_DATABASE_URL is required for contact persistence'),
      { code: 'CONTACT_DATABASE_UNAVAILABLE' },
    );
  }

  contactRuntimeClient = neon(connectionString);
  return contactRuntimeClient;
}
