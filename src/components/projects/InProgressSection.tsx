'use client';

/**
 * InProgressSection
 *
 * Purpose:
 * Renders the compact in-progress project cards used on the projects archive page.
 *
 * Context:
 * Used only on the projects page below selected work and lab experiments.
 *
 * Dependencies:
 * - next-intl for localized status/link labels
 * - centralized preview resolution via `getProjectAssets`
 * - shared `surface-card` styling tokens
 *
 * Notes:
 * - Preview selection must continue to flow through the existing helper system.
 * - Keep this compact card pattern isolated here; do not couple it to `SelectedSection`.
 */
import { useTheme } from '@/hooks/useTheme';
import { getProjectAssets } from '@/lib/getProjectAssets';
import { ArrowRightIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';

type InProgressItem = {
  id: string;
  title: string;
  description: string;
  slug?: string;
  link?: string;
};

type Props = {
  items: InProgressItem[];
  title: string;
};

export default function InProgressSection({ items, title }: Props) {
  // Retrieve localized strings from next-intl messages (DO NOT hardcode text).
  const t = useTranslations('projectsPage');
  const locale = useLocale();
  const { theme } = useTheme();

  // Normalize locale for image selection.
  const normalizedLocale: 'it' | 'en' = locale.startsWith('it') ? 'it' : 'en';

  return (
    <div className='space-y-6'>
      <h2 className='mx-auto w-full max-w-4xl text-lg font-semibold'>
        {title}
      </h2>
      <div className='mx-auto grid w-full max-w-4xl max-w-full grid-cols-1 gap-6 md:grid-cols-2'>
        {items.map((item) => {
          // Resolve preview image using the centralized helper (single source of truth).
          const previewImage = item.slug
            ? (getProjectAssets({
                slug: item.slug,
                theme,
                locale: normalizedLocale,
              }).previewImage ?? '/fallback.png')
            : null;

          return (
            <div
              key={item.id}
              className='glass-effect surface-card w-full max-w-full rounded-xl bg-[var(--panel-bg)] p-3.5 cursor-default transition-colors duration-200 hover:border-primary/40'
            >
              <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
                <div className='relative h-20 w-20 flex-shrink-0 self-center overflow-hidden rounded-md sm:self-auto'>
                  {item.slug ? (
                    <Image
                      src={previewImage ?? '/fallback.png'}
                      alt={item.title}
                      fill
                      sizes='80px'
                      className='object-cover'
                      priority={false}
                    />
                  ) : null}
                </div>

                <div className='flex w-full max-w-full flex-col justify-center gap-1 text-center sm:text-left'>
                  <span className='text-[11px] font-mono uppercase tracking-wide text-fg/50'>
                    {t('inProgressStatus')}
                  </span>
                  <h3 className='text-base font-semibold'>{item.title}</h3>
                  <p className='text-sm text-fg/72 line-clamp-2'>
                    {item.description}
                  </p>
                  <div className='mt-1 flex w-full justify-center sm:justify-end'>
                    {item.link ? (
                      <a
                        href={item.link}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='group inline-flex min-h-10 items-center gap-1 text-sm text-primary transition-all hover:font-semibold cursor-pointer'
                      >
                        <span className='inline-flex items-center gap-1'>
                          {t('inProgressLink')}
                          <ArrowRightIcon
                            size={16}
                            className='transition-transform group-hover:translate-x-0.5'
                          />
                        </span>
                      </a>
                    ) : (
                      <span className='inline-flex min-h-10 items-center text-sm text-fg/40'>
                        <span className='inline-flex items-center gap-1'>
                          {t('inProgressLink')}
                          <ArrowRightIcon size={16} />
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
