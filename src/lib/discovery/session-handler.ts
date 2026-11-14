import { createHash } from 'node:crypto';
import { getDiscoveryCookieName, getDiscoveryCookieOptions } from './cookies';
import { parseDiscoveryCredential } from './credential-core';
import { isAllowedDiscoveryOrigin } from './origin';
import { applyDiscoverySecurityHeaders } from './security-headers';

type ExchangeOutcome =
  | {
      outcome: 'established';
      sessionExpiresAt: Date;
      rawSessionCredential: string;
    }
  | { outcome: 'expired' | 'unavailable' };

export type DiscoverySessionHandlerDependencies = {
  exchange(token: unknown): Promise<ExchangeOutcome>;
  limit(input: { ipAddress: string; tokenDigest: string }): Promise<boolean>;
  now(): Date;
  baseUrl?: string;
  environment?: 'development' | 'production' | 'test';
};

function jsonResponse(body: object, status: number): Response {
  const headers = applyDiscoverySecurityHeaders(
    new Headers({ 'Content-Type': 'application/json' }),
  );
  return new Response(JSON.stringify(body), { status, headers });
}

function getRequestIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function handleDiscoverySessionPost(
  request: Request,
  dependencies: DiscoverySessionHandlerDependencies,
): Promise<Response> {
  if (!isAllowedDiscoveryOrigin(request, dependencies.baseUrl)) {
    return jsonResponse({ status: 'unavailable' }, 403);
  }

  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return jsonResponse({ status: 'unavailable' }, 415);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ status: 'unavailable' }, 400);
  }

  const token =
    body && typeof body === 'object' && 'token' in body
      ? (body as { token?: unknown }).token
      : undefined;

  let validToken: string;
  try {
    validToken = parseDiscoveryCredential(token);
  } catch {
    return jsonResponse({ status: 'unavailable' }, 400);
  }

  const tokenDigest = createHash('sha256')
    .update('codevivo.discovery.rate-limit.v1\0', 'utf8')
    .update(validToken, 'utf8')
    .digest('hex');

  let allowed = false;
  try {
    allowed = await dependencies.limit({
      ipAddress: getRequestIp(request.headers),
      tokenDigest,
    });
  } catch {
    allowed = false;
  }
  if (!allowed) return jsonResponse({ status: 'unavailable' }, 429);

  let result: ExchangeOutcome;
  try {
    result = await dependencies.exchange(validToken);
  } catch {
    return jsonResponse({ status: 'unavailable' }, 400);
  }

  if (result.outcome !== 'established') {
    return result.outcome === 'expired'
      ? jsonResponse({ status: 'expired' }, 410)
      : jsonResponse({ status: 'unavailable' }, 404);
  }

  const now = dependencies.now();
  const options = getDiscoveryCookieOptions(
    result.sessionExpiresAt,
    now,
    dependencies.environment,
  );
  const cookieName = getDiscoveryCookieName(dependencies.environment);
  const cookie = [
    `${cookieName}=${result.rawSessionCredential}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${options.maxAge}`,
    `Expires=${result.sessionExpiresAt.toUTCString()}`,
    ...(options.secure ? ['Secure'] : []),
  ].join('; ');

  const response = jsonResponse({ status: 'established' }, 201);
  response.headers.append('Set-Cookie', cookie);
  return response;
}
