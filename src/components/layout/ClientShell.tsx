'use client';

/**
 * ClientShell
 *
 * Purpose:
 * Wraps page content with shared chrome and manages a cosmetic scroll-based background offset.
 *
 * Context:
 * Mounted inside the locale layout so every localized route shares the same header and footer.
 *
 * Dependencies:
 * - shared `Header` and `Footer`
 * - CSS custom property `--pattern-offset` used by global background styling
 *
 * Notes:
 * - The scroll effect is purely decorative and must never gate content visibility.
 * - Keep requestAnimationFrame throttling here to avoid high-frequency style writes on scroll.
 */
import { useEffect, type ReactNode } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function ClientShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    let raf = 0;

    const updatePatternOffset = () => {
      const offset = window.scrollY * -0.12;

      document.documentElement.style.setProperty(
        '--pattern-offset',
        `${offset}px`
      );

      raf = 0;
    };

    // Batch CSS variable writes so scroll handling stays cheap.
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(updatePatternOffset);
    };

    updatePatternOffset();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  // Render
  return (
    <div className='w-full max-w-full overflow-x-hidden'>
      <Header />
      {children}
      <Footer />
    </div>
  );
}
