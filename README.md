# MediaMind - Personal Media Intelligence

A production-ready, AI-powered, cloud-synced media tracking PWA with cinematic dark UI and subtle Japanese manga design accents.

## Features

### Core Features
- **Universal Media Tracking**: Movies, TV, Anime, Manga, Manhwa, Games, Books, Light Novels, Visual Novels, Web Series
- **AI-Powered Recommendations**: Similar suggestions, burnout detection, smart collections
- **Advanced Search**: Single search, batch import, auto-detection across multiple APIs
- **Progress Tracking**: Episode, chapter, page, or percentage-based tracking per media type
- **Analytics Dashboard**: Completion rates, genre distribution, time invested, monthly activity
- **Calendar View**: Track completion streaks
- **Timeline**: Activity feed with history

### Technical Features
- **Offline-First**: IndexedDB mirror with Dexie.js, works offline except AI features
- **Cloud Sync**: Supabase Postgres with real-time subscriptions
- **PWA**: Installable app with service worker, works offline
- **Dark Mode Only**: Premium cinematic aesthetic
- **Responsive**: Mobile-first design with glassmorphism UI

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **UI Components**: shadcn/ui pattern
- **Animations**: Framer Motion
- **State**: Zustand
- **Database**: Supabase (Postgres + Auth)
- **Offline Cache**: Dexie.js (IndexedDB)
- **PWA**: next-pwa
- **Charts**: Recharts

### APIs
- TMDB (Movies & TV)
- Jikan (Anime & Manga)
- RAWG (Games)
- Google Books (Books)
- JustWatch (Streaming availability - India)
- Gemini (Primary AI)
- Groq (Fallback AI)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository>
cd media-intelligence
npm install
```

### 2. Environment Variables

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI APIs
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key

# Media APIs
NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key
NEXT_PUBLIC_RAWG_API_KEY=your_rawg_api_key
NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY=your_google_books_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database Setup

Run the SQL schema in `supabase/schema.sql` in your Supabase SQL editor.

### 4. Run Development

```bash
npm run dev
```

### 5. Build for Production

```bash
npm run build
```

## Deployment (Vercel)

1. Push to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy

## API Keys Required

| Service | Key | Free Tier |
|---------|-----|-----------|
| Supabase | Required | 500MB database |
| TMDB | Required | Unlimited |
| RAWG | Required | 20K requests/month |
| Google Books | Optional | 1K requests/day |
| Gemini | Required | 60 requests/min |
| Groq | Optional | 20 requests/min |

## Project Structure

```
src/
├── app/              # Next.js App Router pages
├── components/       # React components
│   ├── ui/          # shadcn/ui components
│   ├── media/       # Media-specific components
│   └── layout/      # Layout components
├── lib/             # Utilities and API clients
│   ├── api/         # External API clients
│   ├── ai/          # AI clients (Gemini, Groq)
│   ├── db/          # Database (Supabase, Dexie)
│   └── utils.ts     # Helper functions
├── store/           # Zustand stores
├── types/           # TypeScript types
└── hooks/           # Custom React hooks
```

## Design System

- **Background**: `#0B0B0F` (base), `#111118` / `#15151D` (elevated)
- **Accent**: `#7C5CFF` (electric violet)
- **Glass**: Backdrop blur 12-18px, subtle 1px border glow
- **Typography**: Clean hierarchy, bold condensed headers
- **Micro-style**: Subtle manga panel dividers, faint halftone textures

## License

MIT
