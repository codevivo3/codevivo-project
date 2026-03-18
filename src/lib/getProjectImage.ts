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
