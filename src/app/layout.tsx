// File: src/app/layout.tsx
// Purpose: Root layout file for the application. Sets global fonts and wraps all pages with shared HTML and body tags.

import type { Metadata } from 'next';
// Importing Google Fonts (Montserrat and Roboto Mono) using next/font
import { Montserrat, Roboto_Mono } from 'next/font/google';
// Importing global styles from the locale-specific folder
import './globals.css'; // keep as-is if globals.css is inside [locale]; otherwise change to './globals.css' only if file is moved
import { Analytics } from '@vercel/analytics/react';

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
  title: 'CodeVivo — Web Development & Digital Projects',
  description:
    'CodeVivo is the portfolio of Francesco De Vivo, focused on modern web development using React, Next.js, and TypeScript.',
  metadataBase: new URL('https://codevivo.dev'),
  openGraph: {
    title: 'CodeVivo',
    description:
      'Portfolio of Francesco De Vivo — modern web development with React and Next.js.',
    url: 'https://codevivo.dev',
    siteName: 'CodeVivo',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og/codevivo-og.png',
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
    images: ['/og/codevivo-og.png'],
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'light') {
                    document.documentElement.classList.add('light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      {/* Apply font variables and antialiasing to body */}
      <body
        className={`${montserrat.variable} ${robotoMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
