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
import { useEffect, useState, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import LanguageToggle from './LanguageToggle';
import ThemeToggle from './ThemeToggle';
import Logo from './ui/Logo';

export default function Header() {
  // Retrieve localized strings from next-intl messages (DO NOT hardcode text).
  const t = useTranslations('header');
  const locale = useLocale();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const scrolledRef = useRef(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const ENTER = 40; // start shrinking after this
    const EXIT = 12;  // expand back only below this

    const handleScroll = () => {
      const y = window.scrollY;

      if (!scrolledRef.current && y > ENTER) {
        scrolledRef.current = true;
        setIsScrolled(true);
      } else if (scrolledRef.current && y < EXIT) {
        scrolledRef.current = false;
        setIsScrolled(false);
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <header className='sticky top-0 z-50 text-fg relative bg-[linear-gradient(to_bottom,var(--surface-main)_0%,var(--surface-main)_57%,transparent_100%)]'>
      <div
        className={`mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-6 sm:px-6 md:origin-top md:transform-gpu md:will-change-transform md:transition-[transform,padding,opacity] md:duration-500 md:ease-[cubic-bezier(0.22,1,0.36,1)] ${isScrolled ? 'md:scale-[0.94] md:py-4 md:opacity-95' : 'md:scale-100 md:py-6 md:opacity-100'}`}
      >
        <Link
          href='/'
          scroll={false}
          className='text-base font-semibold tracking-tight text-fg sm:text-lg'
          onClick={(e) => {
            e.preventDefault();
            closeMenu();
            router.push('/');
            window.scrollTo({ top: 0, behavior: 'instant' });
          }}
        >
          <Logo priority className='h-4 sm:h-5 md:h-7 lg:h-6 xl:h-6 2xl:h-6' />
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
            href='/projects'
            scroll={true}
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
        className={`fixed top-0 right-0 z-[70] flex h-screen w-3/4 max-w-sm flex-col border-l border-border bg-[var(--panel-bg)] p-6 pt-8 glass-effect transition-transform duration-200 md:hidden ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!isOpen}
      >
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3 h-10'>
            <ThemeToggle />
            <LanguageToggle />
          </div>

          <button
            type='button'
            aria-label='Close navigation menu'
            onClick={closeMenu}
            className='surface-card flex h-10 w-10 items-center justify-center rounded-lg bg-surface/60 text-fg backdrop-blur-md transition-colors hover:text-primary'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        <nav className='mt-12 flex flex-col items-start gap-10 font-mono-var text-3xl tracking-wide md:hidden'>
          <Link
            href='/'
            scroll={true}
            className='inline-flex min-h-12 items-center text-fg transition-colors duration-300 hover:text-primary'
            onClick={closeMenu}
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
            scroll={true}
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

      </div>
    </header>
  );
}
