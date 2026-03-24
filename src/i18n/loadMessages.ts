/**
 * loadMessages
 *
 * Purpose:
<<<<<<< Updated upstream
 * Loads and merges all JSON message namespaces for a given locale from disk.
 *
 * Context:
 * Utility for local message loading outside the main next-intl request configuration.
 *
 * Dependencies:
 * - Node `fs` and `path`
 * - locale directories under `src/messages`
 *
 * Notes:
 * - The locale argument must match an existing folder name under `src/messages`.
 * - Namespace keys are derived from file names (for example `projectsPage.json` -> `projectsPage`).
 */
=======
 * Loads and namespaces locale JSON message files from disk.
 *
 * Context:
 * Available as a synchronous helper for places that need raw translation bundles.
 *
 * Notes:
 * Each JSON filename becomes a namespace key in the returned messages object.
 */

>>>>>>> Stashed changes
import fs from 'fs';
import path from 'path';

export function loadMessages(locale: string) {
  // Derived values
  const messagesDir = path.join(process.cwd(), 'src/messages', locale);

  const files = fs.readdirSync(messagesDir);

  const messages = files.reduce(
    (acc, file) => {
      if (!file.endsWith('.json')) return acc;

      const filePath = path.join(messagesDir, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Use the file name as the next-intl namespace key.
      const namespace = file.replace('.json', '');

      acc[namespace] = content;

      return acc;
    },
    {} as Record<string, unknown>,
  );

  return messages;
}
