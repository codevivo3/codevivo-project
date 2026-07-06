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
 * - `preview.png` is the canonical hero preview asset for web projects.
 * - Hero preview assets must be exported in a true 16:9 aspect ratio.
 * - The preview container intentionally matches the asset ratio; avoid compensating with custom image dimensions.
 */
import Button from '@/components/ui/Button';
import TechIcon from '@/components/ui/TechIcon';
import { useTheme } from '@/hooks/useTheme';
import { getProjectAssets } from '@/lib/getProjectAssets';
import { type Project } from '@/lib/getProjects';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';

type Props = {
  projects: Project[];
  title: string;
};

export default function SelectedSection({ projects, title }: Props) {
  // State
  const t = useTranslations('projects');
  const locale = useLocale();
  const { theme } = useTheme();

  // Normalize locale for image selection.
  const normalizedLocale: 'it' | 'en' = locale.startsWith('it') ? 'it' : 'en';

  const getPreviewGapClassName = (count: number) => {
    if (count <= 1) return 'gap-0';
    if (count === 2) return 'gap-12';
    if (count === 3) return 'gap-10';
    return 'gap-6';
  };

  const getPreviewHeightClassName = (count: number, isDesktop: boolean) => {
    if (isDesktop) {
      if (count <= 1)
        return 'h-[300px] min-[1100px]:h-[320px] min-[1400px]:h-[340px]';
      if (count === 2)
        return 'h-[280px] min-[1100px]:h-[300px] min-[1400px]:h-[320px]';
      if (count === 3)
        return 'h-[260px] min-[1100px]:h-[280px] min-[1400px]:h-[300px]';
      return 'h-[240px] min-[1100px]:h-[260px] min-[1400px]:h-[280px]';
    }

    if (count <= 1) return 'h-[200px]';
    if (count === 2) return 'h-[180px]';
    return 'h-[160px]';
  };

  // Render
  return (
    <div className='space-y-6'>
      <h2 className='mx-auto w-full max-w-4xl text-lg font-semibold'>
        {title}
      </h2>
      <div className='space-y-12 md:space-y-20'>
        {projects.map((project) => {
          // Resolve preview assets using the centralized helper (single source of truth).
          const { previewImage, previewImages, fullPreview } = getProjectAssets(
            {
              slug: project.slug,
              theme,
              locale: normalizedLocale,
              hasFullPreview: project.hasFullPreview,
            },
          );

          const previewKind =
            project.previewType === 'mobile' ? 'mobile' : 'web';
          const desktopPreviewImages = previewImages.slice(0, 5);
          const mobilePreviewImages = previewImages.slice(0, 3);

          return (
            <div
              key={project.id}
              className='glass-effect surface-card mx-auto flex w-full max-w-4xl max-w-full flex-col justify-center rounded-xl bg-[var(--panel-bg)] py-3 px-4 min-h-[45vh] md:min-h-[50vh] lg:min-h-[45vh]'
            >
              <div className='mx-auto flex w-full max-w-3xl max-w-full flex-col justify-center gap-2 text-center'>
                <div className='flex flex-col items-center'>
                  <h3 className='text-xl font-semibold sm:text-2xl'>
                    {project.title}
                  </h3>
                  <span className='mt-2 h-px w-10 bg-primary/70'></span>
                  <p className='mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-fg/72'>
                    {project.description} {t('status.inDevelopment')}.
                  </p>

                  {project.techStack && project.techStack.length > 0 && (
                    <div className='mt-3 flex flex-wrap items-center justify-center gap-4'>
                      {project.techStack.map((tech) => (
                        <TechIcon key={tech} id={tech} size='sm' />
                      ))}
                    </div>
                  )}
                </div>

                <div className='flex w-full max-w-full items-center justify-center rounded-lg p-2 md:p-3'>
                  {/* Preview rendering is split between mobile app previews and web project previews.
                  Web previews assume a standardized `preview.png` asset exported at 16:9. */}

                  {previewKind === 'mobile' ? (
                    <>
                      <div
                        className={`flex w-full items-end justify-center ${
                          mobilePreviewImages.length <= 1
                            ? 'gap-0'
                            : mobilePreviewImages.length === 2
                              ? 'gap-8'
                              : mobilePreviewImages.length === 3
                                ? 'gap-7'
                                : 'gap-6'
                        } md:hidden`}
                      >
                        {mobilePreviewImages.map((src, index) => (
                          <Image
                            key={`${project.id}-mobile-${index}`}
                            src={src}
                            alt={`${project.title} mobile preview ${index + 1}`}
                            width={900}
                            height={1800}
                            sizes='(max-width: 767px) 33vw'
                            className={`${getPreviewHeightClassName(
                              mobilePreviewImages.length,
                              false,
                            )} w-auto object-contain rounded-2xl shadow-device`}
                            priority={false}
                          />
                        ))}
                      </div>
                      <div
                        className={`hidden w-full items-end justify-center ${getPreviewGapClassName(
                          desktopPreviewImages.length,
                        )} md:flex`}
                      >
                        {desktopPreviewImages.map((src, index) => (
                          <div
                            key={`${project.id}-desktop-${index}`}
                            className='flex items-center justify-center'
                          >
                            <Image
                              src={src}
                              alt={`${project.title} mobile preview ${index + 1}`}
                              width={900}
                              height={1800}
                              sizes='(min-width: 768px) 20vw, 33vw'
                              className={`${getPreviewHeightClassName(
                                desktopPreviewImages.length,
                                true,
                              )} w-auto object-contain rounded-2xl shadow-device`}
                              priority={false}
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    // Standard web preview.
                    // Every web project should provide:
                    //   public/projects/<slug>/preview.png
                    // exported as a true 16:9 image (recommended: 1920×1080 or 1600×900).
                    <div className='w-full max-w-[85%] md:max-w-[600px]'>
                      <Image
                        src={previewImage ?? fullPreview ?? '/fallback.png'}
                        alt={project.title}
                        width={1920}
                        height={1080}
                        sizes='(max-width: 768px) 100vw, 800px'
                        className='h-auto w-full rounded-xl shadow-device'
                        priority={false}
                      />
                    </div>
                  )}
                </div>

                <div className=' flex w-full justify-center gap-4'>
                  {project.projectUrl ? (
                    <Button href={project.projectUrl} variant='primary'>
                      {t('actions.primary')}
                    </Button>
                  ) : null}
                  {project.githubUrl ? (
                    <Button href={project.githubUrl} variant='accent'>
                      {t('actions.secondary')}
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
