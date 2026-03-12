'use client';

import { useState, useEffect } from 'react';

import { LightbulbIcon, LightbulbFilamentIcon } from '@phosphor-icons/react';

export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);
  const [mounted, setMounted] = useState(false);

useEffect(() => {
  const root = document.documentElement;

  requestAnimationFrame(() => {
    setMounted(true);
    setIsLight(root.classList.contains('light'));
  });
}, []);

  const handleToggle = () => {
    const root = document.documentElement;
    const next = !root.classList.contains('light');

    root.classList.toggle('light', next);
    localStorage.setItem('theme', next ? 'light' : 'dark');

    setIsLight(next);
  };

  const DarkIcon = (
    <LightbulbIcon
      size={18}
      className='text-accent transition-colors'
      weight='fill'
    />
  );

  const LightIcon = (
    <LightbulbFilamentIcon
      size={18}
      className='text-primary transition-colors'
      weight='duotone'
    />
  );

  if (!mounted) {
    return (
      <button
        type='button'
        className='h-8 w-8 rounded-md surface-card flex items-center justify-center text-sm font-mono'
        aria-label='Toggle theme'
        title='Toggle theme'
      />
    );
  }

  return (
    <button
      type='button'
      className='h-8 w-8 rounded-md surface-card flex items-center justify-center text-sm font-mono cursor-pointer'
      onClick={handleToggle}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {isLight ? LightIcon : DarkIcon}
    </button>
  );
}
