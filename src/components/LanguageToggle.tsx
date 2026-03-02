'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

export default function LanguageToggle() {
  // useLocale reads the active locale from next-intl.
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (nextLocale: 'en' | 'it') => {
    if (nextLocale === locale) return;
    // Rebuild the path by replacing the first segment with the new locale.
    const segments = pathname.split('/');
    if (segments.length > 1) {
      segments[1] = nextLocale;
    } else {
      segments.push(nextLocale);
    }
    const nextPath = segments.join('/') || `/${nextLocale}`;
    router.push(nextPath);
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs font-mono-var">
      <button
        type="button"
        className={locale === 'en' ? 'text-primary' : 'text-fg/70'}
        onClick={() => switchLocale('en')}
      >
        EN
      </button>
      <span className="text-fg/50">|</span>
      <button
        type="button"
        className={locale === 'it' ? 'text-primary' : 'text-fg/70'}
        onClick={() => switchLocale('it')}
      >
        IT
      </button>
    </div>
  );
}
