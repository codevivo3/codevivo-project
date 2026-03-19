'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Mail, Calendar, Github, Linkedin, Dribbble } from 'lucide-react';
import LanguageToggle from '@/components/LanguageToggle';
import Logo from './ui/Logo';

/**
 * Footer
 *
 * Purpose:
 * Renders the site footer with brand links, locale switcher, and contact actions.
 *
 * Behavior:
 * - Large screens: uses a three-column footer layout with static links
 * - Medium screens: keeps the same content with responsive alignment changes
 * - Mobile: content stays visible on first render with no hidden animation state
 *
 * Notes:
 * - This component does not manage motion timing
 * - External link analytics are handled locally without affecting layout visibility
 */

export default function Footer() {
  // Derived values
  const t = useTranslations('footer');
  const locale = useLocale();

  // Event handlers
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

  // Render
  return (
    <footer className='relative text-fg backdrop-blur-md'>
      {/* Footer accent lines */}

      <div className='mx-auto relative grid w-full max-w-5xl grid-cols-1 md:grid-cols-3 items-center gap-6 px-4 py-6 text-center text-xs text-fg/70 sm:px-6 md:text-left'>
        {/* Vertical dividers */}
        <div className='pointer-events-none hidden md:block absolute left-1/3 top-1/2 h-16 w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-[var(--brand-blue)] to-[var(--brand-gold)] opacity-70' />
        <div className='pointer-events-none hidden md:block absolute left-2/3 top-1/2 h-16 w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-[var(--brand-blue)] to-[var(--brand-gold)] opacity-70' />
        <div className='flex h-full flex-col justify-between items-center md:items-start'>
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

          <span className='mt-6 text-fg/50 text-xs'>{t('copyright')}</span>
        </div>
        <nav className='flex flex-col items-center justify-center gap-4 text-xs sm:text-sm'>
          <Link
            href={`/${locale}#projects`}
            className='text-fg/70 hover:text-primary font-mono-var'
          >
            {t('nav.projects')}
          </Link>
          <Link
            href={`/${locale}#tools`}
            className='text-fg/70 hover:text-primary font-mono-var'
          >
            {t('nav.tools')}
          </Link>
          <Link
            href={`/${locale}#about`}
            className='text-fg/70 hover:text-primary font-mono-var'
          >
            {t('nav.about')}
          </Link>
          <Link
            href={`/${locale}#contact`}
            className='text-fg/70 hover:text-primary font-mono-var'
          >
            {t('nav.contact')}
          </Link>

          <div className='pt-1'>
            <LanguageToggle />
          </div>
        </nav>
        <div className='flex flex-col items-center md:items-end gap-5'>
          <a
            href='mailto:hello@codevivo.dev'
            className='group flex items-center gap-3 text-fg/60 hover:text-primary transition-colors'
          >
            <Mail className='h-4 w-4 opacity-70 transition-transform duration-200 group-hover:scale-110' />
            <span className='font-mono-var text-xs sm:text-sm'>Email me</span>
          </a>

          <a
            href='https://calendly.com/codevivo/intro-call'
            target='_blank'
            rel="noopener noreferrer"
            onClick={handleCalendlyClick}
            className='group flex items-center gap-3 text-fg/60 hover:text-primary transition-colors'
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
            className='group flex items-center gap-3 text-fg/60 hover:text-primary transition-colors'
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
            className='group flex items-center gap-3 text-fg/60 hover:text-primary transition-colors'
          >
            <Linkedin className='h-4 w-4 opacity-70 transition-transform duration-200 group-hover:scale-110' />
            <span className='font-mono-var text-xs sm:text-sm'>
              Connect on LinkedIn
            </span>
          </a>

          <a
            href='https://dribbble.com/francescodvf'
            target='_blank'
            rel="noopener noreferrer"
            className='group flex items-center gap-3 text-fg/60 hover:text-primary transition-colors'
          >
            <Dribbble className='h-4 w-4 opacity-70 transition-transform duration-200 group-hover:scale-110' />
            <span className='font-mono-var text-xs sm:text-sm'>
              See my designs
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}
