'use client';

import { useEffect } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAIStore } from '@/store/aiStore';
import { getAIClient } from '@/lib/ai';
import type { Media } from '@/types';

interface AISuggestionsDialogProps {
  media: Media | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Shows AI-generated "similar titles" for a media item, fetched on open and cached in aiStore. */
export function AISuggestionsDialog({ media, open, onOpenChange }: AISuggestionsDialogProps) {
  const { suggestionCache, isLoadingSuggestions, error, setSuggestions, setLoading, setError } = useAIStore();

  const key = media?.id ?? null;
  const cached = key ? suggestionCache.get(key) : undefined;

  useEffect(() => {
    if (!open || !media || !key) return;
    if (suggestionCache.has(key)) return; // already cached - avoid a duplicate API call

    let cancelled = false;
    setLoading('suggestions', true);
    setError(null);

    getAIClient()
      .getSuggestions({
        title: media.title,
        type: media.type,
        genres: media.genres,
        description: media.description,
        release_year: media.release_year,
      })
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setSuggestions(key, result);
        } else {
          setError('AI suggestions are unavailable right now - check that a Groq or Gemini API key is set in Settings.');
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to get suggestions.');
      })
      .finally(() => {
        if (!cancelled) setLoading('suggestions', false);
      });

    return () => {
      cancelled = true;
    };
    // Deliberately keyed only on open/media id - re-running for every change
    // to the store setters (stable refs) or media object identity would
    // re-fetch unnecessarily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#0a0a0a] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            Similar to {media?.title}
          </DialogTitle>
          <DialogDescription>AI-generated suggestions based on this title.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {isLoadingSuggestions && (
            <div className="flex items-center justify-center py-8 text-white/50 text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Thinking...
            </div>
          )}

          {!isLoadingSuggestions && error && (
            <div className="text-sm text-red-400 py-4 text-center">{error}</div>
          )}

          {!isLoadingSuggestions && !error && cached?.length === 0 && (
            <div className="text-sm text-white/40 py-4 text-center">No suggestions found.</div>
          )}

          {!isLoadingSuggestions &&
            !error &&
            cached?.map((s, i) => (
              <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="font-bold text-white text-sm">{s.title}</div>
                <p className="text-xs text-white/60 mt-1">{s.reason}</p>
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
