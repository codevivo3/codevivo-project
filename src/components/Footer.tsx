'use client';

<<<<<<< Updated upstream
=======
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Mail, Calendar, Github, Linkedin } from 'lucide-react';
import LanguageToggle from '@/components/LanguageToggle';
import Logo from './ui/Logo';

>>>>>>> Stashed changes
/**
 * Footer
 *
 * Purpose:
 * Renders the shared site footer with localized navigation, brand links, and contact shortcuts.
 *
 * Context:
<<<<<<< Updated upstream
 * Mounted by `ClientShell` on all localized pages.
 *
 * Dependencies:
 * - next-intl for localized navigation labels
 * - `LanguageToggle` and shared brand components
 * - shared `surface-card` styling and footer layout tokens
 *
 * Notes:
 * - External CTA labels are intentionally static for now; navigation labels remain localized.
 * - Keep the smooth-scroll hero shortcut aligned with the homepage section IDs.
=======
 * Shared by the client shell so the same footer appears across localized routes.
 *
 * Notes:
 * External click analytics are handled locally so the shared footer stays presentational.
>>>>>>> Stashed changes
 */
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Mail, Calendar, Github, Linkedin } from 'lucide-react';
import LanguageToggle from '@/components/LanguageToggle';
import Logo from './ui/Logo';

export default function Footer() {
  // Retrieve localized strings from next-intl messages (DO NOT hardcode text).
  const t = useTranslations('footer');
  const locale = useLocale();

  const handleCalendlyClick = () => {
    const gtag = (
      window as Window & {
        gtag?: (
          command: 'event',
          eventName: string,
          params: {
            event_category: string;
            event_label: string;
          }
        ) => void;
      }
    ).gtag;

    gtag?.('event', 'book_call_click', {
      event_category: 'engagement',
      event_label: 'Calendly CTA',
    });
  };

  return (
    <footer className='relative text-fg backdrop-blur-md'>
      {/* Footer accent lines */}

<<<<<<< Updated upstream
      <div className='mx-auto relative grid w-full max-w-5xl grid-cols-1 items-start gap-6 px-4 py-6 text-center text-xs text-fg/70 sm:px-6 md:grid-cols-3 md:text-left'>
=======
      <div className='mx-auto relative grid w-full max-w-5xl grid-cols-1 md:grid-cols-3 items-start gap-6 px-4 py-6 text-center text-xs text-fg/70 sm:px-6 md:text-left'>
>>>>>>> Stashed changes
        {/* Vertical dividers */}
        <div className='pointer-events-none hidden md:block absolute left-1/3 top-1/2 h-16 w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-[var(--brand-blue)] to-[var(--brand-gold)] opacity-70' />
        <div className='pointer-events-none hidden md:block absolute left-2/3 top-1/2 h-16 w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-[var(--brand-blue)] to-[var(--brand-gold)] opacity-70' />
        <div className='order-1 flex h-full flex-col items-center md:items-start'>
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
            <Logo className='opacity-80 hover:opacity-100' />
          </Link>
        </div>
        <nav className='order-2 flex flex-col items-center justify-center gap-4 text-xs sm:text-sm'>
          <Link
            href={`/${locale}#projects`}
            className='inline-flex min-h-10 items-center text-fg/70 hover:text-primary font-mono-var'
          >
            {t('nav.projects')}
          </Link>
          <Link
            href={`/${locale}#tools`}
            className='inline-flex min-h-10 items-center text-fg/70 hover:text-primary font-mono-var'
          >
            {t('nav.tools')}
          </Link>
          <Link
            href={`/${locale}#about`}
            className='inline-flex min-h-10 items-center text-fg/70 hover:text-primary font-mono-var'
          >
            {t('nav.about')}
          </Link>
          <Link
            href={`/${locale}#contact`}
            className='inline-flex min-h-10 items-center text-fg/70 hover:text-primary font-mono-var'
          >
            {t('nav.contact')}
          </Link>

          <div className='hidden pt-1 md:block'>
            <LanguageToggle />
          </div>
        </nav>
        <div className='order-4 flex flex-col items-center gap-5 md:items-end'>
          <a
            href='mailto:hello@codevivo.dev'
            className='group flex min-h-10 items-center gap-3 text-fg/60 transition-colors hover:text-primary'
          >
            <Mail className='h-4 w-4 opacity-70 transition-transform duration-200 group-hover:scale-110' />
            <span className='font-mono-var text-xs sm:text-sm'>Email me</span>
          </a>

          <a
            href='https://calendly.com/codevivo/intro-call'
            target='_blank'
            rel="noopener noreferrer"
            onClick={handleCalendlyClick}
            className='group flex min-h-10 items-center gap-3 text-fg/60 transition-colors hover:text-primary'
          >
            <Calendar className='h-4 w-4 opacity-70 transition-transform duration-200 group-hover:scale-110' />
            <span className='font-mono-var text-xs sm:text-sm'>
              Schedule a call
            </span>
          </a>

          <a
            href='https://github.com/codevivo3'
            target='_blank'
            rel="noopener noreferrer"
            className='group flex min-h-10 items-center gap-3 text-fg/60 transition-colors hover:text-primary'
          >
            <Github className='h-4 w-4 opacity-70 transition-transform duration-200 group-hover:scale-110' />
            <span className='font-mono-var text-xs sm:text-sm'>
              View my GitHub
            </span>
          </a>

          <a
            href='https://linkedin.com'
            target='_blank'
            rel="noopener noreferrer"
            className='group flex min-h-10 items-center gap-3 text-fg/60 transition-colors hover:text-primary'
          >
            <Linkedin className='h-4 w-4 opacity-70 transition-transform duration-200 group-hover:scale-110' />
            <span className='font-mono-var text-xs sm:text-sm'>
              Connect on LinkedIn
            </span>
          </a>
<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes
        </div>
        <div className='order-3 flex justify-center md:hidden'>
          <LanguageToggle />
        </div>
        <span className='order-5 mt-8 text-center text-fg/50 text-xs md:hidden'>
          {t('copyright')}
        </span>
        <span className='hidden text-fg/50 text-xs md:block'>{t('copyright')}</span>
      </div>
    </footer>
  );
}
