import { useTranslations } from 'next-intl';

export default function ContactForm() {
  const t = useTranslations('contact');

  return (
    <section id="contact" className="border-b border-[color:var(--color-ash)]/30">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h2 className="text-center text-xl font-semibold sm:text-2xl">
          {t('title')}
        </h2>
        <form className="mt-6 rounded-xl border border-[color:var(--color-ash)]/40 bg-white/60 p-4 shadow-sm sm:mt-8 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-[color:var(--color-shadow)]/70">
              {t('name')}
              <input
                type="text"
                className="rounded-md border border-[color:var(--color-ash)]/60 bg-transparent px-3 py-2 text-sm text-[color:var(--color-shadow)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-blue)]/40"
                placeholder={t('namePlaceholder')}
              />
            </label>
            <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-[color:var(--color-shadow)]/70">
              {t('email')}
              <input
                type="email"
                className="rounded-md border border-[color:var(--color-ash)]/60 bg-transparent px-3 py-2 text-sm text-[color:var(--color-shadow)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-blue)]/40"
                placeholder={t('emailPlaceholder')}
              />
            </label>
          </div>
          <label className="mt-4 flex flex-col gap-2 text-xs uppercase tracking-wide text-[color:var(--color-shadow)]/70">
            {t('message')}
            <textarea
              rows={4}
              className="rounded-md border border-[color:var(--color-ash)]/60 bg-transparent px-3 py-2 text-sm text-[color:var(--color-shadow)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-blue)]/40"
              placeholder={t('messagePlaceholder')}
            />
          </label>
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              className="w-full rounded-md border border-[color:var(--color-blue)] bg-[color:var(--color-blue)] px-6 py-2 text-xs font-medium text-white transition hover:bg-[color:var(--color-honeydew)] hover:text-[color:var(--color-shadow)] sm:w-auto"
            >
              {t('cta')}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
