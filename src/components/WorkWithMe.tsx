import { useTranslations } from 'next-intl';

export default function WorkWithMe() {
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
        <div className='mx-auto max-w-3xl rounded-2xl surface-card bg-surface/65 px-6 py-8 text-center backdrop-blur-md sm:px-8'>
          <div className='mb-4 flex flex-col items-center'>
            <p className='text-center font-mono-var text-[11px] uppercase tracking-[0.22em] text-fg/60'>
              {overline}
            </p>
            <span className='mt-2 h-px w-10 bg-primary/70'></span>
          </div>
          <h2 className='text-xl font-semibold sm:text-2xl'>{t('title')}</h2>
          {description ? (
            <p className='mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-fg/72 sm:text-base'>
              {description}
            </p>
          ) : null}
          <div className='mt-6 flex flex-wrap items-center justify-center gap-3'>
            {items.map((item) => (
              <span
                key={item}
                className='rounded-full border border-border bg-black/10 px-3 py-1.5 text-xs font-medium text-fg/78 sm:text-sm'
              >
                {item}
              </span>
            ))}
          </div>
          <p className='mt-6 text-sm text-fg/72 sm:text-base'>
            <a
              href='mailto:hello@codevivo.dev'
              className='text-primary transition-colors hover:text-fg'
            >
              {cta}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
