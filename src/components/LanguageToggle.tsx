'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

export default function LanguageToggle() {
  // useLocale reads the active locale from next-intl.
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (nextLocale: 'en' | 'it') => {
    if (nextLocale === locale) return;
    // Normalize accidental double-locale paths like /it/en or /en/it.
    const normalizedPath = pathname.replace(/^\/(en|it)\/(en|it)/, '/$1');
    // Remove the current locale segment, then prefix with the target locale.
    const pathWithoutLocale = normalizedPath.replace(/^\/(en|it)/, '');
    const nextPath = `/${nextLocale}${pathWithoutLocale || ''}`;
    router.replace(nextPath);
  };

  const baseButton =
    'relative flex h-full flex-col items-center justify-center px-1.5 text-[11px] font-mono-var uppercase tracking-[0.2em] transition-colors duration-200 hover:text-fg/80';

  return (
    <div className='surface-card inline-flex h-8 items-center gap-2 rounded-md bg-surface/40 px-2 text-xs font-mono-var'>
      <button
        type='button'
        aria-pressed={locale === 'en'}
        className={`${baseButton} ${locale === 'en' ? 'text-fg' : 'text-fg/40'}`}
        onClick={() => switchLocale('en')}
      >
        EN
        {locale === 'en' && <span className=' h-[1px] w-4 bg-primary' />}
      </button>
      <span className='text-fg/30'>|</span>
      <button
        type='button'
        aria-pressed={locale === 'it'}
        className={`${baseButton} ${locale === 'it' ? 'text-fg' : 'text-fg/40'}`}
        onClick={() => switchLocale('it')}
      >
        IT
        {locale === 'it' && <span className=' h-[1px] w-4 bg-primary' />}
      </button>
    </div>
  );
}
