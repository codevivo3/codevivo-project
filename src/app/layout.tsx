// File: src/app/layout.tsx
// Purpose: Root layout file for the application. Sets global fonts and wraps all pages with shared HTML and body tags.

// Importing Google Fonts (Montserrat and Roboto Mono) using next/font
import { Montserrat, Roboto_Mono } from 'next/font/google';
// Importing global styles from the locale-specific folder
import './[locale]/globals.css';

// Configure Montserrat font with CSS variable for usage in the layout
const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  display: 'swap',
});

// Configure Roboto Mono font with CSS variable for usage in the layout
const robotoMono = Roboto_Mono({
  variable: '--font-roboto-mono',
  subsets: ['latin'],
  display: 'swap',
});

// RootLayout component wraps the app with base HTML structure and font classes
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Set default language attribute and wrap the page content
    <html lang="en">
      {/* Apply font variables and antialiasing to body */}
      <body
        className={`${montserrat.variable} ${robotoMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
