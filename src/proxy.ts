/**
<<<<<<< Updated upstream
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
=======
 * proxy
 *
 * Purpose:
 * Configures the locale-aware middleware used to route requests through `next-intl`.
 *
 * Context:
 * Runs before page rendering so locale detection works across public routes.
 *
 * Notes:
 * The matcher excludes assets and internal routes to avoid unnecessary middleware work.
 */

>>>>>>> Stashed changes
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
export default createMiddleware(routing);
export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
