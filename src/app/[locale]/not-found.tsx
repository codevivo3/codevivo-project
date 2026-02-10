'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function NotFound() {
  const t = useTranslations('not-found');
  return (
    <main className='min-h-screen flex flex-col items-center justify-center px-4 py-16 text-center'>
      <h1 className='text-5xl font-bold mb-4 text-red-500'>
        {t('title')}
      </h1>
      <p className='text-base md:text-lg text-gray-500 mb-6'>
        {t('description')}
      </p>
      <Link
        href='/'
        className='text-sm font-medium border border-gray-300 px-4 py-2 rounded hover:bg-gray-100 transition'
      >
        {t('homeLink')}
      </Link>
    </main>
  );
}
