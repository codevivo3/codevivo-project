import { useTranslations } from 'next-intl';

/**
 * WhatIDo
 *
 * Purpose:
 * Renders the services summary section as a simple responsive card grid.
 *
 * Behavior:
 * - Large screens: displays the grid in multiple columns with static content
 * - Medium screens: keeps the same items with responsive wrapping
 * - Mobile: content is fully visible on first render with no trigger dependency
 *
 * Notes:
 * - This component does not manage animation directly
 * - Copy is translation-driven and safely falls back when optional fields are missing
 */

export default function WhatIDo() {
  // Derived values
  const t = useTranslations('whatIDo');
  const rawItems = t.raw('items');
  const items = Array.isArray(rawItems) ? rawItems : [];
  const overline = t.has('overline') ? t('overline') : t('title');
  const intro = t.has('intro') ? t('intro') : '';

  // Render
  return (
    <section id='what-i-do' className='section-block'>
      <div
        className='section-reveal mx-auto w-full max-w-5xl px-4 py-10 sm:px-6'
        style={{ ['--reveal-delay' as string]: '60ms' }}
      >
        <div className='mb-4 flex flex-col items-center'>
          <p className='text-center font-mono-var text-[11px] uppercase tracking-[0.22em] text-fg/60'>
            {overline}
          </p>
          <span className='mt-2 h-px w-10 bg-primary/70'></span>
        </div>
        <h2 className='text-center text-xl font-semibold sm:text-2xl'>
          {t('title')}
        </h2>
        {intro ? (
          <p className='mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-fg/72 sm:text-base'>
            {intro}
          </p>
        ) : null}
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
