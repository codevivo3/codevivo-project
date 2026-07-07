import Link from 'next/link';
import { developmentJournals } from '@/data/projects/developmentJournals';
import { inProgressItemsMeta } from '@/data/projects/inProgress';
import { ArrowUpRight, ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

type LocalizedInProgressItem = {
  id: string;
  title: string;
  description: string;
};

type ProductJourneyContent = {
  stageLabels?: Record<string, string>;
  milestoneLabels?: Record<string, string>;
};

type JournalEntryTranslation = {
  title: string;
  summary: string;
};

type JournalTranslation = {
  entries?: Record<string, JournalEntryTranslation>;
  categories?: Record<string, string>;
  nextSteps?: Record<string, string>;
};

function formatJournalDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00`));
}

export default async function DevelopmentJournalPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const projectsDataT = await getTranslations('projectsData');
  const journalsT = await getTranslations('developmentJournals');

  const projectMeta = inProgressItemsMeta.find(
    (item) => item.journalSlug === slug,
  );
  const journalMeta = developmentJournals[slug];

  if (!projectMeta || !journalMeta) {
    notFound();
  }

  const rawInProgressItems = projectsDataT.raw('inProgress');
  const rawProductJourney = projectsDataT.raw('productJourney');
  const rawJournal = journalsT.raw(slug);
  const rawPageCopy = journalsT.raw('page');

  const translatedInProgressItems = Array.isArray(rawInProgressItems)
    ? (rawInProgressItems as LocalizedInProgressItem[])
    : [];
  const productJourney =
    rawProductJourney &&
    typeof rawProductJourney === 'object' &&
    !Array.isArray(rawProductJourney)
      ? (rawProductJourney as ProductJourneyContent)
      : undefined;
  const journalContent =
    rawJournal && typeof rawJournal === 'object' && !Array.isArray(rawJournal)
      ? (rawJournal as JournalTranslation)
      : null;
  const pageCopy =
    rawPageCopy &&
    typeof rawPageCopy === 'object' &&
    !Array.isArray(rawPageCopy)
      ? (rawPageCopy as Record<string, string>)
      : null;

  const projectCopy = translatedInProgressItems.find(
    (item) => item.id === projectMeta.id,
  );

  if (!projectCopy || !journalContent || !pageCopy) {
    notFound();
  }

  const currentStageLabel = projectMeta.currentStage
    ? productJourney?.stageLabels?.[projectMeta.currentStage]
    : undefined;
  const milestoneLabel = projectMeta.milestone
    ? productJourney?.milestoneLabels?.[projectMeta.milestone]
    : undefined;
  const latestEntryMeta =
    (projectMeta.latestEntrySlug
      ? journalMeta.entries.find(
          (entry) => entry.slug === projectMeta.latestEntrySlug,
        )
      : undefined) ?? journalMeta.entries[0];

  if (!latestEntryMeta) {
    notFound();
  }

  const latestEntryContent = journalContent.entries?.[latestEntryMeta.slug];

  if (!latestEntryContent) {
    notFound();
  }

  const entries = journalMeta.entries.map((entry) => {
    const entryContent = journalContent.entries?.[entry.slug];

    if (!entryContent) {
      notFound();
    }

    return {
      ...entry,
      title: entryContent.title,
      summary: entryContent.summary,
      categoryLabel:
        journalContent.categories?.[entry.category] ?? entry.category,
    };
  });

  const nextSteps = journalMeta.nextStepKeys.map((stepKey) => {
    const label = journalContent.nextSteps?.[stepKey];

    if (!label) {
      notFound();
    }

    return label;
  });

  const currentStageIndex =
    projectMeta.currentStage && projectMeta.stages?.length
      ? projectMeta.stages.indexOf(projectMeta.currentStage)
      : -1;
  const hasStageProgress =
    currentStageIndex >= 0 &&
    !!currentStageLabel &&
    !!projectMeta.stages?.length;

  return (
    <main className='text-fg'>
      <section className='section-block'>
        <div className='mx-auto w-full max-w-5xl px-4 py-10 pb-24 sm:px-6'>
          <div className='space-y-6'>
            <Link
              href={`/${locale}/projects`}
              className='group inline-flex w-fit items-center gap-1 text-sm font-medium text-accent transition-all hover:font-semibold'
            >
              <span className='inline-flex items-center gap-1'>
                <ArrowLeft
                  size={16}
                  className='transition-transform group-hover:-translate-x-0.5'
                />
                {pageCopy.backToProjects}
              </span>
            </Link>

            <div className='glass-effect surface-card rounded-xl bg-[var(--panel-bg)] p-6 sm:p-8'>
              <div className='flex flex-col gap-6'>
                <div className='space-y-4'>
                  <div className='flex flex-wrap items-center gap-3'>
                    <span className='text-[11px] font-mono uppercase tracking-wide text-fg/55'>
                      {pageCopy.title}
                    </span>
                    {milestoneLabel ? (
                      <span className='rounded-full border border-primary/40 bg-primary/15 px-4 py-0.5 text-[11px] font-mono font-medium uppercase tracking-wide text-primary'>
                        {milestoneLabel}
                      </span>
                    ) : null}
                  </div>
                  <div className='space-y-3'>
                    <h1 className='text-2xl font-semibold sm:text-3xl'>
                      {projectCopy.title}
                    </h1>
                    <p className='max-w-3xl text-sm leading-relaxed text-fg/72 sm:text-base'>
                      {projectCopy.description}
                    </p>
                    <p className='max-w-3xl text-sm leading-relaxed text-fg/58'>
                      {pageCopy.description}
                    </p>
                  </div>
                </div>

                {projectMeta.link ? (
                  <a
                    href={projectMeta.link}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='group inline-flex w-fit items-center gap-1 text-sm font-medium text-accent transition-all hover:font-semibold'
                  >
                    <span className='inline-flex items-center gap-1'>
                      {pageCopy.visitWebsite}
                      <ArrowUpRight
                        size={16}
                        className='text-current transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5'
                      />
                    </span>
                  </a>
                ) : null}
              </div>
            </div>

            <div className='grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]'>
              <div className='glass-effect surface-card rounded-xl bg-[var(--panel-bg)] p-6 sm:p-7'>
                <div className='space-y-4'>
                  <div className='space-y-1'>
                    <h2 className='text-lg font-semibold'>
                      {pageCopy.journeyTitle}
                    </h2>
                    {currentStageLabel ? (
                      <p className='text-sm text-fg/72'>
                        {pageCopy.currentStageLabel}: {currentStageLabel}
                      </p>
                    ) : null}
                  </div>

                  {hasStageProgress ? (
                    <div
                      className='flex items-center gap-1.5'
                      aria-label={currentStageLabel}
                    >
                      {projectMeta.stages?.map((stage, index) => {
                        const isActive = index <= currentStageIndex;

                        return (
                          <span
                            key={stage}
                            className={`h-1.5 min-w-0 flex-1 rounded-full transition-colors duration-200 ${
                              isActive ? 'bg-primary' : 'bg-fg/12'
                            }`}
                          />
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className='glass-effect surface-card rounded-xl bg-[var(--panel-bg)] p-6 sm:p-7'>
                <div className='space-y-4'>
                  <div className='space-y-1'>
                    <h2 className='text-lg font-semibold'>
                      {pageCopy.latestUpdateTitle}
                    </h2>
                    <div className='flex flex-wrap items-center gap-3 text-sm text-fg/60'>
                      <span>
                        {formatJournalDate(latestEntryMeta.date, locale)}
                      </span>
                      <span className='rounded-full border border-border px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-wide text-fg/70'>
                        {journalContent.categories?.[
                          latestEntryMeta.category
                        ] ?? latestEntryMeta.category}
                      </span>
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <h3 className='text-base font-semibold'>
                      {latestEntryContent.title}
                    </h3>
                    <p className='text-sm leading-relaxed text-fg/72'>
                      {latestEntryContent.summary}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className='grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]'>
              <div className='glass-effect surface-card rounded-xl bg-[var(--panel-bg)] p-6 sm:p-7'>
                <div className='space-y-5'>
                  <h2 className='text-lg font-semibold'>{pageCopy.logTitle}</h2>
                  <div className='space-y-4'>
                    {entries.map((entry) => (
                      <article
                        key={entry.slug}
                        className='rounded-lg border border-border/70 bg-surface/30 p-4'
                      >
                        <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                          <div className='space-y-1'>
                            <h3 className='text-base font-semibold'>
                              {entry.title}
                            </h3>
                            <div className='flex flex-wrap items-center gap-3 text-sm text-fg/60'>
                              <span>
                                {formatJournalDate(entry.date, locale)}
                              </span>
                              <span className='rounded-full border border-border px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-wide text-fg/70'>
                                {entry.categoryLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                        <p className='mt-3 text-sm leading-relaxed text-fg/72'>
                          {entry.summary}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>

              <div className='glass-effect surface-card rounded-xl bg-[var(--panel-bg)] p-6 sm:p-7'>
                <div className='space-y-4'>
                  <h2 className='text-lg font-semibold'>
                    {pageCopy.nextStepsTitle}
                  </h2>
                  <ul className='space-y-3'>
                    {nextSteps.map((step) => (
                      <li
                        key={step}
                        className='rounded-lg border border-border/70 bg-surface/30 px-4 py-3 text-sm text-fg/78'
                      >
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
