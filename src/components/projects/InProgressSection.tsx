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
import { Link } from '@/i18n/navigation';
import { getProjectAssets } from '@/lib/getProjectAssets';
import { ArrowRightIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { useState } from 'react';

type InProgressItem = {
  id: string;
  title: string;
  description: string;
  slug?: string;
  link?: string;
  milestoneLabel?: string;
  currentStage?: string;
  currentStageLabel?: string;
  stageLabels?: string[];
  stages?: string[];
  journalSlug?: string;
  latestEntrySlug?: string;
};

type Props = {
  items: InProgressItem[];
  title: string;
};

function CompactProjectPreview({
  title,
  compactPreviewImage,
  previewImage,
}: {
  title: string;
  compactPreviewImage?: string;
  previewImage?: string;
}) {
  const imageCandidates = [
    compactPreviewImage,
    previewImage,
    '/fallback.png',
  ].filter((src, index, sources): src is string => {
    return Boolean(src) && sources.indexOf(src) === index;
  });
  const [imageIndex, setImageIndex] = useState(0);

  const imageSrc = imageCandidates[imageIndex] ?? '/fallback.png';

  return (
    <div className='relative h-20 w-20 flex-shrink-0 self-center overflow-hidden rounded-md sm:self-auto'>
      <Image
        src={imageSrc}
        alt={title}
        fill
        sizes='80px'
        className='object-cover'
        priority={false}
        onError={() => {
          setImageIndex((currentIndex) =>
            currentIndex < imageCandidates.length - 1
              ? currentIndex + 1
              : currentIndex,
          );
        }}
      />
    </div>
  );
}

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
          const compactPreviewAssets = item.slug
            ? getProjectAssets({
                slug: item.slug,
                theme,
                locale: normalizedLocale,
              })
            : null;
          const journalHref = item.journalSlug
            ? item.latestEntrySlug
              ? `/projects/${item.journalSlug}/${item.latestEntrySlug}`
              : `/projects/${item.journalSlug}`
            : null;
          const ctaLabel = item.link
            ? t('inProgressLink')
            : journalHref
              ? item.latestEntrySlug
                ? t('inProgressLatestEntryLink')
                : t('inProgressJournalLink')
              : t('inProgressLink');
          const currentStageIndex =
            item.currentStage && item.stages?.length
              ? item.stages.indexOf(item.currentStage)
              : -1;
          const hasStageProgress =
            currentStageIndex >= 0 &&
            !!item.currentStageLabel &&
            item.stages?.length === item.stageLabels?.length;

          return (
            <div
              key={item.id}
              className='glass-effect surface-card flex min-h-[19rem] w-full max-w-full flex-col rounded-xl bg-[var(--panel-bg)] p-3.5 cursor-default transition-colors duration-200 hover:border-primary/40'
            >
              <div className='flex h-full flex-col gap-4 p-2'>
                  {item.milestoneLabel ? (
                    <div className='flex flex-wrap justify-center text-[11px] font-mono uppercase tracking-wide sm:justify-start'>
                      <span className='rounded-full border border-primary/20 bg-primary/10 px-4 py-0.5 text-primary/80'>
                        {item.milestoneLabel}
                      </span>
                    </div>
                  ) : null}
                <div className='flex min-h-[9rem] flex-col gap-4 sm:flex-row sm:items-center'>
                  {compactPreviewAssets ? (
                    <CompactProjectPreview
                      key={`${compactPreviewAssets.iconPreviewImage ?? ''}-${compactPreviewAssets.previewImage ?? ''}`}
                      title={item.title}
                      compactPreviewImage={compactPreviewAssets.iconPreviewImage}
                      previewImage={compactPreviewAssets.previewImage}
                    />
                  ) : null}

                  <div className='flex w-full max-w-full flex-col justify-center gap-1 text-center sm:text-left'>
                    <h3 className='text-base font-semibold'>{item.title}</h3>
                    <p className='text-sm text-fg/72'>
                      {item.description}
                    </p>
                  </div>
                </div>


                {hasStageProgress ? (
                  <div className='min-h-[4.75rem] space-y-2'>
                    <div className='space-y-1'>
                      <p className='text-[11px] font-mono uppercase tracking-wide text-fg/50'>
                        {t('inProgressCurrentStage')}
                      </p>
                      <div
                        className='flex items-center gap-1.5'
                        aria-hidden='true'
                      >
                        {item.stages?.map((stage, index) => {
                          const isActive = index <= currentStageIndex;

                          return (
                            <span
                              key={stage}
                              className={`h-1.5 min-w-0 flex-1 rounded-full transition-colors duration-200 ${
                                isActive ? 'bg-primary' : 'bg-fg/12'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <p className='text-sm text-fg/80'>{item.currentStageLabel}</p>
                  </div>
                ) : null}

                <div className='mt-auto flex w-full justify-center sm:justify-end'>
                  {item.link ? (
                    <a
                      href={item.link}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='group inline-flex min-h-10 items-center gap-1 text-sm text-primary transition-all hover:font-semibold cursor-pointer'
                    >
                      <span className='inline-flex items-center gap-1'>
                        {ctaLabel}
                        <ArrowRightIcon
                          size={16}
                          className='transition-transform group-hover:translate-x-0.5'
                        />
                      </span>
                    </a>
                  ) : journalHref ? (
                    <Link
                      href={journalHref}
                      className='group inline-flex min-h-10 items-center gap-1 text-sm text-primary transition-all hover:font-semibold cursor-pointer'
                    >
                      <span className='inline-flex items-center gap-1'>
                        {ctaLabel}
                        <ArrowRightIcon
                          size={16}
                          className='transition-transform group-hover:translate-x-0.5'
                        />
                      </span>
                    </Link>
                  ) : (
                    <span className='inline-flex min-h-10 items-center text-sm text-fg/40'>
                      <span className='inline-flex items-center gap-1'>
                        {ctaLabel}
                        <ArrowRightIcon size={16} />
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
