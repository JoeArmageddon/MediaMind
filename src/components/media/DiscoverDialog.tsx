'use client';

import { useState } from 'react';
import { Shuffle, Sparkles, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAIClient } from '@/lib/ai';
import { useAIStore } from '@/store/aiStore';
import type { Media } from '@/types';

interface DiscoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: Media[];
  onPickMedia: (media: Media) => void;
}

/** "What should I watch/read next?" - combines the old dead random-picker with a real AI recommendations flow (previously implemented but never wired to any UI). */
export function DiscoverDialog({ open, onOpenChange, media, onPickMedia }: DiscoverDialogProps) {
  const [mood, setMood] = useState('');
  const [minutes, setMinutes] = useState('');
  const { recommendationCache, isLoadingRecommendations, error, setRecommendations, setLoading, setError } = useAIStore();

  const planned = media.filter((m) => m.status === 'planned');

  const pickRandom = () => {
    if (planned.length === 0) return;
    const random = planned[Math.floor(Math.random() * planned.length)];
    onPickMedia(random);
    onOpenChange(false);
  };

  const fetchRecommendations = async () => {
    setLoading('recommendations', true);
    setError(null);
    try {
      const currentWatching = media.filter((m) => m.status === 'watching');
      const recentlyCompleted = media
        .filter((m) => m.status === 'completed' && m.completed_at)
        .sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1))
        .slice(0, 10);

      const genreCounts = new Map<string, number>();
      for (const m of media) {
        for (const g of m.genres) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
      }
      const topGenres = Array.from(genreCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([g]) => g);

      const result = await getAIClient().getRecommendations(
        currentWatching,
        planned,
        recentlyCompleted,
        topGenres,
        mood.trim() || undefined,
        minutes ? Number(minutes) : undefined
      );

      if (result) {
        setRecommendations(result);
      } else {
        setError('AI recommendations are unavailable right now - check that a Groq or Gemini API key is set in Settings.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get recommendations.');
    } finally {
      setLoading('recommendations', false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[var(--mm-card-bg)] border-[var(--mm-card-border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--mm-text)]">Discover</DialogTitle>
          <DialogDescription>Find something to watch, read, or play next.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="random" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-[var(--mm-hover-bg)] p-1 rounded-xl h-auto">
            <TabsTrigger
              value="random"
              className="rounded-lg py-2 data-[state=active]:bg-[var(--mm-hover-bg-strong)] data-[state=active]:text-[var(--mm-text)] text-[var(--mm-text-60)]"
            >
              <Shuffle className="h-4 w-4 mr-2" />
              Random
            </TabsTrigger>
            <TabsTrigger
              value="ai"
              className="rounded-lg py-2 data-[state=active]:bg-[var(--mm-hover-bg-strong)] data-[state=active]:text-[var(--mm-text)] text-[var(--mm-text-60)]"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              AI Pick
            </TabsTrigger>
          </TabsList>

          <TabsContent value="random" className="space-y-4 pt-4">
            <div className="p-4 rounded-xl glass-card">
              <p className="text-sm text-indigo-400">{planned.length} items available in your Planned list</p>
            </div>
            <Button
              onClick={pickRandom}
              disabled={planned.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
            >
              <Shuffle className="mr-2 h-4 w-4" />
              Pick Random
            </Button>
          </TabsContent>

          <TabsContent value="ai" className="space-y-3 pt-4">
            <Input
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder="Mood (optional, e.g. 'something light')"
              className="bg-[var(--mm-input-bg)] border-[var(--mm-card-border)] rounded-xl"
            />
            <Input
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="Minutes available (optional)"
              className="bg-[var(--mm-input-bg)] border-[var(--mm-card-border)] rounded-xl"
            />
            <Button
              onClick={fetchRecommendations}
              disabled={isLoadingRecommendations}
              className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl"
            >
              {isLoadingRecommendations ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Get Recommendations
            </Button>

            {error && <p className="text-xs text-red-400 text-center">{error}</p>}

            {!isLoadingRecommendations && recommendationCache && recommendationCache.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {recommendationCache.map((rec, i) => (
                  <div key={i} className="p-3 rounded-lg bg-[var(--mm-hover-bg)] border border-[var(--mm-card-border)]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[var(--mm-text)] text-sm">{rec.title}</span>
                      <span className="text-[10px] text-fuchsia-400 font-mono flex-shrink-0">
                        {Math.round(rec.fit_score)}% fit
                      </span>
                    </div>
                    <p className="text-xs text-[var(--mm-text-60)] mt-1">{rec.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
