/**
 * TechIcon
 *
 * Reusable UI component used to render technology stack icons.
 * Icons are defined in src/data/techStack.ts and rendered here
 * using CSS mask-image so their color adapts automatically
 * to the current theme (light/dark).
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

  return (
    <span
      role='img'
      aria-label={tech.label}
      className={`${sizeClassName[size]} inline-block shrink-0 bg-[var(--color-fg)]`}
      style={maskStyle}
    />
  );
}
