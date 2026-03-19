'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import LanguageToggle from './LanguageToggle';
import ThemeToggle from './ThemeToggle';
import Logo from './ui/Logo';

/**
 * Header
 *
 * Purpose:
 * Renders the site header with brand navigation and locale/theme controls.
 *
 * Behavior:
 * - Large screens: stays sticky and spreads navigation horizontally
 * - Medium screens: keeps the same controls with responsive spacing
 * - Mobile: remains visible on first render with stacked layout and no hidden state
 *
 * Notes:
 * - This component does not own animation timing
 * - The hero shortcut scroll is client-driven but does not affect layout visibility
 */

export default function Header() {
  // Derived values
  const t = useTranslations('header');
  const locale = useLocale();

  // Render
  return (
    <header className='sticky top-0 z-50 text-fg relative bg-[linear-gradient(to_bottom,var(--surface-main)_0%,var(--surface-main)_57%,transparent_100%)]'>
      <div className='mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6'>
        <Link
          href={`/${locale}`}
          scroll={true}
          className='text-base font-semibold tracking-tight text-fg sm:text-lg'
          onClick={(e) => {
            const el = document.getElementById('hero');
            if (el) {
              e.preventDefault();
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
        >
          <Logo priority />
        </Link>
        <nav className='flex items-center gap-4 font-mono-var text-sm'>
          <Link
            href={`/${locale}#tools`}
            className='text-fg hover:text-primary transition-colors duration-300'
          >
            {t('nav.tools')}
          </Link>
          <Link
            href={`/projects`}
            className='text-fg hover:text-primary transition-colors duration-300'
          >
            {t('nav.projects')}
          </Link>
          <Link
            href={`/${locale}#about`}
            className='text-fg hover:text-primary transition-colors duration-300'
          >
            {t('nav.about')}
          </Link>
          <Link
            href={`/${locale}#contact`}
            className='text-fg hover:text-primary transition-colors duration-300'
          >
            {t('nav.contact')}
          </Link>
          <ThemeToggle />
          <LanguageToggle />
        </nav>
      </div>
    </header>
  );
}
