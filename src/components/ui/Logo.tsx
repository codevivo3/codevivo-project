'use client';

import Image from 'next/image';

/**
 * Logo
 *
 * Purpose:
 * Renders the light and dark brand logo assets in a shared responsive wrapper.
 *
 * Behavior:
 * - Large screens: scales the logo container responsively
 * - Medium screens: keeps the same dual-image setup with responsive sizing
 * - Mobile: remains visible on first render with no hidden animation state
 *
 * Notes:
 * - This component does not manage motion timing
 * - Theme-specific visibility is handled through CSS classes on the images
 */

type LogoProps = {
  className?: string;
  priority?: boolean;
};

export default function Logo({ className = '', priority = false }: LogoProps) {
  // Render
  return (
    <div className={`relative h-auto w-24 sm:w-32 md:w-36 lg:w-40 ${className}`}>
      <Image
        src='/logos/codevivo/codevivo-col-logo-white-text.svg'
        alt='Codevivo logo'
        width={160}
        height={40}
        className='logo-white transition-transform duration-500 ease-out hover:scale-105'
        priority={priority}
      />
      <Image
        src='/logos/codevivo/codevivo-col-logo-black-text.svg'
        alt='Codevivo logo'
        width={160}
        height={40}
        className='logo-black transition-transform duration-500 ease-out hover:scale-105'
        priority={priority}
      />
    </div>
  );
}
