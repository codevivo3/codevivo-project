'use client';

/**
 * Footer
 *
 * Purpose:
 * Renders the shared site footer with localized navigation, brand links, and contact shortcuts.
 *
 * Context:
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

      <div className='mx-auto relative grid w-full max-w-5xl grid-cols-1 items-start gap-6 px-4 py-6 text-center text-xs text-fg/70 sm:px-6 md:grid-cols-3 md:text-left'>
        {/* Vertical dividers */}
        <div className='pointer-events-none hidden md:block absolute left-1/3 top-1/2 h-16 w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-[var(--brand-blue)] to-[var(--brand-gold)] opacity-70' />
        <div className='pointer-events-none hidden md:block absolute left-2/3 top-1/2 h-16 w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-[var(--brand-blue)] to-[var(--brand-gold)] opacity-70' />

        <div className='order-1 flex flex-col items-center gap-4 md:items-start md:justify-between h-full py-2 md:py-3'>
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
            <Logo className='opacity-80 hover:opacity-100 md:h-[22px] lg:h-[24px] 2xl:h-[24px] w-auto' />
          </Link>
          <div className='pt-1 hidden md:block'>
            <LanguageToggle />
          </div>
        </div>

        <div className='order-2 flex flex-col items-center gap-4 text-xs sm:text-sm'>
          <nav className='flex flex-col items-center gap-4'>
            <Link
              href={`/${locale}#projects`}
              className='inline-flex min-h-10 items-center font-mono-var text-base sm:text-sm text-fg/70 hover:text-primary'
            >
              {t('nav.projects')}
            </Link>
            <Link
              href={`/${locale}#tools`}
              className='inline-flex min-h-10 items-center font-mono-var text-base sm:text-sm text-fg/70 hover:text-primary'
            >
              {t('nav.tools')}
            </Link>
            <Link
              href={`/${locale}#about`}
              className='inline-flex min-h-10 items-center font-mono-var text-base sm:text-sm text-fg/70 hover:text-primary'
            >
              {t('nav.about')}
            </Link>
            <Link
              href={`/${locale}#contact`}
              className='inline-flex min-h-10 items-center font-mono-var text-base sm:text-sm text-fg/70 hover:text-primary'
            >
              {t('nav.contact')}
            </Link>
          </nav>
          <div className='pt-2 md:hidden'>
            <LanguageToggle />
          </div>
        </div>

        <div className='order-3 flex flex-col items-center md:items-end gap-4'>
          <a
            href='mailto:hello@codevivo.dev'
            className='group flex min-h-10 items-center gap-3 text-fg/60 transition-colors hover:text-primary'
          >
            <Mail className='h-4 w-4 opacity-70 transition-transform duration-200 group-hover:scale-110' />
            <span className='font-mono-var text-base sm:text-sm'>Email me</span>
          </a>

          <a
            href='https://calendly.com/codevivo/intro-call'
            target='_blank'
            rel='noopener noreferrer'
            onClick={handleCalendlyClick}
            className='group flex min-h-10 items-center gap-3 text-fg/60 transition-colors hover:text-primary'
          >
            <Calendar className='h-4 w-4 opacity-70 transition-transform duration-200 group-hover:scale-110' />
            <span className='font-mono-var text-base sm:text-sm'>
              Schedule a call
            </span>
          </a>

          <a
            href='https://github.com/codevivo3'
            target='_blank'
            rel='noopener noreferrer'
            className='group flex min-h-10 items-center gap-3 text-fg/60 transition-colors hover:text-primary'
          >
            <Github className='h-4 w-4 opacity-70 transition-transform duration-200 group-hover:scale-110' />
            <span className='font-mono-var text-base sm:text-sm'>
              View my GitHub
            </span>
          </a>

          <a
            href='https://linkedin.com'
            target='_blank'
            rel='noopener noreferrer'
            className='group flex min-h-10 items-center gap-3 text-fg/60 transition-colors hover:text-primary'
          >
            <Linkedin className='h-4 w-4 opacity-70 transition-transform duration-200 group-hover:scale-110' />
            <span className='font-mono-var text-base sm:text-sm'>
              Connect on LinkedIn
            </span>
          </a>
        </div>
      </div>

      <div className='mt-6 pb-8 md:pb-6 text-center text-xs text-fg/50'>
        {t('copyright')}
      </div>
    </footer>
  );
}
