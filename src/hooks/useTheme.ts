'use client';

import { useEffect, useState } from 'react';
import {
  getThemeState,
  initializeTheme,
  setThemeMode,
  THEME_EVENT,
} from '@/lib/theme';

export function useTheme() {
  const [state, setState] = useState(getThemeState);

  useEffect(() => {
    initializeTheme();

    const syncTheme = () => {
      setState(getThemeState());
    };

    syncTheme();
    window.addEventListener(THEME_EVENT, syncTheme);

    return () => {
      window.removeEventListener(THEME_EVENT, syncTheme);
    };
  }, []);

  return {
    mode: state.mode,
    theme: state.theme,
    setThemeMode,
  };
}
