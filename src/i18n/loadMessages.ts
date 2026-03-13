import fs from 'fs';
import path from 'path';

export function loadMessages(locale: string) {
  const messagesDir = path.join(process.cwd(), 'src/messages', locale);

  const files = fs.readdirSync(messagesDir);

  const messages = files.reduce(
    (acc, file) => {
      if (!file.endsWith('.json')) return acc;

      const filePath = path.join(messagesDir, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      const namespace = file.replace('.json', '');

      acc[namespace] = content;

      return acc;
    },
    {} as Record<string, unknown>,
  );

  return messages;
}
