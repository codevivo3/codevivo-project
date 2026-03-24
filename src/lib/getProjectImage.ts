/**
<<<<<<< Updated upstream
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
=======
 * getProjectImageSources
 *
 * Purpose:
 * Builds a prioritized list of possible image paths for a given project asset.
 *
 * Why this exists:
 * - Project images can vary by theme (light/dark) and locale (en/it)
 * - Not all combinations will exist in /public
 * - We generate multiple candidate paths and let the caller pick the first valid one
 *
 * Example output order (most specific → most generic):
 * /projects/my-project/preview.dark.en.png
 * /projects/my-project/preview.dark.png
 * /projects/my-project/preview.en.png
 * /projects/my-project/preview.png
 *
 * This allows graceful fallback without breaking the UI.
 */

// Supported image variants used across project previews
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
  // Add the most specific variant first, then progressively relax theme/locale specificity.
=======
  // Most specific: theme + locale
>>>>>>> Stashed changes
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
