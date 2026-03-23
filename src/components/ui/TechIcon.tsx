/**
 * TechIcon
 *
 * Purpose:
 * Renders a technology icon from the shared tech stack registry.
 *
 * Context:
 * Used across tech stack displays and project metadata badges.
 *
 * Dependencies:
 * - `techStack` metadata in `src/data/techStack.ts`
 * - CSS mask support so the icon color can follow current theme tokens
 *
 * Notes:
 * - Keep icons metadata-driven so labels and assets stay centralized.
 * - CSS masks let the icon inherit foreground color without maintaining multiple SVG fills.
 */

import type { CSSProperties } from 'react';

import { techStack, type TechId } from '@/data/techStack';

type TechIconProps = {
  id: TechId;
  size?: 'sm' | 'md';
};

const sizeClassName: Record<NonNullable<TechIconProps['size']>, string> = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
};

export default function TechIcon({ id, size = 'md' }: TechIconProps) {
  const tech = techStack[id];

  if (!tech) return null;

  // Render SVGs as masks so the visible color comes from CSS instead of the source file.
  const maskStyle = {
    WebkitMaskImage: `url(${tech.icon})`,
    maskImage: `url(${tech.icon})`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
  } satisfies CSSProperties;

  // Render
  return (
    <span
      role='img'
      aria-label={tech.label}
      className={`${sizeClassName[size]} inline-block shrink-0 bg-[var(--color-fg)]`}
      style={maskStyle}
    />
  );
}
