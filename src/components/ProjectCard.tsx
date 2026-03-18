'use client';

import Button from '@/components/ui/Button';
import ProjectThumbnail, {
  type PreviewType,
} from '@/components/projects/ProjectThumbnail';
import TechIcon from '@/components/ui/TechIcon';
import { type TechId } from '@/data/techStack';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';
import { getProjectImageSources } from '@/lib/getProjectImage';

/**
 * ProjectCard
 *
 * Presentational component used to display a project entry.
 * Tech stack icons are rendered through the TechIcon UI component,
 * ensuring a single source of truth for icon rendering.
 */

const cardClassName =
  'surface-card mx-auto w-full max-w-4xl rounded-xl backdrop-blur-md backdrop-saturate-150 bg-surface/70 p-4';
const tagsClassName = 'flex items-center gap-3';
const tagClassName = 'group flex items-center justify-center';
const buttonsClassName = 'flex items-center gap-4';

type ProjectCardProps = {
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
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
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

  return (
    <article className={`${cardClassName} project-card-reveal`}>
      <div className='grid h-[276px] grid-cols-[1.1fr_420px] items-stretch gap-6'>
        <div className='flex h-full flex-col justify-between px-2 py-4'>
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
        </div>
        <div className='flex h-full items-center justify-center'>
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
        </div>
      </div>
    </article>
  );
}
