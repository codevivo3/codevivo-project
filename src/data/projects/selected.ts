/**
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
import { type PreviewType } from '@/components/projects/ProjectThumbnail';
import type { TechId } from '@/data/techStack';

export type SelectedProjectMeta = {
  id: string;
  slug: string;
  projectUrl?: string;
  githubUrl?: string;
  previewType?: PreviewType;
  techStack?: TechId[];
};

// Derived values
export const selectedProjectsMeta: SelectedProjectMeta[] = [
  {
    id: 'project-001',
    slug: 'paguro',
    projectUrl: 'https://thepagurojourney.com',
    githubUrl: 'https://github.com/codevivo3/the_paguro_journey',
    previewType: 'desktop',
    techStack: ['nextjs', 'react', 'typescript', 'tailwind', 'sanity', 'vercel'],
  },
  {
    id: 'project-002',
    slug: 'position-size-calculator',
    projectUrl: '#',
    githubUrl: '#',
    techStack: ['react', 'typescript', 'tailwind'],
  },
  {
    id: 'project-003',
    slug: 'recipe-planner',
    projectUrl: '#',
    githubUrl: '#',
    previewType: 'mobile',
    techStack: ['react', 'typescript', 'tailwind'],
  },
];
