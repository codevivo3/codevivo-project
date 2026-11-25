'use client';

/**
 * LanguageToggle
 *
 * Purpose:
 * Switches between supported locales while preserving the current route.
 *
 * Context:
 * Used in shared navigation controls such as the header and footer.
 *
 * Dependencies:
 * - next-intl locale state
 * - Next.js client routing hooks
 * - Shared active-underline utility
 *
 * Notes:
 * - Keep supported locale options aligned with src/i18n/routing.ts.
 * - Use explicit inter-character spacing for symmetrical alignment.
 */
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

export default function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (nextLocale: 'en' | 'it') => {
    if (nextLocale === locale) return;

    router.replace(pathname, { locale: nextLocale });
  };

  const baseButton =
    'relative flex h-full cursor-pointer items-center justify-center px-1.5 text-[11px] font-mono-var uppercase tracking-normal transition-colors duration-200 hover:text-fg/80';

  const activeUnderline =
    'active-underline [--underline-width:100%] [--underline-offset:-10%]';

  return (
    <div className='surface-card inline-flex h-10 md:h-8 items-center gap-2 rounded-lg bg-surface/60 px-2 text-xs font-mono-var backdrop-blur-md'>
      <button
        type='button'
        aria-label='English'
        aria-pressed={locale === 'en'}
        className={`${baseButton} ${locale === 'en' ? 'text-fg' : 'text-fg/40'}`}
        onClick={() => switchLocale('en')}
      >
        <span className='relative inline-flex items-center gap-[0.2em]'>
          <span>E</span>
          <span>N</span>
          {locale === 'en' && (
            <span aria-hidden='true' className={activeUnderline} />
          )}
        </span>
      </button>

      <span className='text-fg/30'>|</span>

      <button
        type='button'
        aria-label='Italiano'
        aria-pressed={locale === 'it'}
        className={`${baseButton} ${locale === 'it' ? 'text-fg' : 'text-fg/40'}`}
        onClick={() => switchLocale('it')}
      >
        <span className='relative inline-flex items-center gap-[0.2em]'>
          <span>I</span>
          <span>T</span>
          {locale === 'it' && (
            <span aria-hidden='true' className={activeUnderline} />
          )}
        </span>
      </button>
    </div>
  );
}
