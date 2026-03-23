/**
 * About
 *
 * Purpose:
 * Renders the homepage about section and links users to the full projects page.
 *
 * Context:
 * Used on the localized homepage near the end of the main content flow.
 *
 * Dependencies:
 * - next-intl for localized copy
 * - shared `Button` styles for the CTA
 * - shared section spacing and reveal utility classes
 *
 * Notes:
 * - Keep the CTA destination aligned with the projects page route structure.
 * - Copy should stay message-driven; avoid hardcoded text here.
 */
import { useTranslations } from 'next-intl';

import Link from 'next/link';
import Button from './ui/Button';

export default function About() {
  // Retrieve localized strings from next-intl messages (DO NOT hardcode text).
  const t = useTranslations('about');
  return (
    <section id='about' className='section-block'>
      <div
        className='section-reveal mx-auto w-full max-w-3xl px-4 py-10 text-center sm:px-6'
        style={{ ['--reveal-delay' as string]: '140ms' }}
      >
        <div className='mb-4 flex flex-col items-center'>
          <p className='text-center font-mono-var text-[11px] uppercase tracking-[0.22em] text-fg/60'>
            {t('overline')}
          </p>
          <span className='mt-2 h-px w-10 bg-primary/70'></span>
        </div>
        <h2 className='text-xl font-semibold sm:text-2xl'>{t('title')}</h2>
        <p className='mt-4 text-sm text-fg/72 sm:text-base text-justify whitespace-pre-line leading-relaxed'>
          {t('body')}
        </p>
        <div className='mt-6 flex justify-center'>
          <Link href='/projects'>
            <Button>{t('cta')}</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
