import { useTranslations } from 'next-intl';

export default function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="bg-[color:var(--color-ash)]/30">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-center text-xs text-[color:var(--color-shadow)]/70 sm:px-6 md:flex-row md:text-left">
        <span>{t('brand')}</span>
        <span>{t('copyright')}</span>
      </div>
    </footer>
  );
}
