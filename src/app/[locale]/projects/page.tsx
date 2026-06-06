/**
 * ProjectsPage
 *
 * Purpose:
 * Builds the localized projects page by combining translated copy with project metadata.
 *
 * Context:
 * Rendered at `/projects` and `/it/projects` as the full archive view for selected, lab, and in-progress work.
 *
 * Dependencies:
 * - next-intl server translations for page copy and structured project content
 * - metadata registries in `src/data/projects/*`
 * - shared design system cards and sections
 *
 * Notes:
 * - Translation files own editorial text; metadata files own slugs, links, and preview wiring.
 * - Keep the merge between translated content and metadata centralized here.
 */
import { getTranslations } from 'next-intl/server';
import InProgressSection from '@/components/projects/InProgressSection';
import LabSection from '@/components/projects/LabSection';
import SelectedSection from '@/components/projects/SelectedSection';
import { inProgressItemsMeta } from '@/data/projects/inProgress';
import { labItemsMeta } from '@/data/projects/lab';
import { getProjects, type LocalizedProjectContent } from '@/lib/getProjects';

type LabItem = {
  id: string;
  title: string;
  description?: string;
  tag?: string;
};

type InProgressItem = {
  id: string;
  title: string;
  description: string;
  slug?: string;
  link?: string;
};

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Derived values
  await params;
  // Retrieve localized strings from next-intl messages (DO NOT hardcode text).
  const pageT = await getTranslations('projectsPage');
  const dataT = await getTranslations('projectsData');

  const rawLabItems = dataT.raw('lab');
  const rawSelectedItems = dataT.raw('selected');
  const rawInProgressItems = dataT.raw('inProgress');

  const translatedLabItems = Array.isArray(rawLabItems)
    ? (rawLabItems as LabItem[])
    : [];
  const translatedSelectedItems = Array.isArray(rawSelectedItems)
    ? (rawSelectedItems as LocalizedProjectContent[])
    : [];
  const translatedInProgressItems = Array.isArray(rawInProgressItems)
    ? (rawInProgressItems as InProgressItem[])
    : [];

  // Only render items explicitly registered in local metadata.
  const labItems = translatedLabItems.filter((item) =>
    labItemsMeta.some((meta) => meta.id === item.id),
  );

  const selectedProjects = getProjects(translatedSelectedItems).filter(
    (project) => project.isVisible !== false,
  );

  // Merge optional preview/link metadata into translated in-progress entries.
  const inProgressItems = translatedInProgressItems
    .map((item) => {
      const meta = inProgressItemsMeta.find((entry) => entry.id === item.id);

      return meta ? { ...item, ...meta } : null;
    })
    .filter((item): item is InProgressItem => item !== null);

  // Render
  return (
    <main className='text-fg'>
      <section className='section-block'>
        <div className='mx-auto w-full max-w-5xl px-4 py-10 pb-24 sm:px-6'>
          <div className='glass-effect mx-auto w-full max-w-4xl rounded-xlpx-6 py-8 text-center sm:px-8'>
            <div className='mb-4 flex flex-col items-center'>
              <h1 className='text-xl font-semibold sm:text-2xl'>
                {pageT('title')}
              </h1>
              <span className='mt-2 h-px w-10 bg-primary/70'></span>
              <p className='mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-fg/72 sm:text-base'>
                {pageT('description')}
              </p>
            </div>
          </div>

          <div className='mt-12 space-y-12 md:mt-24 md:space-y-24'>
            <LabSection items={labItems} title={pageT('labTitle')} />
            <SelectedSection
              projects={selectedProjects}
              title={pageT('selectedTitle')}
            />
            <InProgressSection
              // Keep the compact in-progress area intentionally limited.
              items={inProgressItems.slice(0, 2)}
              title={pageT('inProgressTitle')}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
