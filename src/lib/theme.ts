export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_EVENT = 'theme-change';

type ThemeDetail = {
  mode: ThemeMode;
  theme: ResolvedTheme;
};

let currentMode: ThemeMode = 'system';
let currentTheme: ResolvedTheme = 'dark';
let initialized = false;

export function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? getSystemTheme() : mode;
}

export function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;

  if (resolved === 'light') {
    root.classList.add('light');
  } else {
    root.classList.remove('light');
  }
}

function dispatchThemeChange() {
  window.dispatchEvent(
    new CustomEvent<ThemeDetail>(THEME_EVENT, {
      detail: {
        mode: currentMode,
        theme: currentTheme,
      },
    }),
  );
}

function syncTheme(resolved: ResolvedTheme) {
  currentTheme = resolved;
  applyTheme(resolved);
  dispatchThemeChange();
}

function handleSystemThemeChange() {
  if (currentMode !== 'system') {
    return;
  }

  syncTheme(getSystemTheme());
}

export function initializeTheme() {
  if (typeof window === 'undefined') {
    return;
  }

  if (initialized) {
    return;
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  currentTheme = document.documentElement.classList.contains('light')
    ? 'light'
    : 'dark';

  mediaQuery.addEventListener('change', handleSystemThemeChange);
  initialized = true;
}

export function getThemeState(): ThemeDetail {
  if (typeof window === 'undefined') {
    return {
      mode: 'system',
      theme: 'dark',
    };
  }

  initializeTheme();

  return {
    mode: currentMode,
    theme: currentTheme,
  };
}

export function setThemeMode(nextMode: ThemeMode) {
  initializeTheme();

  currentMode = nextMode;
  syncTheme(resolveTheme(nextMode));
}
