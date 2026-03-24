'use client';

/**
 * Logo
 *
 * Purpose:
 * Renders the brand logo assets for both theme modes in one shared wrapper.
 *
 * Context:
<<<<<<< Updated upstream
 * Used in shared navigation and footer branding.
 *
 * Dependencies:
 * - Next `Image` for optimized SVG asset rendering
 * - CSS theme classes that swap visibility between light and dark logo variants
 *
 * Notes:
 * - Keep both logo assets mounted so theme changes do not require component re-render logic.
 * - Wrapper sizing is shared across header and footer, so changes affect both areas.
=======
 * Used in shared branding areas such as the header and footer.
 *
 * Notes:
 * Theme-specific visibility is handled with CSS so the same markup works across both modes.
>>>>>>> Stashed changes
 */
import Image from 'next/image';

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
