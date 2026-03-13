// src/app/[locale]/not-found.tsx
// -------------------------------
// File: src/app/[locale]/not-found.tsx
// Description: Custom 404 page that displays when a route is not found.
// Localized with next-intl and rendered statically per locale.
// -------------------------------
import Button from '@/components/ui/Button';
import { getTranslations } from 'next-intl/server';

import { getLocale } from 'next-intl/server';


// Force this route to be statically rendered per locale
// export const dynamic = 'force-static';

// The main NotFound component fetches the user's locale and translation messages,
// then displays a localized error message with a link back to the homepage.
export default async function NotFound() {
  // Detect the current locale from the request context
  const locale = await getLocale();

  // Load the translation messages for the current locale
  const t = await getTranslations({ locale });

  return (
    <main className='relative min-h-screen flex items-center justify-center px-4 py-16 text-center overflow-hidden'>
      {/* Background 404 decoration */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="text-[12rem] md:text-[16rem] font-bold text-fg/5 select-none">
          404
        </span>
      </div>
      <div className='surface-card relative p-8 md:p-10 rounded-2xl max-w-md'>
        <h1 className='text-7xl md:text-8xl font-bold mb-4 text-accent'>
          404
        </h1>

        <h2 className='text-xl md:text-2xl font-semibold mb-3'>
          {t('not-found.title')}
        </h2>
        <p className='text-base md:text-lg text-fg/70 mb-8'>
          {t('not-found.description')}
        </p>
        {/* Link back to the localized homepage */}
        <Button href={`/${locale}`}>{t('not-found.homeLink')}</Button>
      </div>
    </main>
  );
}
