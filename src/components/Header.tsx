'use client';

/**
 * Header
 *
 * Purpose:
 * Renders the shared sticky header with brand navigation and theme/locale controls.
 *
 * Context:
 * Mounted by `ClientShell` across all localized pages.
 *
 * Dependencies:
 * - next-intl for localized navigation labels
 * - `ThemeToggle` and `LanguageToggle`
 * - shared brand and surface styling tokens
 *
 * Notes:
 * - Section links rely on homepage anchor IDs staying stable.
 * - Keep route generation locale-aware from this component rather than hardcoding paths downstream.
 */
import { useEffect, useState, type MouseEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import LanguageToggle from './LanguageToggle';
import ThemeToggle from './ThemeToggle';
import Logo from './ui/Logo';

export default function Header() {
  // Retrieve localized strings from next-intl messages (DO NOT hardcode text).
  const t = useTranslations('header');
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const closeMenu = () => {
    setIsOpen(false);
  };

  const handleHomeClick = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById('hero');

    if (el) {
      e.preventDefault();
      closeMenu();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    closeMenu();
  };

  return (
    <header className='sticky top-0 z-50 text-fg relative bg-[linear-gradient(to_bottom,var(--surface-main)_0%,var(--surface-main)_57%,transparent_100%)]'>
      <div className='mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-6 sm:px-6 sm:py-6'>
        <Link
          href={`/${locale}`}
          scroll={true}
          className='text-base font-semibold tracking-tight text-fg sm:text-lg'
          onClick={handleHomeClick}
        >
          <Logo priority />
        </Link>

        <button
          type='button'
          aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className='surface-card flex h-10 w-10 items-center justify-center rounded-lg bg-surface/60 text-fg backdrop-blur-md transition-colors hover:text-primary md:hidden'
        >
          {isOpen ? <X className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
        </button>

        <nav className='hidden items-center gap-4 font-mono-var text-sm md:flex'>
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

      <div
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-200 md:hidden ${isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={closeMenu}
        aria-hidden={!isOpen}
      />

      <div
        className={`fixed top-0 right-0 z-[70] flex h-screen w-3/4 max-w-sm flex-col border-l border-border bg-[var(--panel-bg)] p-6 glass-effect transition-transform duration-200 md:hidden ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!isOpen}
      >
        <div className='flex items-center justify-end'>
          <button
            type='button'
            aria-label='Close navigation menu'
            onClick={closeMenu}
            className='surface-card flex h-10 w-10 items-center justify-center rounded-lg bg-surface/60 text-fg backdrop-blur-md transition-colors hover:text-primary'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        <nav className='mt-8 flex flex-col items-start gap-8 font-mono-var text-lg'>
          <Link
            href={`/${locale}`}
            className='inline-flex min-h-12 items-center text-fg transition-colors duration-300 hover:text-primary'
            onClick={handleHomeClick}
          >
            {t('nav.home')}
          </Link>
          <Link
            href={`/${locale}#tools`}
            className='inline-flex min-h-12 items-center text-fg transition-colors duration-300 hover:text-primary'
            onClick={closeMenu}
          >
            {t('nav.tools')}
          </Link>
          <Link
            href='/projects'
            className='inline-flex min-h-12 items-center text-fg transition-colors duration-300 hover:text-primary'
            onClick={closeMenu}
          >
            {t('nav.projects')}
          </Link>
          <Link
            href={`/${locale}#about`}
            className='inline-flex min-h-12 items-center text-fg transition-colors duration-300 hover:text-primary'
            onClick={closeMenu}
          >
            {t('nav.about')}
          </Link>
          <Link
            href={`/${locale}#contact`}
            className='inline-flex min-h-12 items-center text-fg transition-colors duration-300 hover:text-primary'
            onClick={closeMenu}
          >
            {t('nav.contact')}
          </Link>
        </nav>

        <div className='mt-auto flex items-center gap-3 pt-8'>
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}
