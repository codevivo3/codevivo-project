import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  const t = useTranslations('footer');
  const locale = useLocale();

  return (
    <footer className='text-fg'>
      <div className='mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-center text-xs text-fg/70 sm:px-6 md:flex-row md:text-left'>
        <span>
          <Link
            href={`/${locale}#hero`}
            className='text-base font-semibold tracking-tight text-fg sm:text-lg'
          >
            <Image
              src='/logos/codevivo-col-logo-white-text.svg'
              alt='Codevivo logo'
              width={160}
              height={40}
              className='h-auto w-28 sm:w-36 md:w-40 lg:w-44'
              priority
            />
          </Link>
        </span>
        <nav className='flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm'>
          <Link
            href={`/${locale}#about`}
            className='text-fg/70 hover:text-primary font-mono-var'
          >
            {t('nav.about')}
          </Link>
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
            href={`/${locale}#contact`}
            className='text-fg/70 hover:text-primary font-mono-var'
          >
            {t('nav.contact')}
          </Link>
        </nav>
        <span>{t('copyright')}</span>
      </div>
    </footer>
  );
}
