/**
<<<<<<< Updated upstream
 * i18n Routing
 *
 * Purpose:
 * Defines the canonical locale routing rules used across navigation and request handling.
 *
 * Context:
 * Shared by next-intl middleware, request config, and locale-aware navigation helpers.
 *
 * Dependencies:
 * - next-intl routing utilities
 *
 * Notes:
 * - Keep supported locales and default locale in sync with message folders.
 * - Changing this file affects URL structure across the application.
 */
=======
 * routing
 *
 * Purpose:
 * Defines the supported locales and default locale for `next-intl` routing.
 *
 * Context:
 * Shared by middleware, navigation helpers, and locale-aware layouts.
 *
 * Notes:
 * The locale list is the source of truth for route validation across the app.
 */

>>>>>>> Stashed changes
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'it'],
  defaultLocale: 'en',
});
