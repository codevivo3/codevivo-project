import { useTranslations } from 'next-intl';

import Link from 'next/link';
import Button from './ui/Button';

/**
 * About
 *
 * Purpose:
 * Renders the about section with supporting copy and a projects CTA.
 *
 * Behavior:
 * - Large screens: uses the shared section reveal classes only
 * - Medium screens: keeps the same content structure with wider spacing
 * - Mobile: content is immediately visible and stable on first render
 *
 * Notes:
 * - This component does not manage motion directly
 * - Visibility is controlled by static section classes rather than component state
 */

export default function About() {
  // Derived values
  const t = useTranslations('about');

  // Render
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
