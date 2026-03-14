import type { Metadata } from 'next';
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

// Pre-generate static paths for supported locales
export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'it' }];
}

// Locale layout (NO html/body here — root layout handles that)
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ClientShell>{children}</ClientShell>
    </NextIntlClientProvider>
  );
}
