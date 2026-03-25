'use client';

/**
 * SelectedSection
 *
 * Purpose:
 * Renders the larger selected-work cards on the projects archive page.
 *
 * Context:
 * Used only on the projects page as the main long-form showcase.
 *
 * Dependencies:
 * - next-intl locale state for preview selection
 * - centralized asset resolution via `getProjectAssets`
 * - shared `surface-card` system and `Button`
 *
 * Notes:
 * - Theme-aware image selection depends on the document root class.
 * - Keep preview resolution inside the shared helper path rather than hardcoding image files here.
 */
import { useEffect, useState } from 'react';
import { type PreviewType } from '@/components/projects/ProjectThumbnail';
import Button from '@/components/ui/Button';
import { getProjectAssets } from '@/lib/getProjectAssets';
import { useLocale } from 'next-intl';
import Image from 'next/image';

type SelectedProject = {
  id: string;
  slug: string;
  title: string;
  description: string;
  projectUrl?: string;
  previewType?: PreviewType;
};

type Props = {
  projects: SelectedProject[];
  title: string;
  viewLabel: string;
};

export default function SelectedSection({
  projects,
  title,
  viewLabel,
}: Props) {
  // State
  const locale = useLocale();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Normalize locale for image selection.
  const normalizedLocale: 'it' | 'en' = locale.startsWith('it') ? 'it' : 'en';

  // Effects
  useEffect(() => {
    const updateTheme = () => {
      setTheme(
        document.documentElement.classList.contains('light')
          ? 'light'
          : 'dark'
      );
    };

    updateTheme();

    // Detect current theme from document root so preview variants stay aligned with the UI theme.
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // Render
  return (
    <div className='space-y-6'>
      <h2 className='mx-auto w-full max-w-4xl text-lg font-semibold'>
        {title}
      </h2>
      <div className='space-y-12 md:space-y-20'>
        {projects.map((project) => {
          // Resolve preview assets using the centralized helper (single source of truth).
          const {
            previewImage,
            fullPreview,
          } = getProjectAssets({
            slug: project.slug,
            theme,
            locale: normalizedLocale,
          });

          return (
            <div
              key={project.id}
              className='glass-effect surface-card mx-auto flex w-full max-w-4xl max-w-full flex-col justify-center rounded-xl bg-[var(--panel-bg)] p-4 min-h-[50vh] md:min-h-[65vh]'
            >
              <div className='mx-auto flex w-full max-w-3xl max-w-full flex-col justify-center gap-5 text-center'>
                <h3 className='order-1 text-xl font-semibold sm:text-2xl md:order-none'>
                  {project.title}
                </h3>

                <div className='order-3 flex w-full max-w-full items-center justify-center overflow-hidden rounded-lg md:order-none'>
                  <div className='flex w-full max-w-full items-center justify-center'>
                    <div className='relative aspect-[16/9] w-full max-w-[85%] rounded-lg overflow-hidden md:max-w-[600px]'>
                      <Image
                        src={previewImage ?? fullPreview ?? '/fallback.png'}
                        alt={project.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 800px"
                        className='object-contain'
                        priority={false}
                      />
                    </div>
                  </div>
                </div>

                <p className='order-2 text-sm leading-relaxed text-fg/72 md:order-none'>
                  {project.description}
                </p>

                <div className='order-4 flex w-full flex-col gap-3 pt-2 md:order-none'>
                  {project.projectUrl ? (
                    <Button href={project.projectUrl} variant='primary'>
                      {viewLabel}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
