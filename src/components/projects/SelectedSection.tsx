'use client';

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
  const locale = useLocale();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  const normalizedLocale: 'it' | 'en' = locale.startsWith('it') ? 'it' : 'en';

  useEffect(() => {
    const updateTheme = () => {
      setTheme(
        document.documentElement.classList.contains('light')
          ? 'light'
          : 'dark'
      );
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className='space-y-6'>
      <h2 className='mx-auto w-full max-w-4xl text-lg font-semibold'>
        {title}
      </h2>
      <div className='space-y-20'>
        {projects.map((project) => {
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
              className='glass-effect surface-card mx-auto flex w-full max-w-4xl flex-col justify-center rounded-xl bg-[var(--panel-bg)] p-4 min-h-[65vh]'
            >
              <div className='mx-auto flex max-w-3xl flex-col justify-center gap-5 text-center'>
                <h3 className='text-xl font-semibold'>{project.title}</h3>

                <div className='flex w-full items-center justify-center overflow-hidden rounded-lg'>
                  <div className='flex w-full items-center justify-center'>
                    <div className='relative w-full max-w-[600px] aspect-[16/9] rounded-lg overflow-hidden'>
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

                <p className='text-sm leading-relaxed text-fg/72'>
                  {project.description}
                </p>

                <div className='pt-2'>
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
