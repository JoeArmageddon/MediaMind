import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AppTheme = 'dark' | 'manga';

interface ThemeStore {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

// Two full palettes, not a light/dark tint of the same one - "manga mode"
// is meant to actually look like a manga page (paper white, bold ink
// borders, a single restrained accent), matching the native app's
// lib/theme.ts. Web can't reuse that file directly (RN StyleSheet objects
// vs CSS custom properties), so the palette is re-declared as CSS
// variables in globals.css under `:root[data-theme="manga"]` - this store
// just owns which one is active and persists the choice, then
// ThemeSync.tsx applies it as a `data-theme` attribute on <html>.
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'manga' : 'dark' }),
    }),
    {
      name: 'mediamind-theme',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
