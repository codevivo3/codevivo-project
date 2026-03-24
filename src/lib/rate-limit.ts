/**
<<<<<<< Updated upstream
 * Contact Rate Limit
 *
 * Purpose:
 * Defines the shared rate limiter used by the contact form server action.
 *
 * Context:
 * Imported by `src/app/contact/actions.ts`.
 *
 * Dependencies:
 * - Upstash Redis and Ratelimit
 *
 * Notes:
 * - Current policy allows 3 requests per 5 minutes per identifier.
 * - Keep this isolated so the contact action stays focused on request handling.
 */
=======
 * ratelimit
 *
 * Purpose:
 * Configures the shared Upstash rate limiter for server-side request protection.
 *
 * Context:
 * Imported by server actions and API-facing code that need a common throttling policy.
 *
 * Notes:
 * Thresholds are centralized here so contact form protection stays consistent.
 */

>>>>>>> Stashed changes
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '5 m'),
});
