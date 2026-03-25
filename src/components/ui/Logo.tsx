'use client';

/**
 * Logo
 *
 * Purpose:
 * Renders the brand logo assets for both theme modes in one shared wrapper.
 *
 * Context:
 * Used in shared navigation and footer branding.
 *
 * Dependencies:
 * - Next `Image` for optimized SVG asset rendering
 * - CSS theme classes that swap visibility between light and dark logo variants
 *
 * Notes:
 * - Keep both logo assets mounted so theme changes do not require component re-render logic.
 * - Wrapper sizing is shared across header and footer, so changes affect both areas.
 */
import Image from 'next/image';

type LogoProps = {
  className?: string;
  priority?: boolean;
};

export default function Logo({ className = '', priority = false }: LogoProps) {
  // Render
  return (
    <div className={`relative h-6 sm:h-7 md:h-8 lg:h-9 ${className}`}>
      <Image
        src='/logos/codevivo/codevivo-col-logo-white-text.svg'
        alt='Codevivo logo'
        width={160}
        height={40}
        className='logo-white h-full w-auto transition-transform duration-500 ease-out hover:scale-105'
        priority={priority}
      />
      <Image
        src='/logos/codevivo/codevivo-col-logo-black-text.svg'
        alt='Codevivo logo'
        width={160}
        height={40}
        className='logo-black h-full w-auto transition-transform duration-500 ease-out hover:scale-105'
        priority={priority}
      />
    </div>
  );
}
