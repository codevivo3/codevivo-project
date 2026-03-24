/**
<<<<<<< Updated upstream
 * Selected Project Metadata
 *
 * Purpose:
 * Stores non-translated metadata for selected projects such as slugs, links, and preview type.
 *
 * Context:
 * Merged with translated selected project copy on the projects page and homepage.
 *
 * Dependencies:
 * - preview system (`getProjectAssets` / `ProjectThumbnail`)
 * - projects page and homepage project sections
 *
 * Notes:
 * - `slug` values must match folders under `/public/projects/`.
 * - Keep URLs and preview-specific settings here so translation files remain content-only.
 */
=======
 * selectedProjectsMeta
 *
 * Purpose:
 * Defines stable metadata for highlighted projects, including slugs and outbound links.
 *
 * Context:
 * Merged with localized project copy on the projects page and in featured project sections.
 *
 * Notes:
 * Keep ids aligned with translation data so metadata can be attached predictably.
 */

>>>>>>> Stashed changes
import { type PreviewType } from '@/components/projects/ProjectThumbnail';

export type SelectedProjectMeta = {
  id: string;
  slug: string;
  projectUrl?: string;
  githubUrl?: string;
  previewType?: PreviewType;
};

// Derived values
export const selectedProjectsMeta: SelectedProjectMeta[] = [
  {
    id: 'project-001',
    slug: 'paguro',
    projectUrl: 'https://thepagurojourney.com',
    githubUrl: 'https://github.com/codevivo3/the_paguro_journey',
    previewType: 'desktop',
  },
  {
    id: 'project-002',
    slug: 'position-size-calculator',
    projectUrl: '#',
    githubUrl: '#',
  },
  {
    id: 'project-003',
    slug: 'recipe-planner',
    projectUrl: '#',
    githubUrl: '#',
    previewType: 'mobile',
  },
];
