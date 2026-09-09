'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Film,
  Search,
  Star,
  Folder,
  Users,
  Sparkles,
  BookOpen,
  WifiOff,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useOnboardingStore } from '@/store/onboardingStore';
import { cn } from '@/lib/utils';

interface Slide {
  icon: React.ReactNode;
  title: string;
  body: string;
}

const slides: Slide[] = [
  {
    icon: <Film className="h-7 w-7" />,
    title: 'Welcome to MediaMind',
    body: 'One place to track everything you watch, read, and play - movies, TV, anime, manga, games, and books. Here\'s the tour in under a minute.',
  },
  {
    icon: <Search className="h-7 w-7" />,
    title: 'Add anything',
    body: 'Search across TMDB, MyAnimeList, RAWG, and Google Books at once, and tap a result to add it. Track status and progress from its detail view.',
  },
  {
    icon: <Star className="h-7 w-7" />,
    title: 'Rate & review',
    body: 'Every title has a Review tab - a 5-star rating plus a written note. Visible to friends who can see that title, like a real review.',
  },
  {
    icon: <Folder className="h-7 w-7" />,
    title: 'Collections, manual or AI',
    body: 'Build a collection by hand, or hit Generate AI Collections for groupings by theme or tone. Share one with a friend, or make it public with a link anyone signed in can view.',
  },
  {
    icon: <Users className="h-7 w-7" />,
    title: 'Friends by code',
    body: 'Share your invite code, link, or QR from the Friends page - instant connection, no approval step. See each other\'s libraries and send recommendations.',
  },
  {
    icon: <Sparkles className="h-7 w-7" />,
    title: 'AI, on your terms',
    body: 'Smart collections, tone analysis, burnout detection - all work out of the box during the beta. Add your own free Groq or Gemini key in Settings any time for unlimited use.',
  },
  {
    icon: <BookOpen className="h-7 w-7" />,
    title: 'Two themes',
    body: 'Dark "liquid glass," or a full manga/paper mode - paper white, ink borders, a red accent. Toggle it from the Sidebar or Settings, remembered on this device.',
  },
  {
    icon: <WifiOff className="h-7 w-7" />,
    title: 'Works offline',
    body: 'Your library is cached on your device - it loads instantly and stays usable without a connection, syncing automatically once you\'re back online. That\'s everything - go add your first title.',
  },
];

export function TutorialModal() {
  const { isTutorialOpen, closeTutorial } = useOnboardingStore();
  const [step, setStep] = useState(0);
  const isLast = step === slides.length - 1;

  const handleClose = (open: boolean) => {
    if (!open) {
      closeTutorial();
      // Reset for next time (replaying from Settings should start over).
      setTimeout(() => setStep(0), 300);
    }
  };

  const next = () => (isLast ? handleClose(false) : setStep((s) => s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const slide = slides[step];

  return (
    <Dialog open={isTutorialOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-[var(--mm-bg-alt)] border-[var(--mm-card-border)] rounded-[28px] overflow-hidden">
        <div className="min-h-[260px] flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col items-center text-center pt-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-[var(--mm-primary)]/15 flex items-center justify-center text-[var(--mm-primary)] mb-5">
                {slide.icon}
              </div>
              <h2 className="text-xl font-black text-[var(--mm-text)] tracking-tight mb-2">
                {slide.title}
              </h2>
              <p className="text-sm text-[var(--mm-text-70)] leading-relaxed px-2">{slide.body}</p>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-center gap-1.5 my-6">
            {slides.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === step ? 'w-6 bg-[var(--mm-primary)]' : 'w-1.5 bg-[var(--mm-hover-bg-strong)]'
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 ? (
              <Button
                variant="ghost"
                onClick={back}
                className="text-[var(--mm-text-60)] hover:text-[var(--mm-text)] hover:bg-[var(--mm-hover-bg)] rounded-xl"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => handleClose(false)}
                className="text-[var(--mm-text-40)] hover:text-[var(--mm-text)] hover:bg-[var(--mm-hover-bg)] rounded-xl"
              >
                Skip
              </Button>
            )}
            <Button
              onClick={next}
              className="flex-1 bg-[var(--mm-primary)] hover:bg-[var(--mm-primary-hover)] text-white rounded-xl h-11"
            >
              {isLast ? (
                <>
                  Let&apos;s go
                  <Check className="h-4 w-4 ml-1.5" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
