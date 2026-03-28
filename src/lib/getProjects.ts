import { projectsMeta, type ProjectMeta } from '@/data/projects/projectsMeta';

export type LocalizedProjectContent = {
  id: string;
  title: string;
  description: string;
  longDescription?: string;
  challenge?: string;
  solution?: string;
  outcome?: string;
};

export type Project = ProjectMeta & LocalizedProjectContent;

export function getProjects(localizedProjects: LocalizedProjectContent[]): Project[] {
  const localizedById = new Map(localizedProjects.map((project) => [project.id, project]));

  const missingContentIds = projectsMeta
    .filter((meta) => !localizedById.has(meta.id))
    .map((meta) => meta.id);
  const orphanContentIds = localizedProjects
    .filter((project) => !projectsMeta.some((meta) => meta.id === project.id))
    .map((project) => project.id);

  if (missingContentIds.length > 0 || orphanContentIds.length > 0) {
    throw new Error(
      [
        'Project data mismatch detected.',
        missingContentIds.length > 0
          ? `Missing localized content for: ${missingContentIds.join(', ')}`
          : null,
        orphanContentIds.length > 0
          ? `Missing metadata for: ${orphanContentIds.join(', ')}`
          : null,
      ]
        .filter(Boolean)
        .join(' '),
    );
  }

  return projectsMeta.map((meta) => {
    const content = localizedById.get(meta.id);

    if (!content) {
      throw new Error(`Missing localized content for project "${meta.id}".`);
    }

    return {
      ...meta,
      ...content,
    };
  });
}
