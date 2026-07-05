/**
 * InProgress Project Metadata
 *
 * Purpose:
 * Stores non-translated metadata for in-progress entries such as preview slugs and external links.
 *
 * Context:
 * Merged with translated copy on the projects page before rendering `InProgressSection`.
 *
 * Dependencies:
 * - preview asset lookup via `getProjectAssets`
 * - projects page data merge logic
 *
 * Notes:
 * - Keep editorial copy out of this file; translations live in the locale-specific `projectsData.json` files.
 * - `slug` values must match folders under `/public/projects/` when previews are expected.
 */
export type InProgressItemMeta = {
  id: string;
  slug?: string;
  link?: string;
  startedAt?: string;
  updatedAt?: string;
  milestone?: string;
  status?: 'planning' | 'building' | 'testing' | 'launching';
  currentStage?: string;
  stages?: string[];
  journalSlug?: string;
  latestEntrySlug?: string;
};

// Derived values
export const inProgressItemsMeta: InProgressItemMeta[] = [
  {
    id: 'in-progress-001',
    slug: 'nine2fire',
    link: 'https://www.nine2fire.com/',
    startedAt: '2026-06-19',
    updatedAt: '2026-07-05',
    milestone: 'editorial-system',
    status: 'building',
    currentStage: 'content-system',
    stages: [
      'idea',
      'brand-foundation',
      'content-system',
      'tools',
      'newsletter',
      'monetization',
    ],
  },
  {
    id: 'in-progress-002',
    slug: 'decklog',
    link: 'https://www.decklog.boats/',
    startedAt: '2026-06-26',
    updatedAt: '2026-07-05',
    milestone: 'product-architecture',
    status: 'building',
    currentStage: 'product-architecture',
    stages: [
      'idea',
      'research',
      'product-architecture',
      'core-features',
      'mvp',
      'beta',
      'production',
    ],
    journalSlug: 'decklog',
  },
];
