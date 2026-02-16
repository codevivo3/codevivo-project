// File: src/proxy.ts
// Middleware configuration for handling internationalized routing using next-intl.

// Import the middleware creation function from next-intl
import createMiddleware from 'next-intl/middleware';

// Import routing configuration object from our local i18n setup
import { routing } from '@/i18n/routing';

// Create and export the middleware using the routing config
export default createMiddleware(routing);

// Export matcher config to apply middleware only to certain routes
export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
