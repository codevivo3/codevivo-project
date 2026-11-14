export const DISCOVERY_SESSION_SECONDS = 12 * 60 * 60;
export const DISCOVERY_PRODUCTION_COOKIE = '__Host-codevivo-discovery';
export const DISCOVERY_DEVELOPMENT_COOKIE = 'codevivo-discovery-dev';

type NodeEnvironment = 'development' | 'production' | 'test';

export function getDiscoveryCookieName(
  environment: NodeEnvironment | undefined = process.env.NODE_ENV,
): string {
  return environment === 'production'
    ? DISCOVERY_PRODUCTION_COOKIE
    : DISCOVERY_DEVELOPMENT_COOKIE;
}

export function getDiscoveryCookieOptions(
  expiresAt: Date,
  now = new Date(),
  environment: NodeEnvironment | undefined = process.env.NODE_ENV,
) {
  const remainingSeconds = Math.max(
    0,
    Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
  );

  return {
    httpOnly: true,
    secure: environment === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: Math.min(DISCOVERY_SESSION_SECONDS, remainingSeconds),
    expires: expiresAt,
  };
}
