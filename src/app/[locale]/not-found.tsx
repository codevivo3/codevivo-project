/**
 * LocaleNotFoundPage
 *
 * Purpose:
 * Renders the localized 404 page and its locale-specific metadata.
 *
 * Context:
 * Used when a route inside a locale segment cannot be resolved by the app router.
 *
 * Notes:
 * Metadata stays in this file so the 404 experience remains localized end to end.
 */
import type { Metadata, ResolvingMetadata } from 'next';
import Button from '@/components/ui/Button';
import { getTranslations } from 'next-intl/server';
import { getLocale } from 'next-intl/server';

const notFoundMetadata = {
  en: {
    title: 'Page Not Found | CodeVivo',
    description:
      'The page you are looking for does not exist on CodeVivo or may have been moved.',
    url: 'https://codevivo.dev',
    locale: 'en_US',
  },
  it: {
    title: 'Pagina non trovata | CodeVivo',
    description:
      'La pagina che stai cercando su CodeVivo non esiste oppure e stata spostata.',
    url: 'https://codevivo.dev/it',
    locale: 'it_IT',
  },
} as const;

export async function generateMetadata(
  _props: never,
  parent: ResolvingMetadata
): Promise<Metadata> {
  // Derived values
  const locale = await getLocale();
  const currentLocale = locale === 'it' ? notFoundMetadata.it : notFoundMetadata.en;
  const parentMetadata = await parent;

  return {
    title: currentLocale.title,
    description: currentLocale.description,
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title: currentLocale.title,
      description: currentLocale.description,
      url: currentLocale.url,
      siteName: 'CodeVivo',
      locale: currentLocale.locale,
      type: 'website',
      images: parentMetadata.openGraph?.images,
    },
    twitter: {
      card: 'summary_large_image',
      title: currentLocale.title,
      description: currentLocale.description,
      images: parentMetadata.twitter?.images,
    },
  };
}


export default async function NotFound() {
  // Derived values
  const locale = await getLocale();
  const t = await getTranslations({ locale });

  return (
    <main className='relative min-h-screen flex items-center justify-center px-4 py-16 text-center overflow-hidden'>
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
        <Button href={`/${locale}`}>{t('not-found.homeLink')}</Button>
      </div>
    </main>
  );
}
