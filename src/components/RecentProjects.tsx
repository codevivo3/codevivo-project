import { useTranslations } from 'next-intl';
import ProjectCard from './ProjectCard';

type ProjectTag = {
  id: string;
  label: string;
};

type ProjectItem = {
  id: string;
  title: string;
  description: string;
  tags: ProjectTag[];
};

export default function RecentProjects() {
  const t = useTranslations('projects');
  const items = (t.raw('items') as ProjectItem[] | undefined) ?? [];

  return (
    <section id="projects" className="section-flow">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <h2 className="text-center text-xl font-semibold sm:text-2xl">
          {t('title')}
        </h2>
        <div className="mt-6 grid gap-4 sm:mt-8 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <ProjectCard
              key={item.id ?? `${item.title}-${index}`}
              title={item.title}
              description={item.description}
              tags={item.tags ?? []}
              primaryLabel={t('primaryAction')}
              secondaryLabel={t('secondaryAction')}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
