'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/store/themeStore';

// Applies the persisted theme choice as a data-theme attribute on <html> -
// globals.css's `:root[data-theme="manga"]` block does the actual
// re-theming via CSS variables. A separate effect-driven sync (rather than
// setting the attribute at render time) because zustand's persist
// middleware only rehydrates from localStorage after mount, so the very
// first paint is always the 'dark' default regardless of a saved
// preference - same one-frame-of-default-theme tradeoff every
// client-persisted theme toggle has without a blocking inline script.
export function ThemeSync() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return null;
}
