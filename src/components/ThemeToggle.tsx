'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  // useState stores UI state between renders.
  const [isLight, setIsLight] = useState(() => {
    if (typeof window === 'undefined') return false;
    const storedTheme = localStorage.getItem('theme');
    return storedTheme === 'light';
  });

  useEffect(() => {
    if (isLight) {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [isLight]);

  const handleToggle = () => {
    setIsLight((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('light', next);
      localStorage.setItem('theme', next ? 'light' : 'dark');
      return next;
    });
  };

  return (
    <button
      type="button"
      className="rounded-md border border-border px-2 py-1 text-sm font-mono-var"
      onClick={handleToggle}
    >
      {isLight ? '💡 ON' : '💡 OFF'}
    </button>
  );
}
