/**
 * Project Image Source Helpers
 *
 * Purpose:
 * Builds ordered candidate image paths for a project asset based on slug, type, theme, and locale.
 *
 * Context:
 * Used internally by `getProjectAssets` to support preview fallback chains.
 *
 * Dependencies:
 * - project asset folders under `/public/projects`
 *
 * Input:
 * - `slug`: folder name under `/public/projects/`
 * - `type`: one of the supported project image variants
 * - `theme`: optional theme suffix
 * - `locale`: optional locale suffix
 *
 * Notes:
 * - The returned list is ordered from most specific to most generic.
 * - This helper only generates possible paths; it does not verify file existence.
 */
export type ImageType =
  | 'preview'
  | 'full'
  | 'mobile-left'
  | 'mobile-center'
  | 'mobile-right';

type Params = {
  slug: string;
  type: ImageType;
  theme?: 'light' | 'dark';
  locale?: 'it' | 'en';
};

export function getProjectImageSources({
  slug,
  type,
  theme,
  locale,
}: Params): string[] {
  const base = `/projects/${slug}`;
  const candidates = new Set<string>();

  // Add the most specific variant first, then progressively relax theme/locale specificity.
  if (theme && locale) {
    candidates.add(`${base}/${type}.${theme}.${locale}.png`);
  }

  if (theme) {
    candidates.add(`${base}/${type}.${theme}.png`);
  }

  if (locale) {
    candidates.add(`${base}/${type}.${locale}.png`);
  }

  candidates.add(`${base}/${type}.png`);

  return [...candidates];
}
