'use client';

import Button from '@/components/ui/Button';
import ProjectThumbnail, {
  type PreviewType,
} from '@/components/projects/ProjectThumbnail';
import TechIcon from '@/components/ui/TechIcon';
import { type TechId } from '@/data/techStack';
import { useTheme } from '@/hooks/useTheme';
import { getProjectAssets } from '@/lib/getProjectAssets';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const tabletPortrait = 'min-[768px]:max-[1100px]:portrait:';

const cardClassName =
  'glass-effect surface-card mx-auto w-full max-w-4xl rounded-xl bg-[var(--panel-bg)] p-5 md:p-4';

const tagsClassName = 'flex flex-wrap items-center gap-3';
const tagClassName = 'group flex items-center justify-center';
const buttonsClassName =
  'flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4';

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
  hasFullPreview?: boolean;
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
  hasFullPreview = false,
}: ProjectCardProps) {
  const locale = useLocale();
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const { theme } = useTheme();

  const normalizedLocale: 'it' | 'en' = locale.startsWith('it') ? 'it' : 'en';

  useEffect(() => {
    const checkScreen = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };

    checkScreen();
    window.addEventListener('resize', checkScreen);

    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  const contentVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  const viewportConfig = isLargeScreen
    ? { once: true, margin: '-20% 0px -60% 0px' }
    : { once: true, amount: 0.6, margin: '0px 0px -20% 0px' };

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
    hasFullPreview,
  });

  const thumbnail = (
    <ProjectThumbnail
      title={title}
      previewImage={previewImage}
      previewImageLeft={previewImageLeft}
      previewImageCenter={previewImageCenter}
      previewImageRight={previewImageRight}
      fullPreview={fullPreview}
      previewType={previewType}
    />
  );

  const techTags = (
    <ul className={tagsClassName} aria-label={`${title} tech stack`}>
      {tags.map((tagId) => (
        <li key={tagId} className={tagClassName}>
          <span className='transition-transform duration-150 group-hover:scale-110'>
            <TechIcon id={tagId} size='sm' />
          </span>
        </li>
      ))}
    </ul>
  );

  const actions = (
    <div className={buttonsClassName}>
      {projectUrl && (
        <Button href={projectUrl} variant='primary'>
          {primaryLabel}
        </Button>
      )}
      {githubUrl && (
        <Button href={githubUrl} variant='accent'>
          {secondaryLabel}
        </Button>
      )}
    </div>
  );

  return (
    <motion.article className={cardClassName}>
      <div className='grid h-auto w-full max-w-full grid-cols-1 items-stretch gap-6 md:h-[276px] md:grid-cols-[minmax(0,1.1fr)_minmax(0,420px)] min-[768px]:max-[1100px]:portrait:!h-auto'>
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
              <h3 className='text-xl font-semibold sm:text-2xl md:text-xl'>
                {title}
              </h3>
              <p className='text-sm leading-5 text-fg/72'>{description}</p>
            </div>

            <div className='space-y-4 pt-2'>
              {techTags}
              {actions}
            </div>
          </motion.div>
        ) : (
          <motion.div
            className='flex h-full w-full max-w-full flex-col justify-between px-2 py-4'
            variants={contentVariants}
            initial='hidden'
            whileInView='visible'
            viewport={viewportConfig}
            transition={{
              duration: 1,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className='space-y-3'>
              <h3 className='text-xl font-semibold sm:text-2xl md:text-xl'>
                {title}
              </h3>
              <p className='text-sm leading-5 text-fg/72'>{description}</p>
            </div>

            <div className='pt-5'>
              <div className='mb-16'>{techTags}</div>

              <motion.div
                className='my-6 flex w-full items-center justify-center sm:hidden'
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
                  } aspect-[16/9] w-full rounded-md py-2`}
                >
                  {thumbnail}
                </div>
              </motion.div>

              <div className='mt-24'>{actions}</div>
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
            <div className='aspect-[16/9] w-full max-w-md rounded-md md:max-w-[380px]'>
              {thumbnail}
            </div>
          </motion.div>
        ) : (
          <motion.div
            className='hidden h-full w-full max-w-full items-center justify-center sm:flex'
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
            <div className='aspect-[16/9] w-full max-w-[85%] rounded-md md:max-w-[380px]'>
              {thumbnail}
            </div>
          </motion.div>
        )}
      </div>
    </motion.article>
  );
}
