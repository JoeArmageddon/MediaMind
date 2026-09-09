'use client';

import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Search,
  Users,
  Folder,
  Sparkles,
  Star,
  BookOpen,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Section {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}

const sections: Section[] = [
  {
    icon: <Search className="h-5 w-5" />,
    title: 'Adding titles',
    body: (
      <>
        <p>
          Search finds movies, TV, anime, manga, games, and books across TMDB, MyAnimeList, RAWG,
          and Google Books at once. Tap a result to add it to your library.
        </p>
        <p>
          Search needs its own API key per source (TMDB, RAWG) - add yours for free in{' '}
          <strong>Settings → API Keys</strong>. Nothing is bundled by default, so search won&apos;t
          return results until you do.
        </p>
      </>
    ),
  },
  {
    icon: <Star className="h-5 w-5" />,
    title: 'Tracking progress &amp; reviews',
    body: (
      <>
        <p>
          Open any title to update its status, progress, and completion. The Review tab holds a
          5-star rating and a written note - both are visible to friends who can see that title.
        </p>
      </>
    ),
  },
  {
    icon: <Folder className="h-5 w-5" />,
    title: 'Collections',
    body: (
      <>
        <p>
          Build a collection manually, or hit <strong>Generate AI Collections</strong> for
          suggestions grouped by theme, tone, or genre - each generation avoids repeating groupings
          you already have.
        </p>
        <p>
          Share a collection with a specific friend, or flip <strong>Public collection</strong> in
          its Share dialog to get a link any signed-in MediaMind user can view.
        </p>
      </>
    ),
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: 'Friends',
    body: (
      <>
        <p>
          Share your invite code, link, or QR code from the Friends page - whoever uses it connects
          with you instantly, no separate approval step (same as adding someone by code on Discord
          or Snapchat). Or enter a code someone shared with you.
        </p>
        <p>
          Once connected, you can see each other&apos;s libraries, send recommendations ("For You"
          tab), and share collections.
        </p>
      </>
    ),
  },
  {
    icon: <Sparkles className="h-5 w-5" />,
    title: 'AI features',
    body: (
      <>
        <p>
          Smart collections, tone analysis, burnout detection, and recommendations all run on your
          own Groq or Gemini API key, added in <strong>Settings → API Keys</strong> - both have
          generous free tiers. Nothing is sent anywhere until you add one, and requests go straight
          from your device to that provider - we never see them.
        </p>
      </>
    ),
  },
  {
    icon: <BookOpen className="h-5 w-5" />,
    title: 'Manga mode',
    body: (
      <>
        <p>
          A second full theme - paper white, bold ink borders, a single red accent - toggle it from
          the Sidebar icon or <strong>Settings → Appearance</strong>. Your choice is remembered on
          this device.
        </p>
      </>
    ),
  },
  {
    icon: <WifiOff className="h-5 w-5" />,
    title: 'Works offline',
    body: (
      <>
        <p>
          Your library is cached on your device, so it loads instantly and stays usable without a
          connection - changes made offline sync automatically the next time you&apos;re back online.
        </p>
      </>
    ),
  },
];

export default function HelpPage() {
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4 mb-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="text-[var(--mm-text)] hover:bg-[var(--mm-hover-bg)] rounded-xl"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-black text-[var(--mm-text)] tracking-tighter">
            HOW IT WORKS
          </h1>
          <p className="text-sm text-[var(--mm-text-50)] font-mono">使い方</p>
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((section) => (
          <div key={section.title} className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--mm-primary)]/15 flex items-center justify-center text-[var(--mm-primary)] shrink-0">
                {section.icon}
              </div>
              <h2 className="text-base font-bold text-[var(--mm-text)]">{section.title}</h2>
            </div>
            <div className="text-sm text-[var(--mm-text-70)] leading-relaxed space-y-2 pl-12">
              {section.body}
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-2xl p-5 text-center">
        <p className="text-sm text-[var(--mm-text-60)]">
          Something not covered here, or found a bug? Email{' '}
          <a
            href="mailto:takiar.kshitij@gmail.com"
            className="text-[var(--mm-primary)] hover:opacity-80"
          >
            takiar.kshitij@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}
