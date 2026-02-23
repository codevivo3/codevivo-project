import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';

export default function Header() {
  const t = useTranslations('header');
  const locale = useLocale();

  return (
    <header className='sticky top-0 z-50 text-fg bg-[var(--brand-shadow)]'>
      <div className='mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6'>
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
        <nav className='flex flex-wrap items-center justify-center gap-4 text-xs sm:justify-end sm:text-sm font-mono-var'>
          <Link
            href={`/${locale}#about`}
            className='text-fg hover:text-primary'
          >
            {t('nav.about')}
          </Link>
          <Link
            href={`/${locale}#projects`}
            className='text-fg hover:text-primary'
          >
            {t('nav.projects')}
          </Link>
          <Link
            href={`/${locale}#tools`}
            className='text-fg hover:text-primary'
          >
            {t('nav.tools')}
          </Link>
          <Link
            href={`/${locale}#contact`}
            className='text-fg hover:text-primary'
          >
            {t('nav.contact')}
          </Link>
        </nav>
      </div>
    </header>
  );
}
