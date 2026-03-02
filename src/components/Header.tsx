'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import LanguageToggle from './LanguageToggle';
import ThemeToggle from './ThemeToggle';

export default function Header() {
  const t = useTranslations('header');
  const locale = useLocale();
  const [isLight, setIsLight] = useState(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('light');
  });

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsLight(root.classList.contains('light'));
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <header className='sticky top-0 z-50 text-fg relative bg-[linear-gradient(to_bottom,var(--brand-shadow)_0%,var(--brand-shadow)_57%,transparent_100%)]'>
      <div className='mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6'>
        <Link
          href={`/${locale}#hero`}
          className='text-base font-semibold tracking-tight text-fg sm:text-lg'
        >
          <Image
            src={
              isLight
                ? '/logos/codevivo-col-logo-black-text.svg'
                : '/logos/codevivo-col-logo-white-text.svg'
            }
            alt='Codevivo logo'
            width={160}
            height={40}
            className='h-auto w-24 sm:w-32 md:w-36 lg:w-40 transition-transform duration-500 ease-out hover:scale-105'
            priority
          />
        </Link>
        <nav className='flex items-center gap-4 font-mono-var text-sm'>
          <Link
            href={`/${locale}#about`}
            className='text-fg hover:text-primary transition-colors duration-300'
          >
            {t('nav.about')}
          </Link>
          <Link
            href={`/${locale}#projects`}
            className='text-fg hover:text-primary transition-colors duration-300'
          >
            {t('nav.projects')}
          </Link>
          <Link
            href={`/${locale}#tools`}
            className='text-fg hover:text-primary transition-colors duration-300'
          >
            {t('nav.tools')}
          </Link>
          <Link
            href={`/${locale}#contact`}
            className='text-fg hover:text-primary transition-colors duration-300'
          >
            {t('nav.contact')}
          </Link>
          <LanguageToggle />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
