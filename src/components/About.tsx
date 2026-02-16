import { useTranslations } from 'next-intl';

export default function About() {
  const t = useTranslations('about');

  return (
    <section id="about" className="section-flow">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 text-center sm:px-6">
        <h2 className="text-xl font-semibold sm:text-2xl">{t('title')}</h2>
        <p className="mt-4 text-sm text-fg/70 sm:text-base">
          {t('body')}
        </p>
        <div className="mt-6 flex justify-center">
          <a
            href="#projects"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-primary bg-primary px-4 py-2 text-xs font-medium text-fg transition hover:bg-surface hover:text-fg sm:w-auto"
          >
            {t('cta')}
          </a>
        </div>
      </div>
    </section>
  );
}
