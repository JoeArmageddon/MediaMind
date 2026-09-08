// Two full palettes, not just color swaps - "manga mode" is meant to
// actually look like a manga page (paper white, bold black ink borders,
// a single bold accent), not just a lighter version of the dark theme.
// isManga/borderWidth let screens make small structural choices (e.g.
// skip the frosted-glass blur in manga mode, since flat ink linework is
// the point there) without every screen needing its own mode check.
export interface ThemePalette {
  mode: 'dark' | 'manga';
  isManga: boolean;
  bg: string;
  bgAlt: string;
  card: string;
  cardBorder: string;
  input: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryText: string;
  accent: string;
  danger: string;
  success: string;
  borderWidth: number;
  gradientA: string;
  gradientB: string;
}

export const darkTheme: ThemePalette = {
  mode: 'dark',
  isManga: false,
  bg: '#050505',
  bgAlt: '#0B0B0F',
  card: 'rgba(255,255,255,0.06)',
  cardBorder: 'rgba(255,255,255,0.12)',
  input: '#0B0B0F',
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.55)',
  textFaint: 'rgba(255,255,255,0.32)',
  primary: '#7C5CFF',
  primaryText: '#ffffff',
  accent: '#e879f9',
  danger: '#ef4444',
  success: '#22c55e',
  borderWidth: 1,
  gradientA: '#7C5CFF',
  gradientB: '#e879f9',
};

// Paper-white background, near-black ink text/borders, a single bold red
// accent (the one color a lot of shonen manga covers allow themselves) -
// deliberately restrained rather than colorful, since that's what makes
// it read as "manga" instead of just "light mode".
export const mangaTheme: ThemePalette = {
  mode: 'manga',
  isManga: true,
  bg: '#F2EFE4',
  bgAlt: '#FFFFFF',
  card: '#FFFDF7',
  cardBorder: '#161311',
  input: '#FFFFFF',
  text: '#161311',
  textMuted: 'rgba(22,19,17,0.62)',
  textFaint: 'rgba(22,19,17,0.38)',
  primary: '#D91E36',
  primaryText: '#FFFDF7',
  accent: '#161311',
  danger: '#B00020',
  success: '#1B7A3D',
  borderWidth: 2,
  gradientA: '#D91E36',
  gradientB: '#161311',
};
