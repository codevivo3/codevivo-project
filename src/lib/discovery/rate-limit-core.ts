import { Ratelimit } from '@upstash/ratelimit';
import type { Redis } from '@upstash/redis';

export type DiscoveryExchangeLimiter = (input: {
  ipAddress: string;
  tokenDigest: string;
}) => Promise<boolean>;

export function createDiscoveryExchangeLimiter(
  redis: Redis,
  prefix = 'codevivo:discovery:exchange',
): DiscoveryExchangeLimiter {
  const ip = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '10 m'),
    prefix: `${prefix}:ip`,
  });
  const token = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '10 m'),
    prefix: `${prefix}:token`,
  });

  return async ({ ipAddress, tokenDigest }) => {
    try {
      const [ipResult, tokenResult] = await Promise.all([
        ip.limit(ipAddress),
        token.limit(tokenDigest),
      ]);
      return ipResult.success && tokenResult.success;
    } catch {
      return false;
    }
  };
}
