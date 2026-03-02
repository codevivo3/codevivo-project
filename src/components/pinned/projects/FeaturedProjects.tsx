'use client';

import { useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useScroll } from 'framer-motion';
import ProjectPanel, { type ProjectItem } from './ProjectPanel';

type ProjectTag = {
  id: string;
  label: string;
};

type RawProjectItem = {
  id: string;
  title: string;
  description: string;
  tags: ProjectTag[];
};

function StaticProjectCard({
  item,
  overline,
  primaryLabel,
  secondaryLabel,
}: {
  item: ProjectItem;
  overline: string;
  primaryLabel: string;
  secondaryLabel: string;
}) {
  return (
    <article className='mx-auto w-full max-w-3xl rounded-xl bg-surface p-10 text-center'>
      <p className='text-[11px] uppercase tracking-[0.22em] text-fg/60 font-mono-var'>
        {overline}
      </p>
      <h3 className='mt-3 text-2xl font-semibold'>{item.title}</h3>
      <p className='mt-4 text-sm text-fg/70'>{item.description}</p>
      <div className='mt-6 flex flex-wrap justify-center gap-2'>
        {item.tags.map((tag) => (
          <span
            key={tag.id}
            className='rounded-full border border-border/50 px-2 py-0.5 text-xs text-fg/70 font-mono-var'
          >
            {tag.label}
          </span>
        ))}
      </div>
      <div className='mt-6 flex flex-wrap justify-center gap-3'>
        <button className='w-full rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-fg transition hover:bg-surface hover:text-fg sm:w-auto'>
          {primaryLabel}
        </button>
        <button className='w-full rounded-md border border-border px-3 py-1.5 text-xs font-medium text-fg/70 transition hover:bg-surface sm:w-auto'>
          {secondaryLabel}
        </button>
      </div>
    </article>
  );
}

export default function FeaturedProjects() {
  const t = useTranslations('projects');
  const items = (t.raw('items') as RawProjectItem[] | undefined) ?? [];
  const featured = useMemo(() => items.slice(-3), [items]);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  return (
    <section id='projects' className='relative'>
      <div className='relative'>
        <div ref={sectionRef} className='relative hidden h-[300vh] md:block'>
          <div className='sticky top-0 flex h-screen flex-col items-center justify-start overflow-hidden pt-10'>
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
            </div>

            <div className='relative flex-1 w-full'>
              {featured.map((item, index) => (
                <ProjectPanel
                  key={item.id ?? `${item.title}-${index}`}
                  item={item}
                  index={index}
                  total={featured.length}
                  scrollYProgress={scrollYProgress}
                  overline={t('overline')}
                  primaryLabel={t('primaryAction')}
                  secondaryLabel={t('secondaryAction')}
                />
              ))}
            </div>
          </div>
        </div>

        <div className='mx-auto w-full max-w-5xl space-y-16 px-4 pb-10 sm:px-6 md:hidden'>
          {featured.map((item, index) => (
            <StaticProjectCard
              key={item.id ?? `${item.title}-${index}`}
              item={item}
              overline={t('overline')}
              primaryLabel={t('primaryAction')}
              secondaryLabel={t('secondaryAction')}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
