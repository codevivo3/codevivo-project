import 'server-only';

import { Redis } from '@upstash/redis';
import {
  createDiscoveryDraftWriteLimiter,
  type DiscoveryDraftWriteLimiter,
} from './draft-rate-limit-core';

let limiter: DiscoveryDraftWriteLimiter | undefined;

function getLimiter(): DiscoveryDraftWriteLimiter {
  if (limiter) return limiter;
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    throw new Error('Discovery draft rate limiting is unavailable');
  }
  limiter = createDiscoveryDraftWriteLimiter(Redis.fromEnv());
  return limiter;
}

export const limitDiscoveryDraftWrite: DiscoveryDraftWriteLimiter = async (input) => {
  try {
    return await getLimiter()(input);
  } catch {
    return false;
  }
};
