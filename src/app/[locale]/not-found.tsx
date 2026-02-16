// src/app/[locale]/not-found.tsx
// -------------------------------
// File: src/app/[locale]/not-found.tsx
// Description: Custom 404 page that displays when a route is not found.
// Localized with next-intl and rendered statically per locale.
// -------------------------------
import { getTranslations } from 'next-intl/server';

import { getLocale } from 'next-intl/server';
import Link from 'next/link';

// Force this route to be statically rendered per locale
export const dynamic = 'force-static';

// The main NotFound component fetches the user's locale and translation messages,
// then displays a localized error message with a link back to the homepage.
export default async function NotFound() {
  // Detect the current locale from the request context
  const locale = await getLocale();

  // Load the translation messages for the current locale
  const t = await getTranslations({ locale });

  return (
    <main className='min-h-screen flex flex-col items-center justify-center px-4 py-16 text-center'>
      <h1 className='text-5xl font-bold mb-4 text-red-500'>
        {t('not-found.title')}
      </h1>
      <p className='text-base md:text-lg text-gray-500 mb-6'>
        {t('not-found.description')}
      </p>
      {/* Link back to the localized homepage */}
      <Link
        href={`/${locale}`}
        className='text-sm font-medium border border-gray-300 px-4 py-2 rounded hover:bg-[var(--color-blue)] hover:text-[var(--color-honeydew)] transition hover:font-bold'
      >
        {t('not-found.homeLink')}
      </Link>
    </main>
  );
}
