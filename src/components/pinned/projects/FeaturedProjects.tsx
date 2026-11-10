'use client';

import { useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';

import ProjectCard from '@/components/projects/ProjectCard';
import ExploreProjects from '@/components/projects/ExploreProjects';
import {
  getProjects,
  type LocalizedProjectContent,
  type Project,
} from '@/lib/getProjects';
import ProjectPanel from './ProjectPanel';

type RevealProps = {
  progress: MotionValue<number>;
  index: number;
  total: number;
  children: React.ReactNode;
};

function TabletReveal({ progress, index, total, children }: RevealProps) {
  const step = 0.72 / total;
  const start = 0.06 + index * step;
  const end = start + step * 0.65;

  const opacity = useTransform(progress, [start, end], [0, 1]);
  const y = useTransform(progress, [start, end], [24, 0]);
  const pointerEvents = useTransform(opacity, (value) =>
    value > 0.95 ? 'auto' : 'none',
  );

  return (
    <motion.div
      className='w-full shrink-0'
      style={{ opacity, y, pointerEvents }}
    >
      {children}
    </motion.div>
  );
}

export default function FeaturedProjects() {
  const t = useTranslations('projects');
  const dataT = useTranslations('projectsData');

  const featured = useMemo(() => {
    const items =
      (dataT.raw('selected') as LocalizedProjectContent[] | undefined) ?? [];

    return getProjects(items)
      .filter((item) => item.isVisible !== false)
      .slice(-3);
  }, [dataT]);

  const desktopRef = useRef<HTMLDivElement | null>(null);
  const tabletRef = useRef<HTMLDivElement | null>(null);

  const { scrollYProgress: desktopProgress } = useScroll({
    target: desktopRef,
    offset: ['start start', 'end end'],
  });

  const { scrollYProgress: tabletProgress } = useScroll({
    target: tabletRef,
    offset: ['start start', 'end end'],
  });

  return (
    <section id='projects' className='section-block relative'>
      <div
        className='section-reveal relative'
        style={{ ['--reveal-delay' as string]: '120ms' }}
      >
        {/* Desktop and tablet landscape */}
        <div
          ref={desktopRef}
          className='relative hidden h-[300vh] md:block min-[768px]:max-[1100px]:portrait:hidden'
        >
          <div className='sticky top-0 flex h-[100svh] flex-col items-center justify-start overflow-hidden pt-40'>
            <div className='mx-auto w-full max-w-5xl px-4 sm:px-6'>
              <div className='mb-4 flex flex-col items-center'>
                <h2 className='text-center text-xl font-semibold sm:text-2xl'>
                  {t('title')}
                </h2>
                <span className='mt-2 h-px w-10 bg-primary/70' />
                <p className='mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-fg/72 sm:text-base'>
                  {t('intro')}
                </p>
              </div>
            </div>

            <div className='relative mt-6 h-[420px] w-full'>
              {featured.map((item, index) => (
                <ProjectPanel
                  key={item.id ?? `${item.title}-${index}`}
                  item={item}
                  index={index}
                  total={featured.length + 1}
                  scrollYProgress={desktopProgress}
                  primaryLabel={t('actions.primary')}
                  secondaryLabel={t('actions.secondary')}
                />
              ))}

              <ProjectPanel
                key='explore-projects'
                item={null}
                index={featured.length}
                total={featured.length + 1}
                scrollYProgress={desktopProgress}
                primaryLabel={t('actions.primary')}
                secondaryLabel={t('actions.secondary')}
                renderContent={<ExploreProjects />}
              />
            </div>
          </div>
        </div>

        {/* Tablet portrait: persistent project reveals */}
        <div
          ref={tabletRef}
          className='relative hidden h-[300svh] min-[768px]:max-[1100px]:portrait:block'
        >
          <div className='sticky top-20 grid h-[100svh] grid-rows-[minmax(0,1fr)_auto] overflow-hidden px-6 pt-20 pb-10'>
            {/* Heading and project cards: centered together */}
            <div className='flex min-h-0 w-full flex-col items-center justify-center translate-y-30'>
              <div className='mb-8 flex w-full max-w-3xl shrink-0 flex-col items-center text-center'>
                <h2 className='text-2xl font-semibold'>{t('title')}</h2>

                <span className='mt-2 h-px w-10 bg-primary/70' />

                <p className='mt-4 max-w-2xl text-sm leading-relaxed text-fg/72'>
                  {t('intro')}
                </p>
              </div>

              <div className='flex w-full max-w-3xl shrink-0 flex-col gap-8'>
                {featured.map((item, index) => (
                  <TabletReveal
                    key={item.id ?? `${item.title}-${index}`}
                    progress={tabletProgress}
                    index={index}
                    total={featured.length + 1}
                  >
                    <ProjectCard
                      slug={item.slug}
                      title={item.title}
                      description={item.description}
                      tags={item.techStack ?? []}
                      projectUrl={item.projectUrl}
                      githubUrl={item.githubUrl}
                      previewType={item.previewType}
                      hasFullPreview={item.hasFullPreview}
                      primaryLabel={t('actions.primary')}
                      secondaryLabel={t('actions.secondary')}
                    />
                  </TabletReveal>
                ))}
              </div>
            </div>

            {/* Altri Progetti: anchored independently at the bottom */}
            <div className='w-full max-w-3xl justify-self-center text-center'>
              <TabletReveal
                progress={tabletProgress}
                index={featured.length}
                total={featured.length + 1}
              >
                <ExploreProjects />
              </TabletReveal>
            </div>
          </div>
        </div>

        {/* Mobile */}
        <div className='mx-auto mt-12 flex w-full max-w-5xl flex-col gap-6 px-4 pb-10 sm:px-6 md:hidden'>
          {featured.map((item, index) => (
            <div
              key={item.id ?? `${item.title}-${index}`}
              className='section-reveal'
              style={{
                ['--reveal-delay' as string]: `${index * 70}ms`,
              }}
            >
              <ProjectCard
                slug={item.slug}
                title={item.title}
                description={item.description}
                tags={item.techStack ?? []}
                projectUrl={item.projectUrl}
                githubUrl={item.githubUrl}
                previewType={item.previewType}
                hasFullPreview={item.hasFullPreview}
                primaryLabel={t('actions.primary')}
                secondaryLabel={t('actions.secondary')}
              />
            </div>
          ))}
          <ExploreProjects />
        </div>
      </div>
    </section>
  );
}
