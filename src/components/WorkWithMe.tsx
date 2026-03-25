/**
 * WorkWithMe
 *
 * Purpose:
 * Renders the collaboration CTA card with service tags and a mail link.
 *
 * Context:
 * Used on the homepage after featured projects as a conversion-focused section.
 *
 * Dependencies:
 * - next-intl for headings, copy, and CTA text
 * - shared `surface-card` styling tokens
 *
 * Notes:
 * - Message fallbacks are resolved locally so missing optional keys do not break the section.
 * - Keep the CTA as a direct mail link unless the contact flow changes site-wide.
 */
import { useTranslations } from 'next-intl';

export default function WorkWithMe() {
  // Retrieve localized strings from next-intl messages (DO NOT hardcode text).
  const t = useTranslations('workWithMe');
  const rawItems = t.raw('items');
  const items = Array.isArray(rawItems) ? rawItems : [];
  const overline = t.has('overline') ? t('overline') : t('title');
  const description = t.has('description')
    ? t('description')
    : t.has('intro')
      ? t('intro')
      : '';
  const cta = t.has('cta')
    ? t('cta')
    : `${t.has('ctaLabel') ? t('ctaLabel') : "Let's talk:"} hello@codevivo.dev`;

  return (
    <section id='work-with-me' className='section-block'>
      <div
        className='section-reveal mx-auto w-full max-w-3xl px-4 py-10 sm:px-6'
        style={{ ['--reveal-delay' as string]: '100ms' }}
      >
        <div className='glass-effect mx-auto max-w-3xl rounded-2xl surface-card bg-[var(--panel-bg)] px-6 py-8 text-center sm:px-8'>
          <div className='mb-4 flex flex-col items-center'>
            <h2 className='text-xl font-semibold sm:text-2xl'>{t('title')}</h2>
            <span className='mt-2 h-px w-10 bg-primary/70'></span>
            {description ? (
              <p className='mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-fg/72 sm:text-base'>
                {description}
              </p>
            ) : null}
          </div>
          <div className='mt-6 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center'>
            {items.map((item) => (
              <span
                key={item}
                className='w-full max-w-[240px] text-center md:w-auto md:max-w-none md:min-w-[200px] rounded-full border border-border bg-[var(--brand-gold)] px-3 py-1.5 text-xs font-semibold text-black sm:text-sm'
              >
                {item}
              </span>
            ))}
          </div>
          <p className='mt-6 text-sm text-fg/72 sm:text-base'>
            <a
              href='mailto:hello@codevivo.dev'
              className='text-primary font-semibold transition-colors hover:text-fg'
            >
              {cta}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
