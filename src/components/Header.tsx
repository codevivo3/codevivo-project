'use client';

/**
 * Header
 *
 * Purpose:
 * Renders the shared sticky header with brand navigation,
 * active-section indicators and theme/locale controls.
 *
 * Context:
 * Mounted by ClientShell across all localized pages.
 *
 * Dependencies:
 * - next-intl for localized navigation labels
 * - ThemeToggle and LanguageToggle
 * - Shared active-underline utility
 *
 * Notes:
 * - Section links rely on stable homepage anchor IDs.
 * - Active navigation follows the visible section or current route.
 * - Preserve locale-aware navigation and header animations.
 */
import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Menu, X } from 'lucide-react';
import LanguageToggle from './LanguageToggle';
import ThemeToggle from './ThemeToggle';
import Logo from './ui/Logo';

type ActiveSection = 'tools' | 'about' | 'contact' | null;

const homepageSections = ['tools', 'about', 'contact'] as const;

export default function Header() {
  const t = useTranslations('header');
  const router = useRouter();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>(null);

  const scrolledRef = useRef(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const ENTER = 40;
    const EXIT = 12;

    const handleScroll = () => {
      const y = window.scrollY;

      // Preserve the existing header shrinking behaviour.
      if (!scrolledRef.current && y > ENTER) {
        scrolledRef.current = true;
        setIsScrolled(true);
      } else if (scrolledRef.current && y < EXIT) {
        scrolledRef.current = false;
        setIsScrolled(false);
      }

      // Homepage section tracking.
      if (pathname !== '/' || y < EXIT) {
        setActiveSection(null);
        return;
      }

      const viewportCenter = window.innerHeight / 2;
      let currentSection: ActiveSection = null;

      for (const section of homepageSections) {
        const element = document.getElementById(section);

        if (!element) continue;

        const rect = element.getBoundingClientRect();

        if (rect.top <= viewportCenter && rect.bottom > viewportCenter) {
          currentSection = section;
          break;
        }
      }

      // Handle the compact contact section at the page bottom.
      const isAtBottom =
        y + window.innerHeight >= document.documentElement.scrollHeight - 4;

      if (isAtBottom && document.getElementById('contact')) {
        currentSection = 'contact';
      }

      setActiveSection(currentSection);
    };

    handleScroll();

    window.addEventListener('scroll', handleScroll, {
      passive: true,
    });

    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [pathname]);

  const closeMenu = () => {
    setIsOpen(false);
  };

  const isActive = (
    section: 'home' | 'tools' | 'projects' | 'about' | 'contact',
  ) => {
    if (section === 'projects') {
      return pathname === '/projects' || pathname.startsWith('/projects/');
    }

    if (section === 'home') {
      return pathname === '/' && !isScrolled;
    }

    return pathname === '/' && activeSection === section;
  };

  const navItems = [
    { key: 'tools', href: '/#tools' },
    { key: 'projects', href: '/projects' },
    { key: 'about', href: '/#about' },
    { key: 'contact', href: '/#contact' },
  ] as const;

  const mobileNavItems = [{ key: 'home', href: '/' }, ...navItems] as const;

  return (
    <header className='sticky top-0 z-50 isolate text-fg bg-[linear-gradient(to_bottom,var(--surface-main)_0%,var(--surface-main)_57%,transparent_100%)]'>
      <div
        className={`mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 md:origin-top md:transform-gpu md:will-change-transform md:transition-[transform,padding,opacity] md:duration-500 md:ease-[cubic-bezier(0.22,1,0.36,1)] ${isScrolled ? 'md:scale-[0.94] md:py-4 md:opacity-95' : 'md:scale-100 md:py-6 md:opacity-100'}`}
      >
        <Link
          href='/'
          scroll={false}
          className='text-base font-semibold tracking-tight text-fg sm:text-lg'
          onClick={(e) => {
            e.preventDefault();
            closeMenu();
            router.push('/');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <Logo
            priority
            className='h-4 top-2 px-4 sm:h-5 md:h-7 lg:h-6 xl:h-6 2xl:h-6'
          />
        </Link>

        <nav className='hidden items-center gap-4 font-mono-var text-sm md:flex'>
          {navItems.map(({ key, href }) => (
            <Link
              key={key}
              href={href}
              scroll={true}
              aria-current={
                isActive(key)
                  ? key === 'projects'
                    ? 'page'
                    : 'location'
                  : undefined
              }
              className='relative text-fg hover:text-primary transition-colors duration-300'
            >
              {t(`nav.${key}`)}

              {isActive(key) && (
                <span
                  aria-hidden='true'
                  className='active-underline [--underline-offset:-10%]'
                />
              )}
            </Link>
          ))}

          <ThemeToggle />
          <LanguageToggle />
        </nav>
      </div>

      <button
        type='button'
        aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className='absolute top-4 right-4 z-[80] pointer-events-auto surface-card flex h-10 w-10 items-center justify-center rounded-lg bg-surface/60 text-fg backdrop-blur-md transition-colors hover:text-primary md:hidden'
      >
        {isOpen ? <X className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
      </button>

      <div
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-200 md:hidden ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none invisible'}`}
        onClick={closeMenu}
        aria-hidden={!isOpen}
      />

      <div
        className={`fixed top-0 right-0 z-[70] flex h-screen w-3/4 max-w-sm flex-col border-l border-border bg-[var(--panel-bg)] px-4 py-4 glass-effect transition-transform duration-200 md:hidden ${
          isOpen
            ? 'translate-x-0 pointer-events-auto'
            : 'translate-x-full pointer-events-none'
        }`}
        aria-hidden={!isOpen}
      >
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-4'>
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>

        <nav className='mt-6 flex flex-col items-start gap-10 font-mono-var text-3xl tracking-wide md:hidden'>
          {mobileNavItems.map(({ key, href }) => (
            <Link
              key={key}
              href={href}
              scroll={true}
              aria-current={
                isActive(key)
                  ? key === 'projects' || key === 'home'
                    ? 'page'
                    : 'location'
                  : undefined
              }
              className='inline-flex min-h-12 items-center text-fg transition-colors duration-300 hover:text-primary'
              onClick={closeMenu}
            >
              <span className='relative'>
                {t(`nav.${key}`)}

                {isActive(key) && (
                  <span
                    aria-hidden='true'
                    className='active-underline [--underline-offset:-10%]'
                  />
                )}
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
