import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function Header() {
  const t = useTranslations('header');

  return (
    <header className="border-b border-[color:var(--color-ash)]/40 bg-[color:var(--background)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-[color:var(--foreground)] sm:text-lg"
        >
          {t('brand')}
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-4 text-xs sm:justify-end sm:text-sm">
          <a
            href="#about"
            className="text-[color:var(--foreground)] hover:text-[color:var(--color-blue)]"
          >
            {t('nav.about')}
          </a>
          <a
            href="#projects"
            className="text-[color:var(--foreground)] hover:text-[color:var(--color-blue)]"
          >
            {t('nav.projects')}
          </a>
          <a
            href="#tools"
            className="text-[color:var(--foreground)] hover:text-[color:var(--color-blue)]"
          >
            {t('nav.tools')}
          </a>
          <a
            href="#contact"
            className="text-[color:var(--foreground)] hover:text-[color:var(--color-blue)]"
          >
            {t('nav.contact')}
          </a>
        </nav>
      </div>
    </header>
  );
}
