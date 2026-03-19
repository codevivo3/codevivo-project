'use client';

import { useEffect, type ReactNode } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

/**
 * ClientShell
 *
 * Purpose:
 * Wraps page content with the shared header and footer and updates global pattern offset.
 *
 * Behavior:
 * - Large screens: keeps shared chrome mounted while scroll updates the background offset
 * - Medium screens: preserves the same shell structure and effect
 * - Mobile: content stays visible on first render; the scroll effect is progressive only
 *
 * Notes:
 * - This component does not own section animation timing
 * - The background offset effect is cosmetic and should not gate visibility
 */

export default function ClientShell({ children }: { children: ReactNode }) {
  // Effects
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
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
