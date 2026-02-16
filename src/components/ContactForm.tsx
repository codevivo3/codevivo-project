import { useTranslations } from 'next-intl';

export default function ContactForm() {
  const t = useTranslations('contact');

  return (
    <section id="contact" className="section-flow">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h2 className="text-center text-xl font-semibold sm:text-2xl">
          {t('title')}
        </h2>
        <form className="mt-6 rounded-xl border border-border/40 bg-surface/60 p-4 shadow-sm sm:mt-8 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-fg/70">
              {t('name')}
              <input
                type="text"
                className="rounded-md border border-border/60 bg-transparent px-3 py-2 text-sm text-fg focus:border-primary focus:outline-none"
                placeholder={t('namePlaceholder')}
              />
            </label>
            <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-fg/70">
              {t('email')}
              <input
                type="email"
                className="rounded-md border border-border/60 bg-transparent px-3 py-2 text-sm text-fg focus:border-primary focus:outline-none"
                placeholder={t('emailPlaceholder')}
              />
            </label>
          </div>
          <label className="mt-4 flex flex-col gap-2 text-xs uppercase tracking-wide text-fg/70">
            {t('message')}
            <textarea
              rows={4}
              className="rounded-md border border-border/60 bg-transparent px-3 py-2 text-sm text-fg focus:border-primary focus:outline-none"
              placeholder={t('messagePlaceholder')}
            />
          </label>
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              className="w-full rounded-md border border-primary bg-primary px-6 py-2 text-xs font-medium text-fg transition hover:bg-surface hover:text-fg sm:w-auto"
            >
              {t('cta')}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
