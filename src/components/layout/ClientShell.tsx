'use client';

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

  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
