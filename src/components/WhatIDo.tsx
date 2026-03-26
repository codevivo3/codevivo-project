/**
 * WhatIDo
 *
 * Purpose:
 * Renders the homepage services summary using translation-provided item lists.
 *
 * Context:
 * Used on the homepage to summarize service areas before the tech and project sections.
 *
 * Dependencies:
 * - next-intl for headings, intro text, and item arrays
 * - shared `surface-card` presentation styles
 *
 * Notes:
 * - Optional message keys fall back locally to keep the section resilient.
 * - Item content should remain translation-driven rather than embedded here.
 */
import { useTranslations } from 'next-intl';

export default function WhatIDo() {
  // Retrieve localized strings from next-intl messages (DO NOT hardcode text).
  const t = useTranslations('whatIDo');
  const rawItems = t.raw('items');
  const items = Array.isArray(rawItems) ? rawItems : [];
  const overline = t.has('overline') ? t('overline') : t('title');
  const intro = t.has('intro') ? t('intro') : '';

  return (
    <section id='what-i-do' className='section-block'>
      <div
        className='section-reveal mx-auto w-full max-w-5xl px-4 py-10 sm:px-6'
        style={{ ['--reveal-delay' as string]: '60ms' }}
      >
        <div className='mb-4 flex flex-col items-center'>
          <h2 className='text-center text-xl font-semibold sm:text-2xl'>
            {t('title')}
          </h2>
          <span className='mt-2 h-px w-10 bg-primary/70'></span>
          {intro ? (
            <p className='whitespace-pre-line mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-fg/72 sm:text-base'>
              {intro}
            </p>
          ) : null}
        </div>
        <div className='mt-8 grid gap-4 md:grid-cols-3'>
          {items.map((item) => (
            <div
              key={item}
              className='glass-effect surface-card rounded-xl bg-[var(--panel-bg)] px-5 py-6 text-center'
            >
              <p className='text-sm leading-relaxed text-fg/78 sm:text-base'>
                {item}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
