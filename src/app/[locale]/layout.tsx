import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import { getMessages } from 'next-intl/server';

// Define global metadata for the site, including title, description, and favicon
export const metadata: Metadata = {
  title: 'codevivo.dev',
  description: 'Personal Portfolio of Francesco De Vivo',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' }, // fallback for old browsers
    ],
  },
};

// Generate static paths for each supported locale (used in static site generation)
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Root layout component that sets up internationalization and page layout
export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Unwrap the async route parameters to get the locale
  const { locale } = await params;

  // If the locale is not supported, show a 404 page
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Load translations for the current locale
  const messages = await getMessages({ locale });

  // Provide translations to the app and render the layout
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
