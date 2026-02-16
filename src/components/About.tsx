import { useTranslations } from 'next-intl';

export default function About() {
  const t = useTranslations('about');

  return (
    <section id="about" className="border-b border-[color:var(--color-ash)]/30">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 text-center sm:px-6">
        <h2 className="text-xl font-semibold sm:text-2xl">{t('title')}</h2>
        <p className="mt-4 text-sm text-[color:var(--color-shadow)]/70 sm:text-base">
          {t('body')}
        </p>
        <div className="mt-6 flex justify-center">
          <a
            href="#projects"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[color:var(--color-blue)] bg-[color:var(--color-blue)] px-4 py-2 text-xs font-medium text-white transition hover:bg-[color:var(--color-honeydew)] hover:text-[color:var(--color-shadow)] sm:w-auto"
          >
            {t('cta')}
          </a>
        </div>
      </div>
    </section>
  );
}
