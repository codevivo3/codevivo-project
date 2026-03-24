'use client';

/**
 * FeaturedProjects
 *
 * Purpose:
 * Renders the homepage featured work section with desktop pinned panels and mobile stacked cards.
 *
 * Context:
 * Used on the homepage as the main project showcase before the broader projects archive page.
 *
 * Dependencies:
 * - next-intl for localized headings and CTA labels
 * - `ProjectCard`, `ProjectPanel`, and `ExploreProjects`
 * - Framer Motion scroll progress for the desktop pinned experience
 *
 * Notes:
 * - Desktop and mobile layouts intentionally diverge here; do not push that branching into the card component.
 * - The final panel is a navigation card, not a project entry.
 */
import { useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useScroll } from 'framer-motion';
import ProjectCard from '@/components/projects/ProjectCard';
import ExploreProjects from '@/components/projects/ExploreProjects';
import { type PreviewType } from '@/components/projects/ProjectThumbnail';
import { type TechId } from '@/data/techStack';
import ProjectPanel from './ProjectPanel';

<<<<<<< Updated upstream
=======
/**
 * FeaturedProjects
 *
 * Purpose:
 * Renders the featured projects section with separate desktop and mobile presentation flows.
 *
 * Context:
 * Used on the homepage to showcase selected work before linking to the full projects archive.
 *
 * Notes:
 * Desktop sticky behavior stays centralized here so child panels can remain focused on card presentation.
 */

>>>>>>> Stashed changes
type RawProjectItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: TechId[];
  projectUrl: string;
  githubUrl: string;
  previewType?: PreviewType;
};

export default function FeaturedProjects() {
<<<<<<< Updated upstream
  // Retrieve localized strings from next-intl messages (DO NOT hardcode text).
=======
  // Derived values
>>>>>>> Stashed changes
  const t = useTranslations('projects');
  const featured = useMemo(() => {
    const items = (t.raw('items') as RawProjectItem[] | undefined) ?? [];
    return items.slice(-3);
  }, [t]);

<<<<<<< Updated upstream
  // Drive desktop panel transitions from a single sticky scroll stage.
=======
  // State
>>>>>>> Stashed changes
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  return (
    <section id='projects' className='section-block relative'>
      <div
        className='section-reveal relative'
        style={{ ['--reveal-delay' as string]: '120ms' }}
      >
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
                  total={featured.length + 1}
                  scrollYProgress={scrollYProgress}
                  primaryLabel={t('primaryAction')}
                  secondaryLabel={t('secondaryAction')}
                />
              ))}

              <ProjectPanel
                key="explore-projects"
                item={null}
                index={featured.length}
                total={featured.length + 1}
                scrollYProgress={scrollYProgress}
                primaryLabel={t('primaryAction')}
                secondaryLabel={t('secondaryAction')}
                renderContent={<ExploreProjects />}
              />
            </div>
          </div>
        </div>

<<<<<<< Updated upstream
        {/* Mobile and tablet stacked list */}
        <div className='mx-auto mt-12 flex w-full max-w-5xl max-w-full flex-col gap-6 px-4 pb-10 sm:px-6 md:hidden'>
=======
        <div className='mx-auto mt-12 flex w-full max-w-5xl flex-col gap-10 px-4 pb-10 sm:px-6 md:hidden'>
>>>>>>> Stashed changes
          {featured.map((item, index) => (
            <div
              key={item.id ?? `${item.title}-${index}`}
              className='section-reveal'
              style={{ ['--reveal-delay' as string]: `${index * 70}ms` }}
            >
              <ProjectCard
                slug={item.slug}
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
          <ExploreProjects />
        </div>
      </div>
    </section>
  );
}
