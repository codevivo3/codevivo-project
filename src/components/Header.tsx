import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';

export default function Header() {
  const t = useTranslations('header');

  return (
    <header className='bg-bg text-fg'>
      <div className='mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 font-mono '>
        <Link
          href='/'
          className='text-base font-semibold tracking-tight text-fg sm:text-lg'
        >
          <Image
            src='/logos/codevivo-logo-text-white.svg'
            alt='Codevivo logo'
            width={160}
            height={40}
            className='h-auto w-28 sm:w-36 md:w-40 lg:w-44'
            priority
          />
        </Link>
        <nav className='flex flex-wrap items-center justify-center gap-4 text-xs sm:justify-end sm:text-sm'>
          <a
            href='#about'
            className='text-fg hover:text-primary'
          >
            {t('nav.about')}
          </a>
          <a
            href='#projects'
            className='text-fg hover:text-primary'
          >
            {t('nav.projects')}
          </a>
          <a
            href='#tools'
            className='text-fg hover:text-primary'
          >
            {t('nav.tools')}
          </a>
          <a
            href='#contact'
            className='text-fg hover:text-primary'
          >
            {t('nav.contact')}
          </a>
        </nav>
      </div>
    </header>
  );
}
