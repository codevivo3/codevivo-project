'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

/**
 * LanguageToggle
 *
 * Purpose:
 * Switches the active locale between English and Italian.
 *
 * Behavior:
 * - Large screens: renders as a compact inline control
 * - Medium screens: preserves the same interaction and sizing
 * - Mobile: stays visible on first render with no animation or async visibility dependency
 *
 * Notes:
 * - This component does not manage motion
 * - Route normalization prevents accidental double-locale paths
 */

export default function LanguageToggle() {
  // Derived values
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  // Event handlers
  const switchLocale = (nextLocale: 'en' | 'it') => {
    if (nextLocale === locale) return;
    const normalizedPath = pathname.replace(/^\/(en|it)\/(en|it)/, '/$1');
    const pathWithoutLocale = normalizedPath.replace(/^\/(en|it)/, '');
    const nextPath = `/${nextLocale}${pathWithoutLocale || ''}`;
    router.replace(nextPath);
  };

  // Derived classes
  const baseButton =
    'relative flex h-full flex-col items-center justify-center px-1.5 text-[11px] font-mono-var uppercase tracking-[0.2em] transition-colors duration-200 hover:text-fg/80';

  // Render
  return (
    <div className='surface-card inline-flex h-8 items-center gap-2 rounded-lg bg-surface/60 px-2 text-xs font-mono-var backdrop-blur-md'>
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
