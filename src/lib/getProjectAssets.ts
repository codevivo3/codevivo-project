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

  const resolvedFullPreview =
    getProjectImageSources({
      slug,
      type: 'full',
      theme,
      locale,
    })[0] ?? previewImageCenter ?? previewImage;

  const resolvedPreviewImage =
    previewImage ?? previewImageCenter ?? resolvedFullPreview ?? '/fallback.png';

  return {
    previewImage: resolvedPreviewImage,
    previewImageLeft,
    previewImageCenter,
    previewImageRight,
    fullPreview: resolvedFullPreview ?? '/fallback.png',
  };
}
