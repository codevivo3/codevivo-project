/****
 * i18n Proxy Middleware
 *
 * Purpose:
 * Applies locale-aware middleware to application routes using the shared routing configuration.
 *
 * Context:
 * Runs before matching requests so localized route handling is consistent.
 *
 * Dependencies:
 * - next-intl middleware
 * - locale definitions from `src/i18n/routing.ts`
 *
 * Notes:
 * - The matcher intentionally excludes API, static asset, and Next internals.
 * - Route matching changes here affect the whole application entry flow.
 */

import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { isDiscoveryPath } from '@/lib/discovery/paths';
import { applyDiscoverySecurityHeaders } from '@/lib/discovery/security-headers';

const intlMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/discovery/')) {
    const response = NextResponse.next();
    applyDiscoverySecurityHeaders(response.headers);
    return response;
  }

  const response = intlMiddleware(request);
  if (isDiscoveryPath(request.nextUrl.pathname)) {
    applyDiscoverySecurityHeaders(response.headers);
  }
  return response;
}

export const config = {
  matcher: [
    '/api/discovery/:path*',
    '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
  ],
};
