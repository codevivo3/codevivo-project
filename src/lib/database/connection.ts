import 'server-only';

import {
  neon,
  type NeonQueryFunction,
} from '@neondatabase/serverless';

let runtimeClient: NeonQueryFunction<false, false> | undefined;

/**
 * Returns the shared HTTP query client for short-lived application queries.
 * Interactive migrations and administrative tasks use their dedicated
 * credentials and scripts instead of this runtime connection.
 */
export function getRuntimeDatabase(): NeonQueryFunction<false, false> {
  if (runtimeClient) return runtimeClient;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required for database access');
  }

  runtimeClient = neon(connectionString);
  return runtimeClient;
}
