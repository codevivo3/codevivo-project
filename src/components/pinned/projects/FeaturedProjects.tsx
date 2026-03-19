'use client';

import { useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useScroll } from 'framer-motion';
import ProjectCard from '@/components/ProjectCard';
import { type PreviewType } from '@/components/projects/ProjectThumbnail';
import { type TechId } from '@/data/techStack';
import ProjectPanel from './ProjectPanel';

/**
 * FeaturedProjects
 *
 * Renders the pinned projects section with two responsive presentation modes.
 *
 * Behavior:
 * - Large screens: uses a sticky scroll stage and `ProjectPanel` for scroll-driven animation
 * - Medium/small screens: renders a simple stacked list of `ProjectCard` entries
 *
 * Notes:
 * - Mobile and tablet do not depend on desktop scroll progress to show content
 * - Desktop layout and sticky positioning are shared stage concerns and should stay centralized here
 */

type RawProjectItem = {
  id: string;
  title: string;
  description: string;
  tags: TechId[];
  projectUrl: string;
  githubUrl: string;
  previewType?: PreviewType;
};

export default function FeaturedProjects() {
  // Derived data
  const t = useTranslations('projects');
  const featured = useMemo(() => {
    const items = (t.raw('items') as RawProjectItem[] | undefined) ?? [];
    return items.slice(-3);
  }, [t]);

  // Scroll stage refs
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // Render
  return (
    <section id='projects' className='section-block relative'>
      <div
        className='section-reveal relative'
        style={{ ['--reveal-delay' as string]: '120ms' }}
      >
        {/* Desktop sticky stage */}
        <div ref={sectionRef} className='relative hidden h-[300vh] md:block'>
          <div className='sticky top-10 flex h-screen flex-col items-center justify-start overflow-hidden pt-10'>
            <div className='mx-auto w-full max-w-5xl px-4 sm:px-6'>
              <div className='mb-4 flex flex-col items-center'>
                <p className='text-center font-mono-var text-[11px] uppercase tracking-[0.22em] text-fg/60'>
                  {t('overline')}
                </p>
                <span className='mt-2 h-px w-10 bg-primary/70'></span>
              </div>

              <h2 className='text-center text-xl font-semibold sm:text-2xl'>
                {t('title')}
              </h2>
              <p className='mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-fg/72 sm:text-base'>
                {t('intro')}
              </p>
            </div>

            <div className='relative mt-12 flex-1 w-full'>
              {featured.map((item, index) => (
                <ProjectPanel
                  key={item.id ?? `${item.title}-${index}`}
                  item={item}
                  index={index}
                  total={featured.length}
                  scrollYProgress={scrollYProgress}
                  primaryLabel={t('primaryAction')}
                  secondaryLabel={t('secondaryAction')}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Mobile and tablet stacked list */}
        <div className='mx-auto mt-12 flex w-full max-w-5xl flex-col gap-10 px-4 pb-10 sm:px-6 md:hidden'>
          {featured.map((item, index) => (
            <div
              key={item.id ?? `${item.title}-${index}`}
              className='section-reveal'
              style={{ ['--reveal-delay' as string]: `${index * 70}ms` }}
            >
              <ProjectCard
                title={item.title}
                description={item.description}
                tags={item.tags}
                projectUrl={item.projectUrl}
                githubUrl={item.githubUrl}
                previewType={item.previewType}
                primaryLabel={t('primaryAction')}
                secondaryLabel={t('secondaryAction')}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
