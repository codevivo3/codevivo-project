import { useTranslations } from 'next-intl';
import ButtonBlue from '@/components/buttons/ButtonBlue';

export default function ContactForm() {
  const t = useTranslations('contact');

  return (
    <section id="contact" className="section-block">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-4 flex flex-col items-center">
          <p className="text-center font-mono-var text-[11px] uppercase tracking-[0.22em] text-fg/60">
            {t('overline')}
          </p>
          <span className="mt-2 h-px w-10 bg-primary/70"></span>
        </div>
        <h2 className="text-center text-xl font-semibold sm:text-2xl">
          {t('title')}
        </h2>
        <form className="mt-6 rounded-xl surface-card bg-surface/60 p-6 sm:mt-8 sm:p-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.2em] text-fg/60 font-mono-var">
              {t('name')}
              <input
                type="text"
                className="brand-border border-b bg-transparent px-1 py-2 text-sm text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                placeholder={t('namePlaceholder')}
              />
            </label>
            <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.2em] text-fg/60 font-mono-var">
              {t('email')}
              <input
                type="email"
                className="brand-border border-b bg-transparent px-1 py-2 text-sm text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                placeholder={t('emailPlaceholder')}
              />
            </label>
          </div>
          <label className="mt-6 flex flex-col gap-2 text-[11px] uppercase tracking-[0.2em] text-fg/60 font-mono-var">
            {t('message')}
            <textarea
              rows={6}
              className="brand-border min-h-[160px] border-b bg-transparent px-1 py-2 text-sm text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              placeholder={t('messagePlaceholder')}
            />
          </label>
          <div className="mt-8 flex justify-end">
            <ButtonBlue type="button">{t('cta')}</ButtonBlue>
          </div>
        </form>
      </div>
    </section>
  );
}
