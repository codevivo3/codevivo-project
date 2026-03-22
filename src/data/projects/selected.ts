import { type PreviewType } from '@/components/projects/ProjectThumbnail';

export type SelectedProjectMeta = {
  id: string;
  slug: string;
  projectUrl?: string;
  githubUrl?: string;
  previewType?: PreviewType;
};

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
