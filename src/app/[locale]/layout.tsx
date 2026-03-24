
/**
 * LocaleLayout
 *
 * Purpose:
<<<<<<< Updated upstream
 * Validates the active locale, loads locale messages, and provides the localized client shell.
 *
 * Context:
 * Wraps every route under `src/app/[locale]` including the homepage and projects page.
 *
 * Dependencies:
 * - next-intl provider and server message loading
 * - shared routing rules from `src/i18n/routing.ts`
 * - shared header/footer shell from `ClientShell`
 *
 * Notes:
 * - Keep locale validation here so invalid locale segments fail fast.
 * - Do not introduce `html` or `body` tags here; the root layout owns them.
 */
=======
 * Validates the active locale and provides locale messages to the shared client shell.
 *
 * Context:
 * Wraps every localized route beneath the root layout.
 *
 * Notes:
 * This layout must not render its own `html` or `body` tags because the root layout owns them.
 */

>>>>>>> Stashed changes
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import { getMessages } from 'next-intl/server';
import ClientShell from '@/components/layout/ClientShell';

const localeMetadata = {
  en: {
    canonical: 'https://codevivo.dev',
    openGraphLocale: 'en_US',
  },
  it: {
    canonical: 'https://codevivo.dev/it',
    openGraphLocale: 'it_IT',
  },
} as const;

<<<<<<< Updated upstream
=======
// Derived values
>>>>>>> Stashed changes
export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'it' }];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Derived values
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Load locale-scoped messages once and provide them to all client components below.
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ClientShell>{children}</ClientShell>
    </NextIntlClientProvider>
  );
}
