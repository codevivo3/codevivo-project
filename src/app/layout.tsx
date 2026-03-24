/**
 * RootLayout
 *
 * Purpose:
<<<<<<< Updated upstream
 * Defines the global HTML shell, shared metadata, fonts, analytics, and theme bootstrapping.
 *
 * Context:
 * Wraps every route in the application before locale-specific layout logic runs.
 *
 * Dependencies:
 * - next/font for shared typography tokens
 * - analytics integrations from Google Analytics and Vercel
 * - global design tokens from `src/app/globals.css`
 *
 * Notes:
 * - Keep `html` and `body` ownership here; locale layouts should not duplicate them.
 * - The inline theme script must run before hydration to avoid a light/dark flash.
=======
 * Defines the root HTML shell, global metadata, fonts, analytics, and startup scripts.
 *
 * Context:
 * Wraps every route in the app before locale-specific layout logic runs.
 *
 * Notes:
 * Theme initialization happens before hydration to avoid a visible flash on first paint.
>>>>>>> Stashed changes
 */

import type { Metadata } from 'next';
import { GoogleAnalytics } from '@next/third-parties/google';
import { Montserrat, Roboto_Mono } from 'next/font/google';
import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Script from 'next/script';

const montserrat = Montserrat({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

const robotoMono = Roboto_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'CodeVivo — Modern Web Development',
    template: '%s | CodeVivo',
  },
  description:
    'CodeVivo is the portfolio of Francesco De Vivo, focused on modern web development using React, Next.js, and TypeScript.',
  metadataBase: new URL('https://codevivo.dev'),
  openGraph: {
    title: 'CodeVivo — Modern Web Development with React & Next.js',
    description:
      'Portfolio of Francesco De Vivo — building modern web applications with React, Next.js and TypeScript.',
    url: 'https://codevivo.dev',
    siteName: 'CodeVivo',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CodeVivo',
    description:
      'Portfolio of Francesco De Vivo — modern web development with React and Next.js.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body
        className={`${montserrat.variable} ${robotoMono.variable} antialiased`}
      >
        <Script id='theme-init' strategy='beforeInteractive'>
          {`
  // Apply the persisted theme class before React hydration.
  (function() {
    try {
      var theme = localStorage.getItem('theme');
      if (theme === 'light') {
        document.documentElement.classList.add('light');
      }
    } catch (e) {}
  })();
`}
        </Script>
        {children}
        <GoogleAnalytics gaId='G-9PQ705W0XS' />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
