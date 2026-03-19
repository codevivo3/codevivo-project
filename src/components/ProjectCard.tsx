'use client';

import Button from '@/components/ui/Button';
import ProjectThumbnail, {
  type PreviewType,
} from '@/components/projects/ProjectThumbnail';
import TechIcon from '@/components/ui/TechIcon';
import { type TechId } from '@/data/techStack';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getProjectImageSources } from '@/lib/getProjectImage';

/**
 * ProjectCard
 *
 * Displays a single project entry with title, description, tech stack,
 * primary actions, and a preview thumbnail.
 *
 * Behavior:
 * - Large screens: content animation is controlled by the parent via `animateIn`
 * - Medium/small screens: each content block reveals with its own while-in-view motion
 *
 * Notes:
 * - Large-screen layout stays fixed; only the animation trigger changes responsively
 * - Medium/small screens must never depend on `animateIn` to become visible
 * - Thumbnail wrappers keep overflow visible so shadows and scaled previews are not clipped
 */

const cardClassName =
  'glass-effect surface-card mx-auto w-full max-w-4xl rounded-xl bg-[var(--panel-bg)] p-4';
const tagsClassName = 'flex items-center gap-3';
const tagClassName = 'group flex items-center justify-center';
const buttonsClassName = 'flex items-center gap-4';

type ProjectCardProps = {
  animateIn?: boolean;
  title: string;
  description: string;
  tags: TechId[];
  primaryLabel: string;
  secondaryLabel: string;
  projectUrl: string;
  githubUrl: string;
  previewType?: PreviewType;
};

export default function ProjectCard({
  animateIn = true,
  title,
  description,
  tags,
  primaryLabel,
  secondaryLabel,
  projectUrl,
  githubUrl,
  previewType = 'desktop',
}: ProjectCardProps) {
  // State
  const locale = useLocale();
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Responsive content selection
  const normalizedLocale: 'it' | 'en' = locale.startsWith('it') ? 'it' : 'en';
  const projectSlug = (() => {
    try {
      const hostname = new URL(projectUrl).hostname.replace(/^www\./, '');

      if (hostname === 'thepagurojourney.com') {
        return 'paguro';
      }
    } catch {
      // Ignore placeholder or invalid URLs and fall back to title-based slugs.
    }

    const projectNumber = title.match(/\d+/)?.[0];

    if (projectNumber) {
      return `project-${projectNumber}`;
    }

    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  })();

  // Effects
  useEffect(() => {
    const updateTheme = () => {
      setTheme(
        document.documentElement.classList.contains('light') ? 'light' : 'dark'
      );
    };

    updateTheme();

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
      setIsLargeScreen(window.innerHeight > 900);
    };

    checkScreen();
    window.addEventListener('resize', checkScreen);

    return () => {
      window.removeEventListener('resize', checkScreen);
    };
  }, []);

  // Animation variants
  const contentVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  // Responsive animation config
  const viewportConfig = isLargeScreen
    ? { once: true, margin: '-20% 0px -60% 0px' }
    : { once: true, amount: 0.6, margin: '0px 0px -20% 0px' };

  // Derived preview sources
  const previewImage = getProjectImageSources({
    slug: projectSlug,
    type: 'preview',
    theme,
    locale: normalizedLocale,
  }).at(-1);

  const previewImageLeft = getProjectImageSources({
    slug: projectSlug,
    type: 'mobile-left',
    theme,
    locale: normalizedLocale,
  }).at(-1);

  const previewImageCenter = getProjectImageSources({
    slug: projectSlug,
    type: 'mobile-center',
    theme,
    locale: normalizedLocale,
  }).at(-1);

  const previewImageRight = getProjectImageSources({
    slug: projectSlug,
    type: 'mobile-right',
    theme,
    locale: normalizedLocale,
  }).at(-1);

  const fullPreview =
    getProjectImageSources({
      slug: projectSlug,
      type: 'full',
      theme,
      locale: normalizedLocale,
    })[0] ??
    previewImageCenter ??
    previewImage ??
    '';

  const resolvedPreviewImage = previewImage ?? previewImageCenter ?? fullPreview;

  // Render
  return (
    <motion.article className={cardClassName}>
      <div className='grid h-[276px] grid-cols-[1.1fr_420px] items-stretch gap-6'>
        {isLargeScreen ? (
          <motion.div
            className='flex h-full flex-col justify-between px-2 py-4'
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
              <h3 className='text-xl font-semibold'>{title}</h3>
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
                <Button href={projectUrl} variant='primary'>
                  {primaryLabel}
                </Button>
                <Button href={githubUrl} variant='accent'>
                  {secondaryLabel}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            className='flex h-full flex-col justify-between px-2 py-4'
            variants={contentVariants}
            initial='hidden'
            whileInView='visible'
            // Mobile and tablet remain self-contained and must not depend on parent triggers.
            viewport={viewportConfig}
            transition={{
              duration: 1.0,
              delay: 0,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className='space-y-3'>
              <h3 className='text-xl font-semibold'>{title}</h3>
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
                <Button href={projectUrl} variant='primary'>
                  {primaryLabel}
                </Button>
                <Button href={githubUrl} variant='accent'>
                  {secondaryLabel}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
        {isLargeScreen ? (
          <motion.div
            className='flex h-full items-center justify-center'
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
            <div className='aspect-[16/9] w-full max-w-[420px] overflow-visible rounded-md transition-all duration-300 ease-out group-hover:scale-[1.02]'>
              <ProjectThumbnail
                title={title}
                previewImage={resolvedPreviewImage}
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
            className='flex h-full items-center justify-center'
            variants={contentVariants}
            initial='hidden'
            whileInView='visible'
            // Mobile and tablet remain self-contained and must not depend on parent triggers.
            viewport={viewportConfig}
            transition={{
              duration: 1.05,
              delay: 0.15,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className='aspect-[16/9] w-full max-w-[420px] overflow-visible rounded-md transition-all duration-300 ease-out group-hover:scale-[1.02]'>
              <ProjectThumbnail
                title={title}
                previewImage={resolvedPreviewImage}
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
