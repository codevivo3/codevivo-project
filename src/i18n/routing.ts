// File: src/i18n/routing.ts
// Description: Defines locale routing settings for the Next.js internationalization setup
// - Supported locales: English (en), Italian (it)
// - Default locale: English (en)
// - Locale prefix: Added only when needed (e.g., `/it/about` but `/about` defaults to English)
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'it'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});
