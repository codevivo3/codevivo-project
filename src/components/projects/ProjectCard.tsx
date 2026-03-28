'use client';

/**
 * ProjectCard
 *
 * Purpose:
 * Renders a reusable featured project card with copy, actions, tech tags, and preview media.
 *
 * Context:
 * Used on the homepage in both the pinned desktop experience and the stacked mobile list.
 *
 * Dependencies:
 * - centralized preview system via `getProjectAssets`
 * - next-intl locale state for preview variants
 * - `ProjectThumbnail` and shared `Button` / `TechIcon` components
 *
 * Notes:
 * - Keep preview resolution centralized here rather than scattering image path logic in callers.
 * - Desktop and mobile animation triggers intentionally differ; preserve that split.
 */
import Button from '@/components/ui/Button';
import ProjectThumbnail, {
  type PreviewType,
} from '@/components/projects/ProjectThumbnail';
import TechIcon from '@/components/ui/TechIcon';
import { type TechId } from '@/data/techStack';
import { getProjectAssets } from '@/lib/getProjectAssets';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const cardClassName =
  'glass-effect surface-card mx-auto w-full max-w-4xl rounded-xl bg-[var(--panel-bg)] p-5 md:p-4';
const tagsClassName = 'flex flex-wrap items-center gap-3';
const tagClassName = 'group flex items-center justify-center';
const buttonsClassName = 'flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4';

type ProjectCardProps = {
  animateIn?: boolean;
  slug: string;
  title: string;
  description: string;
  tags: TechId[];
  primaryLabel: string;
  secondaryLabel: string;
  projectUrl?: string;
  githubUrl?: string;
  previewType?: PreviewType;
};

export default function ProjectCard({
  animateIn = true,
  slug,
  title,
  description,
  tags,
  primaryLabel,
  secondaryLabel,
  projectUrl,
  githubUrl,
  previewType = 'desktop',
}: ProjectCardProps) {
  const locale = useLocale();
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Normalize locale for image selection.
  const normalizedLocale: 'it' | 'en' = locale.startsWith('it') ? 'it' : 'en';

  useEffect(() => {
    const updateTheme = () => {
      setTheme(
        document.documentElement.classList.contains('light') ? 'light' : 'dark'
      );
    };

    updateTheme();

    // Detect current theme from document root so preview variants stay in sync with the UI theme.
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const checkScreen = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };

    checkScreen();
    window.addEventListener('resize', checkScreen);

    return () => {
      window.removeEventListener('resize', checkScreen);
    };
  }, []);

  const contentVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  const viewportConfig = isLargeScreen
    ? { once: true, margin: '-20% 0px -60% 0px' }
    : { once: true, amount: 0.6, margin: '0px 0px -20% 0px' };

  // Resolve preview assets using the centralized helper to keep file fallback logic in one place.
  const {
    previewImage,
    previewImageLeft,
    previewImageCenter,
    previewImageRight,
    fullPreview,
  } = getProjectAssets({
    slug,
    theme,
    locale: normalizedLocale,
  });

  return (
    <motion.article className={cardClassName}>
      <div className='grid h-auto w-full max-w-full grid-cols-1 items-stretch gap-6 md:h-[276px] md:grid-cols-[minmax(0,1.1fr)_minmax(0,420px)]'>
        {isLargeScreen ? (
          <motion.div
            className='flex h-full w-full max-w-full flex-col justify-between px-2 py-2 md:py-4'
            variants={contentVariants}
            initial='hidden'
            animate={animateIn ? 'visible' : 'hidden'}
            transition={{
              type: 'spring',
              stiffness: 90,
              damping: 18,
            }}
          >
            <div className='space-y-3'>
              <h3 className='text-xl font-semibold sm:text-2xl md:text-xl'>{title}</h3>
              <p className='text-sm leading-5 text-fg/72'>{description}</p>
            </div>
            <div className='space-y-4 pt-2'>
              <ul className={tagsClassName} aria-label={`${title} tech stack`}>
                {tags.map((tagId) => {
                  return (
                    <li key={tagId} className={tagClassName}>
                      <span className='transition-transform duration-150 group-hover:scale-110'>
                        <TechIcon id={tagId} size='sm' />
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className={buttonsClassName}>
                {projectUrl ? (
                  <Button href={projectUrl} variant='primary'>
                    {primaryLabel}
                  </Button>
                ) : null}
                {githubUrl ? (
                  <Button href={githubUrl} variant='accent'>
                    {secondaryLabel}
                  </Button>
                ) : null}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            className='flex h-full w-full max-w-full flex-col justify-between px-2 py-4 md:py-4'
            variants={contentVariants}
            initial='hidden'
            whileInView='visible'
            // Smaller screens handle their own reveal so they do not wait on the pinned desktop flow.
            viewport={viewportConfig}
            transition={{
              duration: 1.0,
              delay: 0,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className='space-y-3'>
              <h3 className='text-xl font-semibold sm:text-2xl md:text-xl'>{title}</h3>
              <p className='text-sm leading-5 text-fg/72'>{description}</p>
            </div>
            <div className='pt-5'>
              <ul className={tagsClassName + ' mb-16'} aria-label={`${title} tech stack`}>
                {tags.map((tagId) => {
                  return (
                    <li key={tagId} className={tagClassName}>
                      <span className='transition-transform duration-150 group-hover:scale-110'>
                        <TechIcon id={tagId} size='sm' />
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-6" />
              <motion.div
                className='flex w-full items-center justify-center sm:hidden my-6'
                variants={contentVariants}
                initial='hidden'
                whileInView='visible'
                viewport={viewportConfig}
                transition={{
                  duration: 1.05,
                  delay: 0.15,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <div
                  className={`${
                    previewType === 'mobile' ? 'max-w-[70%]' : 'max-w-[64%]'
                  } aspect-[16/9] w-full overflow-visible rounded-md transition-all duration-300 ease-out group-hover:scale-[1.01] my-0 py-2`}
                >
                  <ProjectThumbnail
                    title={title}
                    previewImage={previewImage}
                    previewImageLeft={previewImageLeft}
                    previewImageCenter={previewImageCenter}
                    previewImageRight={previewImageRight}
                    fullPreview={fullPreview}
                    previewType={previewType}
                  />
                </div>
              </motion.div>
              <div className='grid grid-cols-2 items-stretch gap-3 mt-24 sm:flex sm:items-center sm:gap-4'>
                {projectUrl ? (
                  <Button href={projectUrl} variant='primary'>
                    {primaryLabel}
                  </Button>
                ) : null}
                {githubUrl ? (
                  <Button href={githubUrl} variant='accent'>
                    {secondaryLabel}
                  </Button>
                ) : null}
              </div>
            </div>
          </motion.div>
        )}
        {isLargeScreen ? (
          <motion.div
            className='flex h-full w-full max-w-full items-center justify-center'
            variants={contentVariants}
            initial='hidden'
            animate={animateIn ? 'visible' : 'hidden'}
            transition={{
              type: 'spring',
              stiffness: 90,
              damping: 18,
              delay: 0.04,
            }}
          >
            <div className='aspect-[16/9] w-full max-w-md overflow-visible rounded-md transition-all duration-300 ease-out group-hover:scale-[1.01] md:max-w-[380px]'>
              <ProjectThumbnail
                title={title}
                previewImage={previewImage}
                previewImageLeft={previewImageLeft}
                previewImageCenter={previewImageCenter}
                previewImageRight={previewImageRight}
                fullPreview={fullPreview}
                previewType={previewType}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            className='hidden h-full w-full max-w-full items-center justify-center sm:flex'
            variants={contentVariants}
            initial='hidden'
            whileInView='visible'
            // Smaller screens handle their own reveal so the thumbnail appears independently of parent state.
            viewport={viewportConfig}
            transition={{
              duration: 1.05,
              delay: 0.15,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className='aspect-[16/9] w-full max-w-[85%] overflow-visible rounded-md transition-all duration-300 ease-out group-hover:scale-[1.01] md:max-w-[380px]'>
              <ProjectThumbnail
                title={title}
                previewImage={previewImage}
                previewImageLeft={previewImageLeft}
                previewImageCenter={previewImageCenter}
                previewImageRight={previewImageRight}
                fullPreview={fullPreview}
                previewType={previewType}
              />
            </div>
          </motion.div>
        )}
      </div>
    </motion.article>
  );
}
