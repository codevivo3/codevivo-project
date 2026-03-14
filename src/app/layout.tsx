// File: src/app/layout.tsx
// Purpose: Root layout file for the application. Sets global fonts and wraps all pages with shared HTML and body tags.

import type { Metadata } from 'next';
// Importing Google Fonts (Montserrat and Roboto Mono) using next/font
import { Montserrat, Roboto_Mono } from 'next/font/google';
// Importing global styles from the locale-specific folder
import './globals.css'; // keep as-is if globals.css is inside [locale]; otherwise change to './globals.css' only if file is moved
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Script from 'next/script';

// Configure Montserrat font with CSS variable for usage in the layout
const montserrat = Montserrat({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

// Configure Roboto Mono font with CSS variable for usage in the layout
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

// RootLayout component wraps the app with base HTML structure and font classes
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Set default language attribute and wrap the page content
    <html lang='en' suppressHydrationWarning>
      {/* Apply font variables and antialiasing to body */}
      <body
        className={`${montserrat.variable} ${robotoMono.variable} antialiased`}
      >
        <Script id='theme-init' strategy='beforeInteractive'>
          {`
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
