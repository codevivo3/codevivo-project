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

// Input parameters used to resolve image candidates
type Params = {
  slug: string;
  type: ImageType;
  theme?: 'light' | 'dark';
  locale?: 'it' | 'en';
};

// Returns an ordered list of possible image paths based on slug, type, theme, and locale
export function getProjectImageSources({
  slug,
  type,
  theme,
  locale,
}: Params): string[] {
  // Base path inside /public
  const base = `/projects/${slug}`;
  // Use a Set to avoid duplicate paths while preserving insertion order
  const candidates = new Set<string>();

  // Add the most specific variant first, then progressively relax theme/locale specificity.
  if (theme && locale) {
    candidates.add(`${base}/${type}.${theme}.${locale}.png`);
  }

  // Theme-specific fallback
  if (theme) {
    candidates.add(`${base}/${type}.${theme}.png`);
  }

  // Locale-specific fallback
  if (locale) {
    candidates.add(`${base}/${type}.${locale}.png`);
  }

  // Generic fallback (always exists if asset is provided)
  candidates.add(`${base}/${type}.png`);

  // Convert Set to array while keeping priority order
  return [...candidates];
}
