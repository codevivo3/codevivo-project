import 'server-only';

import { Redis } from '@upstash/redis';
import {
  createDiscoveryExchangeLimiter,
  type DiscoveryExchangeLimiter,
} from './rate-limit-core';

let limiter: DiscoveryExchangeLimiter | undefined;

function getLimiter() {
  if (limiter) return limiter;
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    throw new Error('Discovery rate limiting is unavailable');
  }

  const redis = Redis.fromEnv();
  limiter = createDiscoveryExchangeLimiter(redis);
  return limiter;
}

export const limitDiscoveryExchange: DiscoveryExchangeLimiter = async ({
  ipAddress,
  tokenDigest,
}) => {
  try {
    return await getLimiter()({ ipAddress, tokenDigest });
  } catch {
    return false;
  }
};
