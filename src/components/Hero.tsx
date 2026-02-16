import { useTranslations } from 'next-intl';

export default function Hero() {
  const t = useTranslations('hero');

  return (
    <section className="border-b border-[color:var(--color-ash)]/30">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between md:py-16">
        <div className="max-w-xl text-center md:text-left">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[color:var(--color-ash)]">
            {t('eyebrow')}
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight">
            {t('title')}
          </h1>
          <p className="mt-4 text-sm sm:text-base text-[color:var(--color-shadow)]/70">
            {t('subtitle')}
          </p>
          <div className="mt-8 flex justify-center md:justify-start">
            <a
              href="#projects"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[color:var(--color-blue)] bg-[color:var(--color-blue)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[color:var(--color-honeydew)] hover:text-[color:var(--color-shadow)] sm:w-auto"
            >
              {t('cta')}
            </a>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <div className="h-40 w-40 sm:h-56 sm:w-56 md:h-64 md:w-64 rounded-full bg-[color:var(--color-ash)]/30 shadow-inner" />
        </div>
      </div>
    </section>
  );
}
