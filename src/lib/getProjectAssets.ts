/**
 * Resolves project image assets based on slug, theme, and locale.
 *
 * Purpose:
 * Provides a normalized set of preview assets for project cards and project detail sections.
 *
 * Context:
 * Shared by `ProjectCard`, `SelectedSection`, and `InProgressSection`.
 *
 * Dependencies:
 * - `getProjectImageSources` for candidate path generation
 *
 * Input:
 * - `slug`: must match a folder under `/public/projects/`
 * - `theme`: current UI theme used for theme-specific image variants
 * - `locale`: normalized locale used for locale-specific image variants
 *
 * Output:
 * - `previewImage`
 * - `previewImages`
 * - `previewImageLeft`
 * - `previewImageCenter`
 * - `previewImageRight`
 * - `fullPreview`
 *
 * Notes:
 * - This is the single source of truth for asset fallback behavior.
 * - Callers should not build project image paths manually.
 */
import { getProjectImageSources } from '@/lib/getProjectImage';

export function getProjectAssets({
  slug,
  theme,
  locale,
}: {
  slug: string;
  theme: 'light' | 'dark';
  locale: 'it' | 'en';
}) {
  // Choose the most generic candidate returned by the helper as the stable resolved preview.
  const previewImage = getProjectImageSources({
    slug,
    type: 'preview',
    theme,
    locale,
  }).at(-1);

  const previewImageLeft = getProjectImageSources({
    slug,
    type: 'mobile-left',
    theme,
    locale,
  }).at(-1);

  const previewImageCenter = getProjectImageSources({
    slug,
    type: 'mobile-center',
    theme,
    locale,
  }).at(-1);

  const previewImageRight = getProjectImageSources({
    slug,
    type: 'mobile-right',
    theme,
    locale,
  }).at(-1);

  // Full preview prefers an explicit full asset, then falls back to center/mobile or preview imagery.
  const resolvedFullPreview =
    getProjectImageSources({
      slug,
      type: 'full',
      theme,
      locale,
    })[0] ?? previewImageCenter ?? previewImage;

  // Guarantee a usable image path even when project-specific assets are incomplete.
  const resolvedPreviewImage =
    previewImage ?? previewImageCenter ?? resolvedFullPreview ?? '/fallback.png';

  const resolvedPreviewImages =
    [previewImageLeft, previewImageCenter, previewImageRight].filter(
      (src): src is string => Boolean(src),
    );

  return {
    previewImage: resolvedPreviewImage,
    previewImages:
      resolvedPreviewImages.length > 0
        ? resolvedPreviewImages
        : [resolvedPreviewImage],
    previewImageLeft,
    previewImageCenter,
    previewImageRight,
    fullPreview: resolvedFullPreview ?? '/fallback.png',
  };
}
