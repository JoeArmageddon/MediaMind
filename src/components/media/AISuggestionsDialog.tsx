'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Sparkles, Loader2, ChevronDown, ChevronUp, Plus, Check, SearchX } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAIStore } from '@/store/aiStore';
import { useMediaStore } from '@/store/mediaStore';
import { getAIClient } from '@/lib/ai';
import { getSearchOrchestrator } from '@/lib/api/search';
import { mapExternalIds } from '@/lib/api/externalId';
import type { Media, SearchResult } from '@/types';

interface AISuggestionsDialogProps {
  media: Media | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Per-suggestion "look this up for real" state - getSuggestions() only
// ever returns a bare title/reason/similarity_score (it's model-generated
// text, not a catalog lookup), so there's nothing to add to the library
// until a real match is found via the same multi-source search the
// Search page uses. Keyed by the suggestion's index in the current
// suggestion list (stable for the life of one cache entry).
type LookupState = {
  status: 'idle' | 'loading' | 'found' | 'not_found' | 'error';
  result?: SearchResult;
  added?: boolean;
};

/** Shows AI-generated "similar titles" for a media item, fetched on open and cached in aiStore. */
export function AISuggestionsDialog({ media, open, onOpenChange }: AISuggestionsDialogProps) {
  const { suggestionCache, isLoadingSuggestions, error, setSuggestions, setLoading, setError } = useAIStore();
  const { media: myMedia, addMedia } = useMediaStore();
  const [lookups, setLookups] = useState<Record<number, LookupState>>({});

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

  // Reset per-item lookup state whenever the underlying suggestion list
  // changes (a different title opened, or a fresh cache entry) - stale
  // "found"/"added" state from a previous title's suggestion #2 must never
  // leak onto this title's suggestion #2.
  useEffect(() => {
    setLookups({});
  }, [key]);

  const alreadyInLibrary = (title: string) =>
    myMedia.some((m) => m.type === media?.type && m.title.trim().toLowerCase() === title.trim().toLowerCase());

  const handleExpand = async (index: number, title: string) => {
    const current = lookups[index];
    if (current?.status === 'loading') return;
    if (current?.status === 'found' || current?.status === 'not_found' || current?.status === 'error') {
      // Already looked up once - toggle back to idle (collapse) rather than
      // re-searching on every re-open.
      setLookups((prev) => ({ ...prev, [index]: { status: 'idle' } }));
      return;
    }

    setLookups((prev) => ({ ...prev, [index]: { status: 'loading' } }));
    try {
      const results = await getSearchOrchestrator().search(title, media?.type);
      const best = results[0];
      setLookups((prev) => ({
        ...prev,
        [index]: best ? { status: 'found', result: best } : { status: 'not_found' },
      }));
    } catch (e) {
      console.error('Suggestion lookup failed:', e);
      setLookups((prev) => ({ ...prev, [index]: { status: 'error' } }));
    }
  };

  const handleAdd = async (index: number, result: SearchResult) => {
    try {
      const externalIds = mapExternalIds(result);
      await addMedia({
        title: result.title,
        normalized_title: result.title.toLowerCase().replace(/[^a-z0-9]/g, ''),
        type: result.type,
        poster_url: result.poster_url,
        backdrop_url: null,
        description: result.description,
        release_year: result.release_year,
        api_rating: result.api_rating,
        genres: result.genres,
        tags: [],
        studios: [],
        total_units: result.total_units || 0,
        progress: 0,
        completion_percent: 0,
        status: 'planned',
        is_favorite: false,
        is_archived: false,
        notes: null,
        user_rating: null,
        streaming_platforms: [],
        ai_primary_tone: null,
        ai_secondary_tone: null,
        ai_core_themes: [],
        ai_emotional_intensity: null,
        ai_pacing: null,
        ai_darkness_level: null,
        ai_intellectual_depth: null,
        ...externalIds,
        completed_at: null,
      });
      setLookups((prev) => ({ ...prev, [index]: { ...prev[index], added: true } }));
    } catch (e) {
      console.error('Failed to add suggestion to library:', e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[var(--mm-card-bg)] border-[var(--mm-card-border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--mm-text)] flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            Similar to {media?.title}
          </DialogTitle>
          <DialogDescription>AI-generated suggestions based on this title.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {isLoadingSuggestions && (
            <div className="flex items-center justify-center py-8 text-[var(--mm-text-50)] text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Thinking...
            </div>
          )}

          {!isLoadingSuggestions && error && (
            <div className="text-sm text-red-400 py-4 text-center">{error}</div>
          )}

          {!isLoadingSuggestions && !error && cached?.length === 0 && (
            <div className="text-sm text-[var(--mm-text-40)] py-4 text-center">No suggestions found.</div>
          )}

          {!isLoadingSuggestions &&
            !error &&
            cached?.map((s, i) => {
              const lookup = lookups[i] ?? { status: 'idle' };
              const inLibrary = alreadyInLibrary(s.title);
              return (
                <div key={i} className="rounded-lg bg-[var(--mm-hover-bg)] border border-[var(--mm-card-border)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleExpand(i, s.title)}
                    className="w-full p-3 text-left flex items-start gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[var(--mm-text)] text-sm">{s.title}</div>
                      <p className="text-xs text-[var(--mm-text-60)] mt-1">{s.reason}</p>
                    </div>
                    {lookup.status === 'loading' ? (
                      <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin text-[var(--mm-text-40)]" />
                    ) : lookup.status === 'idle' ? (
                      <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-[var(--mm-text-40)]" />
                    ) : (
                      <ChevronUp className="h-4 w-4 mt-0.5 shrink-0 text-[var(--mm-text-40)]" />
                    )}
                  </button>

                  {(lookup.status === 'found' || lookup.status === 'not_found' || lookup.status === 'error') && (
                    <div className="px-3 pb-3 border-t border-[var(--mm-card-border)] pt-3">
                      {lookup.status === 'found' && lookup.result ? (
                        <div className="flex gap-3">
                          {lookup.result.poster_url ? (
                            <Image
                              src={lookup.result.poster_url}
                              alt={lookup.result.title}
                              width={56}
                              height={80}
                              className="rounded object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-20 rounded bg-[var(--mm-card-bg)] shrink-0" />
                          )}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="text-xs text-[var(--mm-text-50)]">
                              {lookup.result.release_year ?? 'Unknown year'}
                            </div>
                            {lookup.result.description && (
                              <p className="text-xs text-[var(--mm-text-60)] line-clamp-3">{lookup.result.description}</p>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={inLibrary || lookup.added}
                              onClick={() => handleAdd(i, lookup.result!)}
                              className="h-7 text-xs border-[var(--mm-card-border)] bg-[var(--mm-hover-bg-strong)]"
                            >
                              {inLibrary || lookup.added ? (
                                <>
                                  <Check className="h-3 w-3 mr-1" /> In Library
                                </>
                              ) : (
                                <>
                                  <Plus className="h-3 w-3 mr-1" /> Add to Library
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : lookup.status === 'not_found' ? (
                        <div className="flex items-center gap-2 text-xs text-[var(--mm-text-40)] py-1">
                          <SearchX className="h-3.5 w-3.5" />
                          Couldn&apos;t find a match to add - try searching manually.
                        </div>
                      ) : (
                        <div className="text-xs text-red-400 py-1">Lookup failed - try again.</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
