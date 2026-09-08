import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, mangaTheme, type ThemePalette } from './theme';

const STORAGE_KEY = 'mediamind:theme-mode';
type Mode = 'dark' | 'manga';

interface ThemeContextValue {
  theme: ThemePalette;
  mode: Mode;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>('dark');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'manga' || stored === 'dark') setModeState(stored);
      })
      .catch(() => {});
  }, []);

  const setMode = (next: Mode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch((e) =>
      console.warn('Failed to persist theme mode:', e)
    );
  };

  const toggleMode = () => setMode(mode === 'dark' ? 'manga' : 'dark');

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: mode === 'manga' ? mangaTheme : darkTheme, mode, setMode, toggleMode }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
