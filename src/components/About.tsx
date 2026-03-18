import { useTranslations } from 'next-intl';

import Link from 'next/link';

export default function About() {
  const t = useTranslations('about');

  return (
    <section id="about" className="section-block">
      <div
        className="section-reveal mx-auto w-full max-w-3xl px-4 py-10 text-center sm:px-6"
        style={{ ['--reveal-delay' as string]: '140ms' }}
      >
        <div className="mb-4 flex flex-col items-center">
          <p className="text-center font-mono-var text-[11px] uppercase tracking-[0.22em] text-fg/60">
            {t('overline')}
          </p>
          <span className="mt-2 h-px w-10 bg-primary/70"></span>
        </div>
        <h2 className="text-xl font-semibold sm:text-2xl">{t('title')}</h2>
        <p className="mt-4 text-sm text-fg/72 sm:text-base text-justify whitespace-pre-line leading-relaxed">
          {t('body')}
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/projects"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-primary bg-primary px-4 py-2 text-xs font-medium text-fg transition hover:bg-surface hover:text-fg sm:w-auto"
          >
            {t('cta')}
          </Link>
        </div>
      </div>
    </section>
  );
}
