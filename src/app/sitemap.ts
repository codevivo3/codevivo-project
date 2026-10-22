import type { MetadataRoute } from 'next';
import { developmentJournals } from '@/data/projects/developmentJournals';
import { inProgressItemsMeta } from '@/data/projects/inProgress';

const siteUrl = 'https://codevivo.dev';
const locales = ['en', 'it'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const journalPaths = inProgressItemsMeta.flatMap((project) => {
    if (!project.journalSlug || !developmentJournals[project.journalSlug]) {
      return [];
    }

    return [`/projects/${project.journalSlug}/development`];
  });
  const indexablePaths = ['', '/projects', ...journalPaths];

  return indexablePaths.flatMap((path) => {
    const languageAlternates = {
      en: `${siteUrl}/en${path}`,
      it: `${siteUrl}/it${path}`,
      'x-default': path ? `${siteUrl}${path}` : siteUrl,
    };

    return locales.map((locale) => ({
      url: `${siteUrl}/${locale}${path}`,
      alternates: {
        languages: languageAlternates,
      },
    }));
  });
}
