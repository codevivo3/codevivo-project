import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, Calendar, Github, Linkedin, Dribbble } from 'lucide-react';
import LanguageToggle from '@/components/LanguageToggle';

export default function Footer() {
  const t = useTranslations('footer');
  const locale = useLocale();

  return (
    <footer className='relative text-fg backdrop-blur-md'>
      {/* Footer accent lines */}

      <div className='mx-auto relative grid w-full max-w-5xl grid-cols-1 md:grid-cols-3 items-center gap-6 px-4 py-6 text-center text-xs text-fg/70 sm:px-6 md:text-left'>
        {/* Vertical dividers */}
        <div className='pointer-events-none hidden md:block absolute left-1/3 top-1/2 h-16 w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-[var(--brand-blue)] to-[var(--brand-gold)] opacity-70' />
        <div className='pointer-events-none hidden md:block absolute left-2/3 top-1/2 h-16 w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-[var(--brand-blue)] to-[var(--brand-gold)] opacity-70' />
        <div className='flex h-full flex-col justify-between items-center md:items-start'>
          <Link
            href={`/${locale}#hero`}
            className='text-base font-semibold tracking-tight text-fg sm:text-lg'
          >
            <div className='relative h-auto w-24 sm:w-32 md:w-36 lg:w-40'>
              <Image
                src='/logos/codevivo/codevivo-col-logo-white-text.svg'
                alt='Codevivo logo'
                width={160}
                height={40}
                className='logo-white transition-transform duration-500 ease-out hover:scale-105'
                priority
              />
              <Image
                src='/logos/codevivo/codevivo-col-logo-black-text.svg'
                alt='Codevivo logo'
                width={160}
                height={40}
                className='logo-black transition-transform duration-500 ease-out hover:scale-105'
                priority
              />
            </div>
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
          <Link
            href='mailto:hello@codevivo.dev'
            className='group flex items-center gap-3 text-fg/60 hover:text-primary transition-colors'
          >
            <Mail className='h-4 w-4 opacity-70 transition-transform duration-200 group-hover:scale-110' />
            <span className='font-mono-var text-xs sm:text-sm'>Email me</span>
          </Link>

          <Link
            href='https://calendly.com/'
            target='_blank'
            className='group flex items-center gap-3 text-fg/60 hover:text-primary transition-colors'
          >
            <Calendar className='h-4 w-4 opacity-70 transition-transform duration-200 group-hover:scale-110' />
            <span className='font-mono-var text-xs sm:text-sm'>
              Schedule a call
            </span>
          </Link>

          <Link
            href='https://github.com/codevivo3'
            target='_blank'
            className='group flex items-center gap-3 text-fg/60 hover:text-primary transition-colors'
          >
            <Github className='h-4 w-4 opacity-70 transition-transform duration-200 group-hover:scale-110' />
            <span className='font-mono-var text-xs sm:text-sm'>
              View my GitHub
            </span>
          </Link>

          <Link
            href='https://linkedin.com'
            target='_blank'
            className='group flex items-center gap-3 text-fg/60 hover:text-primary transition-colors'
          >
            <Linkedin className='h-4 w-4 opacity-70 transition-transform duration-200 group-hover:scale-110' />
            <span className='font-mono-var text-xs sm:text-sm'>
              Connect on LinkedIn
            </span>
          </Link>

          <Link
            href='https://dribbble.com/francescodvf'
            target='_blank'
            className='group flex items-center gap-3 text-fg/60 hover:text-primary transition-colors'
          >
            <Dribbble className='h-4 w-4 opacity-70 transition-transform duration-200 group-hover:scale-110' />
            <span className='font-mono-var text-xs sm:text-sm'>
              See my designs
            </span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
