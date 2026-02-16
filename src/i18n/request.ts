/**
 * src/i18n/request.ts
 * 
 * This file defines the server-side i18n request configuration for next-intl.
 * It resolves the appropriate locale using requestLocale, checks against supported locales,
 * and falls back to the default locale when necessary.
 * Locale-specific translation messages are dynamically imported based on the resolved locale.
 */
import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  };
});
