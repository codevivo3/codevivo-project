import { type PreviewType } from '@/components/projects/ProjectThumbnail';
import type { TechId } from '@/data/techStack';

export type ProjectMeta = {
  id: string;
  slug: string;
  projectUrl?: string;
  githubUrl?: string;
  previewType?: PreviewType;
  techStack?: TechId[];
};

export const projectsMeta: ProjectMeta[] = [
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
