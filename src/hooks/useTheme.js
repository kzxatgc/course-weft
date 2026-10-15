import { useState, useEffect } from 'react';
import { THEMES, DEFAULT_THEME_ID } from '../theme/themes.js';

const STORAGE_KEY = 'enrollfix-theme';

/** Write five CSS custom properties onto :root from a theme object. */
function applyTheme(theme) {
  const root = document.documentElement;
  root.style.setProperty('--color-yellow', theme.yellow);
  root.style.setProperty('--color-navy', theme.navy);
  root.style.setProperty('--color-blue', theme.blue);
  root.style.setProperty('--color-cream', theme.cream);
  root.style.setProperty('--color-charcoal', theme.charcoal);
}

/**
 * Manages the active neo-brutalist color theme.
 * Persists the selection to localStorage and applies CSS variables on mount/change.
 */
export function useTheme() {
  const [themeId, setThemeId] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return THEMES.some((t) => t.id === saved) ? saved : DEFAULT_THEME_ID;
    } catch {
      return DEFAULT_THEME_ID;
    }
  });

  const currentTheme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  useEffect(() => {
    applyTheme(currentTheme);
    try {
      localStorage.setItem(STORAGE_KEY, themeId);
    } catch {
      /* storage unavailable — continue without persistence */
    }
  }, [themeId, currentTheme]);

  /** Select a new theme by ID. Ignored if ID is not in the catalogue. */
  function selectTheme(id) {
    if (THEMES.some((t) => t.id === id)) setThemeId(id);
  }

  return { themeId, selectTheme, currentTheme, themes: THEMES };
}
