/**
 * src/i18n/request.ts
 * 
 * This file defines the server-side i18n request configuration for next-intl.
 * It resolves the appropriate locale using requestLocale, checks against supported locales,
 * and falls back to the default locale when necessary.
 * Locale-specific translation messages are loaded from /src/messages/{locale} and
 * merged by file name into one object (e.g. projects.json -> messages.projects).
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

async function loadMessages(locale: string) {
  const localeDir = join(process.cwd(), 'src', 'messages', locale);
  const files = (await readdir(localeDir))
    .filter((file) => file.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));

  const entries = await Promise.all(
    files.map(async (file) => {
      const content = await readFile(join(localeDir, file), 'utf8');
      return [file.replace(/\.json$/u, ''), JSON.parse(content)] as const;
    }),
  );

  return Object.fromEntries(entries);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
