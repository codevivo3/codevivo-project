/**
 * i18n Request Configuration
 *
 * Purpose:
 * Resolves the active locale for a request and loads the corresponding next-intl message payload.
 *
 * Context:
 * Used by next-intl on the server for every localized request.
 *
 * Dependencies:
 * - next-intl request config APIs
 * - locale routing rules from `src/i18n/routing.ts`
 * - JSON message namespaces under `src/messages`
 *
 * Notes:
 * - Unsupported locales fall back to the default locale defined in routing.
 * - Namespace keys come from JSON file names and are merged into one message object.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

async function loadMessages(locale: string) {
  // Derived values
  const localeDir = join(process.cwd(), 'src', 'messages', locale);
  const files = (await readdir(localeDir))
    .filter((file) => file.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));

  // Merge all namespace files for the locale into the single object expected by next-intl.
  const entries = await Promise.all(
    files.map(async (file) => {
      const content = await readFile(join(localeDir, file), 'utf8');
      return [file.replace(/\.json$/u, ''), JSON.parse(content)] as const;
    }),
  );

  return Object.fromEntries(entries);
}

export default getRequestConfig(async ({ requestLocale }) => {
  // Derived values
  const requested = await requestLocale;
  // Validate the incoming locale against the shared routing config before loading messages.
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
