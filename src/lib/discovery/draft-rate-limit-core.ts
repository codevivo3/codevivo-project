import { Ratelimit } from '@upstash/ratelimit';
import type { Redis } from '@upstash/redis';

export type DiscoveryDraftWriteLimiter = (input: {
  ipAddress: string;
  sessionDigest: string;
}) => Promise<boolean>;

export function createDiscoveryDraftWriteLimiter(
  redis: Redis,
  prefix = 'codevivo:discovery:draft-write',
): DiscoveryDraftWriteLimiter {
  const ip = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(900, '10 m'),
    prefix: `${prefix}:ip`,
  });
  const session = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(600, '10 m'),
    prefix: `${prefix}:session`,
  });

  return async ({ ipAddress, sessionDigest }) => {
    try {
      const [ipResult, sessionResult] = await Promise.all([
        ip.limit(ipAddress),
        session.limit(sessionDigest),
      ]);
      return ipResult.success && sessionResult.success;
    } catch {
      return false;
    }
  };
}
