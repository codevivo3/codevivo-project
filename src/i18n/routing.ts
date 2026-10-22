/**
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
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'it'],
  defaultLocale: 'en',
  // Page metadata owns hreflang so valid pages can emit canonical and alternate
  // URLs together without adding alternate headers to 404 responses.
  alternateLinks: false,
});
