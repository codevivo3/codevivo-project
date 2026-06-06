import { type PreviewType } from '@/components/projects/ProjectThumbnail';
import type { TechId } from '@/data/techStack';

export type ProjectMeta = {
  id: string;
  slug: string;
  projectUrl?: string;
  githubUrl?: string;
  isVisible?: boolean;
  hasFullPreview?: boolean;
  previewType?: PreviewType;
  techStack?: TechId[];
};

export const projectsMeta: ProjectMeta[] = [
  {
    id: 'project-001',
    slug: 'paguro',
    projectUrl: 'https://thepagurojourney.com',
    githubUrl: 'https://github.com/codevivo3/the_paguro_journey',
    isVisible: true,
    hasFullPreview: true,
    previewType: 'desktop',
    techStack: [
      'nextjs',
      'react',
      'typescript',
      'tailwind',
      'sanity',
      'vercel',
    ],
  },
  {
    id: 'project-002',
    slug: 'nine2fire',
    projectUrl: 'https://www.nine2fire.com/',
    githubUrl: 'https://github.com/codevivo3/nine2fire-project',
    isVisible: true,
    hasFullPreview: true,
    previewType: 'desktop',
    techStack: [
      'nextjs',
      'react',
      'typescript',
      'tailwind',
      'sanity',
      'vercel',
    ],
  },
  {
    id: 'project-003',
    slug: 'recipe-planner',
    projectUrl: '#',
    githubUrl: '#',
    isVisible: false,
    previewType: 'mobile',
    techStack: ['react', 'typescript', 'tailwind'],
  },
];
