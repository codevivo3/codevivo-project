'use client';

import { useRef, useEffect, useState } from 'react';
import Image from 'next/image';

export default function HeroLogo3D() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const shineRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const shine = shineRef.current;
    if (!wrapper || !shine) return;

    const handleMove = (e: MouseEvent) => {
      const rect = wrapper.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      shine.style.background = `
        radial-gradient(
          circle at ${x}% ${y}%,
          rgba(255,255,255,0.95),
          rgba(255,255,255,0.45) 50%,
          rgba(255,255,255,0.15) 75%,
          transparent 100%
        )
      `;
    };

    wrapper.addEventListener('mousemove', handleMove);

    return () => {
      wrapper.removeEventListener('mousemove', handleMove);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex items-center justify-center overflow-hidden"
      style={{
        transition: 'opacity 300ms ease',
      }}
    >
      <Image
        src="/logos/codevivo-icon-color.svg"
        alt="CodeVivo Logo"
        width={400}
        height={400}
        priority
        className="h-40 w-40 sm:h-48 sm:w-48 md:h-60 md:w-60 lg:h-72 lg:w-72"
      />

      {/* Shine overlay */}
      <div
        ref={shineRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          mixBlendMode: 'overlay',
          opacity: hovered ? 1 : 0,
          filter: 'brightness(1.2)',
          transition: 'opacity 300ms ease',
          WebkitMaskImage: "url('/logos/codevivo-icon-color.svg')",
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskSize: 'contain',
          WebkitMaskPosition: 'center',
          maskImage: "url('/logos/codevivo-icon-color.svg')",
          maskRepeat: 'no-repeat',
          maskSize: 'contain',
          maskPosition: 'center',
        }}
      />
    </div>
  );
}
