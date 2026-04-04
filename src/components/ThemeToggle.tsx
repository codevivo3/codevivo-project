'use client';

/**
 * ThemeToggle
 *
 * Purpose:
 * Cycles between system, light, and dark theme modes through the shared theme store.
 *
 * Context:
 * Used in the shared header as the global theme control.
 *
 * Dependencies:
 * - shared `useTheme` hook for global mode and resolved-theme sync
 *
 * Notes:
 * - Keep the hydration placeholder so the header layout stays stable before mount.
 * - Dark remains the default base theme; light is enabled only through the root `light` class.
 */
import { useState, useEffect } from 'react';
import {
  DesktopIcon,
  LightbulbFilamentIcon,
  LightbulbIcon,
} from '@phosphor-icons/react';
import { useTheme } from '@/hooks/useTheme';
import { type ThemeMode } from '@/lib/theme';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { mode, setThemeMode } = useTheme();

  useEffect(() => {
    requestAnimationFrame(() => {
      setMounted(true);
    });
  }, []);

  const nextModeByCurrent: Record<ThemeMode, ThemeMode> = {
    system: 'light',
    light: 'dark',
    dark: 'system',
  };

  const handleToggle = () => {
    setThemeMode(nextModeByCurrent[mode]);
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

  const SystemIcon = (
    <DesktopIcon
      size={18}
      className='text-fg/80 transition-colors'
      weight='duotone'
    />
  );

  const labelsByMode: Record<ThemeMode, string> = {
    system: 'Theme: system',
    light: 'Theme: light',
    dark: 'Theme: dark',
  };

  const nextLabelsByMode: Record<ThemeMode, string> = {
    system: 'Switch to light mode',
    light: 'Switch to dark mode',
    dark: 'Switch to system mode',
  };

  const iconByMode: Record<ThemeMode, ReturnType<typeof LightbulbIcon>> = {
    system: SystemIcon,
    light: LightIcon,
    dark: DarkIcon,
  };

  if (!mounted) {
    return (
      <button
        type='button'
        className='surface-card flex h-10 w-10 md:h-8 md:w-8 items-center justify-center rounded-lg bg-surface/60 text-sm font-mono backdrop-blur-md'
        aria-label='Theme toggle'
        title='Theme toggle'
      />
    );
  }

  return (
    <button
      type='button'
      className='surface-card flex h-10 w-10 md:h-8 md:w-8 cursor-pointer items-center justify-center rounded-lg bg-surface/60 text-sm font-mono backdrop-blur-md'
      onClick={handleToggle}
      aria-label={nextLabelsByMode[mode]}
      title={`${labelsByMode[mode]}. ${nextLabelsByMode[mode]}`}
    >
      {iconByMode[mode]}
    </button>
  );
}
