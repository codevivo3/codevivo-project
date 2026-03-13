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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = hasLocale(routing.locales, locale)
    ? locale
    : routing.defaultLocale;
  const currentLocale = localeMetadata[resolvedLocale];

  return {
    title: {
      default: 'CodeVivo — Modern Web Development',
      template: '%s | CodeVivo',
    },
    description:
      'CodeVivo is the portfolio of Francesco De Vivo, focused on modern web development using React, Next.js, and TypeScript.',

    alternates: {
      canonical: currentLocale.canonical,
      languages: {
        en: 'https://codevivo.dev',
        it: 'https://codevivo.dev/it',
      },
    },

    openGraph: {
      title: 'CodeVivo — Modern Web Development with React & Next.js',
      description:
        'Portfolio of Francesco De Vivo — building modern web applications with React, Next.js and TypeScript.',
      url: 'https://codevivo.dev',
      siteName: 'CodeVivo',
      type: 'website',
      locale: currentLocale.openGraphLocale,
      images: [
        {
          url: 'https://codevivo.dev/og/codevivo-og.png',
          width: 1200,
          height: 630,
          alt: 'CodeVivo Portfolio',
        },
      ],
    },

    twitter: {
      card: 'summary_large_image',
      title: 'CodeVivo',
      description:
        'Portfolio of Francesco De Vivo — modern web development with React and Next.js.',
      images: ['https://codevivo.dev/og/codevivo-og.png'],
    },

    icons: {
      icon: [
        { url: '/favicon.svg', type: 'image/svg+xml' },
        { url: '/favicon.ico', sizes: 'any' },
      ],
    },
  };
}

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
