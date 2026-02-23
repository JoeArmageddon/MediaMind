import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#050505',
        foreground: '#ffffff',
        card: {
          DEFAULT: '#0a0a0a',
          foreground: '#ffffff',
        },
        popover: {
          DEFAULT: '#111111',
          foreground: '#ffffff',
        },
        primary: {
          DEFAULT: '#6366f1',
          foreground: '#ffffff',
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        secondary: {
          DEFAULT: '#1a1a1a',
          foreground: '#a1a1aa',
        },
        muted: {
          DEFAULT: '#171717',
          foreground: '#737373',
        },
        accent: {
          DEFAULT: '#6366f1',
          foreground: '#ffffff',
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff',
        },
        border: 'rgba(255, 255, 255, 0.1)',
        input: 'rgba(255, 255, 255, 0.1)',
        ring: '#6366f1',
      },
      borderRadius: {
        lg: '16px',
        md: '12px',
        sm: '8px',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
