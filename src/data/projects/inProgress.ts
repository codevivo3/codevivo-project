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
};

// Derived values
export const inProgressItemsMeta: InProgressItemMeta[] = [
  {
    id: 'in-progress-001',
    slug: 'paguro',
    link: 'https://thepagurojourney.com',
  },
  {
    id: 'in-progress-002',
  },
];
