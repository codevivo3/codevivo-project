import type { Metadata } from 'next';
import { Montserrat, Roboto_Mono } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';

import './globals.css';

import NavBar from './components/NavBar';

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  display: 'swap',
});

const robotoMono = Roboto_Mono({
  variable: '--font-roboto-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'codevivo.dev',
  description: 'Personal Portfolio of Francesco De Vivo',
  icons: {
    icon: '/favicon.svg',
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
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

  return (
    <html lang={locale}>
      <head>
        <link rel='icon' href='/favicon.svg' type='image/svg+xml' />
      </head>
      <body
        className={`${montserrat.variable} ${robotoMono.variable} antialiased`}
      >
        <NextIntlClientProvider>
          <NavBar />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
