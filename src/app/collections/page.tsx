'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowLeft,
  Plus,
  Film,
  Wand2,
  Folder,
  Trash2,
  Share2,
  Users,
  X,
  Loader2,
  QrCode,
  Copy,
  Check,
  RefreshCw,
  Search,
  Globe,
  ChevronDown,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAIClient } from '@/lib/ai';
import { getSearchOrchestrator } from '@/lib/api/search';
import { mapExternalIds } from '@/lib/api/externalId';
import { MediaDetail } from '@/components/media/MediaDetail';
import { useMediaStore } from '@/store/mediaStore';
import { useCollectionStore } from '@/store/collectionStore';
import { useFriendStore } from '@/store/friendStore';
import { supabase } from '@/lib/db/supabase';
import { db, type AICollectionDraft } from '@/lib/db/dexie';
import { cn, getTypeLabel } from '@/lib/utils';
import type {
  AISmartCollection,
  SmartCollection,
  SharedCollection,
  CollectionShareWithProfile,
  Media,
  MediaType,
  SearchResult,
} from '@/types';

// The practical subset of MediaType worth exposing as a toggle for the
// Discover (non-library) collection - matches the Search page's own type
// tabs, skipping the rarer light_novel/visual_novel/web_series/misc ones
// for the same reason it does. None selected = mixed/any type.
const DISCOVERY_TYPE_OPTIONS: { value: MediaType; label: string }[] = [
  { value: 'movie', label: 'Movies' },
  { value: 'tv', label: 'TV' },
  { value: 'anime', label: 'Anime' },
  { value: 'manhwa', label: 'Manhwa' },
  { value: 'manhua', label: 'Manhua' },
  { value: 'donghua', label: 'Donghua' },
  { value: 'manga', label: 'Manga' },
  { value: 'game', label: 'Games' },
  { value: 'book', label: 'Books' },
];

function UserCollectionCard({
  collection,
  onClick,
  onDelete,
  onShare,
}: {
  collection: SmartCollection;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onShare: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      className="glass-card rounded-[24px] p-6 cursor-pointer hover:border-indigo-500/50 transition-all group relative overflow-hidden"
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Folder className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-xl font-black text-[var(--mm-text)] tracking-tight">{collection.title}</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onShare}
              title="Share with a friend"
              className="p-2 rounded-lg hover:bg-indigo-500/20 text-[var(--mm-text-40)] hover:text-indigo-400 transition-colors"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-lg hover:bg-red-500/20 text-[var(--mm-text-40)] hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {collection.description && (
          <p className="text-[var(--mm-text-60)] text-sm mb-4 leading-relaxed">{collection.description}</p>
        )}
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-[var(--mm-hover-bg)] border-[var(--mm-card-border)] text-[var(--mm-text)] rounded-lg px-3 py-1">
            {collection.media_ids.length} items
          </Badge>
          {collection.is_auto_generated && (
            <Badge variant="outline" className="border-fuchsia-500/50 text-fuchsia-400 rounded-lg">
              <Sparkles className="h-3 w-3 mr-1" />
              AI
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function AICollectionCard({
  collection,
  onOpen,
  onSave,
  onDiscard,
}: {
  collection: AISmartCollection;
  onOpen: () => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      className="glass-card rounded-[24px] p-6 hover:border-fuchsia-500/50 transition-all group relative overflow-hidden cursor-pointer"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center shadow-lg shadow-fuchsia-500/20">
              <Film className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-xl font-black text-[var(--mm-text)] tracking-tight">{collection.title}</h3>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              onClick={onSave}
              className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg"
            >
              <Plus className="h-4 w-4 mr-1" />
              Save
            </Button>
            <button
              onClick={onDiscard}
              title="Discard suggestion"
              className="p-2 rounded-lg hover:bg-red-500/20 text-[var(--mm-text-40)] hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <p className="text-[var(--mm-text-60)] text-sm mb-4 leading-relaxed">{collection.description}</p>

        <div className="flex flex-wrap gap-2">
          {collection.media_titles.slice(0, 4).map((title) => (
            <Badge
              key={title}
              variant="secondary"
              className="bg-[var(--mm-hover-bg)] border-[var(--mm-card-border)] text-[var(--mm-text)] rounded-lg px-3 py-1"
            >
              {title}
            </Badge>
          ))}
          {collection.media_titles.length > 4 && (
            <Badge variant="outline" className="border-[var(--mm-card-border)] text-[var(--mm-text-50)] rounded-lg">
              +{collection.media_titles.length - 4}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// A dedicated card style for the one "Discover" collection per generation
// (see DiscoveryCollectionDetail) - visually distinct from the library
// AICollectionCards above since it's suggesting titles the user probably
// doesn't own yet, not reorganizing ones they do. No inline Save button
// here (unlike AICollectionCard) since there's nothing to save until the
// user has actually added some of these to their library first, from
// inside the detail view.
function DiscoveryCollectionCard({
  collection,
  onOpen,
  onDiscard,
}: {
  collection: AISmartCollection;
  onOpen: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      className="glass-card rounded-[24px] p-6 border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 transition-all group relative overflow-hidden cursor-pointer"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 to-cyan-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold">Discover · not in your library</span>
              <h3 className="text-xl font-black text-[var(--mm-text)] tracking-tight">{collection.title}</h3>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDiscard();
            }}
            title="Discard suggestion"
            className="p-2 rounded-lg hover:bg-red-500/20 text-[var(--mm-text-40)] hover:text-red-400 transition-colors shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[var(--mm-text-60)] text-sm mb-4 leading-relaxed">{collection.description}</p>

        <div className="flex flex-wrap gap-2">
          {collection.media_titles.slice(0, 4).map((title) => (
            <Badge
              key={title}
              variant="secondary"
              className="bg-[var(--mm-hover-bg)] border-[var(--mm-card-border)] text-[var(--mm-text)] rounded-lg px-3 py-1"
            >
              {title}
            </Badge>
          ))}
          {collection.media_titles.length > 4 && (
            <Badge variant="outline" className="border-[var(--mm-card-border)] text-[var(--mm-text-50)] rounded-lg">
              +{collection.media_titles.length - 4}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function UserCollectionDetail({
  collection,
  media,
  onExpandMedia,
  onAddMedia,
  onRemoveMedia,
}: {
  collection: SmartCollection;
  media: Media[];
  onExpandMedia: (item: Media, readOnly: boolean) => void;
  onAddMedia: () => void;
  onRemoveMedia: (mediaId: string) => void;
}) {
  const collMedia = media.filter((m) => collection.media_ids.includes(m.id));

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl font-black text-[var(--mm-text)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          {collection.title}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {collection.description && (
          <p className="text-[var(--mm-text-60)] text-sm leading-relaxed">{collection.description}</p>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[var(--mm-text-50)] uppercase tracking-wider">Media in collection</h4>
            <button
              onClick={onAddMedia}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          {collMedia.length > 0 ? (
            collMedia.map((item) => (
              <div
                key={item.id}
                onClick={() => onExpandMedia(item, false)}
                className="flex items-center justify-between p-3 rounded-xl bg-[var(--mm-hover-bg)] border border-[var(--mm-card-border)] hover:border-[var(--mm-card-border-hover)] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.poster_url ? (
                    <img src={item.poster_url} alt={item.title} className="w-10 h-14 object-cover rounded-lg shrink-0" />
                  ) : (
                    <div className="w-10 h-14 bg-[var(--mm-hover-bg-strong)] rounded-lg flex items-center justify-center text-lg font-bold shrink-0">
                      {item.title[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-[var(--mm-text)] font-medium text-sm truncate block">{item.title}</span>
                    <p className="text-xs text-[var(--mm-text-40)]">{getTypeLabel(item.type)}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveMedia(item.id);
                  }}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-[var(--mm-text-30)] hover:text-red-400 transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-[var(--mm-text-40)] text-sm text-center py-4">No media in this collection yet.</p>
          )}
        </div>
      </div>
    </>
  );
}

function AICollectionDetail({
  collection,
  allMedia,
  onExpandMedia,
}: {
  collection: AISmartCollection;
  allMedia: Media[];
  onExpandMedia: (item: Media) => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl font-black text-[var(--mm-text)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          {collection.title}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {collection.description && (
          <p className="text-[var(--mm-text-60)] text-sm leading-relaxed">{collection.description}</p>
        )}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[var(--mm-text-50)] uppercase tracking-wider">Suggested media</h4>
          {collection.media_titles.map((title) => {
            // These titles came straight from the user's own library data
            // handed to the prompt, so a match here can show the real
            // poster/description directly - no network lookup needed,
            // unlike DiscoveryCollectionDetail's titles.
            const matched = allMedia.find(
              (m) =>
                m.title.toLowerCase().includes(title.toLowerCase()) ||
                title.toLowerCase().includes(m.title.toLowerCase())
            );
            return (
              <div
                key={title}
                onClick={() => matched && onExpandMedia(matched)}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl bg-[var(--mm-hover-bg)] border border-[var(--mm-card-border)] transition-colors',
                  matched ? 'hover:border-[var(--mm-card-border-hover)] cursor-pointer' : 'opacity-60'
                )}
              >
                {matched?.poster_url ? (
                  <img src={matched.poster_url} alt={matched.title} className="w-10 h-14 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className="w-10 h-14 bg-[var(--mm-hover-bg-strong)] rounded-lg flex items-center justify-center text-lg font-bold shrink-0">
                    {title[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--mm-text)] font-medium text-sm truncate">{title}</span>
                    {!matched && (
                      <Badge variant="outline" className="text-[10px] border-[var(--mm-card-border)] text-[var(--mm-text-40)] shrink-0">
                        Not matched
                      </Badge>
                    )}
                  </div>
                  {matched?.description && (
                    <p className="text-xs text-[var(--mm-text-50)] mt-1 line-clamp-2">{matched.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

type DiscoveryLookup = {
  status: 'loading' | 'found' | 'not_found' | 'error';
  result?: SearchResult;
  addedId?: string;
};

// The "Discover" collection's titles are real-world suggestions, not
// drawn from the user's library - there's nothing local to show yet, so
// every title gets run through the same multi-source search the Search
// page uses (never trusting the model's own text as fact - see
// buildDiscoveryCollectionPrompt's comment). Matched ones can be added to
// the library individually, or all at once; "Save Collection" only ever
// includes titles that were actually added, since an unadded suggestion
// has no media_id to put in a collection.
function DiscoveryCollectionDetail({
  collection,
  preferredType,
  onSaved,
}: {
  collection: AISmartCollection;
  preferredType?: MediaType;
  onSaved: () => void;
}) {
  const { addMedia, media } = useMediaStore();
  const { addCollection } = useCollectionStore();
  const [lookups, setLookups] = useState<Record<number, DiscoveryLookup>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [addingIndex, setAddingIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLookups({});
    setExpanded({});

    collection.media_titles.forEach((title, i) => {
      setLookups((prev) => ({ ...prev, [i]: { status: 'loading' } }));
      getSearchOrchestrator()
        .search(title, preferredType)
        .then((results) => {
          if (cancelled) return;
          const best = results[0];
          setLookups((prev) => ({ ...prev, [i]: best ? { status: 'found', result: best } : { status: 'not_found' } }));
        })
        .catch((e) => {
          console.error('Discovery lookup failed:', e);
          if (!cancelled) setLookups((prev) => ({ ...prev, [i]: { status: 'error' } }));
        });
    });

    return () => {
      cancelled = true;
    };
    // Re-run only when a genuinely different collection is opened, not on
    // every render (this component's own state updates would otherwise
    // re-trigger the effect and re-search everything on each result).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection.title]);

  // Adds one result to the library and returns its media_id - the actual
  // add logic, shared by the per-item button and the "add everything"
  // bulk action below. Returns the id directly rather than making callers
  // re-read `lookups` afterward, since that state update is async and a
  // caller adding several items in a row can't rely on it having landed
  // yet by the time it needs the ids.
  const addOne = async (index: number, result: SearchResult): Promise<string | null> => {
    try {
      const externalIds = mapExternalIds(result);
      const newMedia = await addMedia({
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
        completed_at: null,
        ...externalIds,
      });
      setLookups((prev) => ({ ...prev, [index]: { ...prev[index], addedId: newMedia.id } }));
      return newMedia.id;
    } catch (e: any) {
      // 23505 = already have this title+type - not an error worth
      // surfacing, just resolve it to the existing row so Save can still
      // include it.
      if (e?.code === '23505') {
        const existing = media.find(
          (m) => m.type === result.type && m.title.trim().toLowerCase() === result.title.trim().toLowerCase()
        );
        if (existing) {
          setLookups((prev) => ({ ...prev, [index]: { ...prev[index], addedId: existing.id } }));
          return existing.id;
        }
        return null;
      }
      console.error('Failed to add discovery result:', e);
      return null;
    }
  };

  const handleAdd = async (index: number, result: SearchResult) => {
    setAddingIndex(index);
    try {
      await addOne(index, result);
    } finally {
      setAddingIndex(null);
    }
  };

  const addedIds = Object.values(lookups)
    .map((l) => l.addedId)
    .filter((id): id is string => !!id);

  const pendingFound = collection.media_titles
    .map((_, i) => i)
    .filter((i) => lookups[i]?.status === 'found' && !lookups[i]?.addedId);

  const saveWithIds = async (ids: string[]) => {
    await addCollection({
      title: collection.title,
      description: collection.description,
      media_ids: Array.from(new Set(ids)),
      filter_criteria: null,
      is_auto_generated: true,
      is_public: false,
    });
    onSaved();
  };

  const handleSaveCollection = async () => {
    setIsSaving(true);
    try {
      await saveWithIds(addedIds);
    } catch (e) {
      console.error('Failed to save discovery collection:', e);
    } finally {
      setIsSaving(false);
    }
  };

  // Adds every verified-but-not-yet-added title, then saves in one go -
  // the "I trust these, just give me the whole thing" path, as opposed to
  // reviewing and adding each one individually first.
  const handleAddAllAndSave = async () => {
    setIsSavingAll(true);
    try {
      const newIds = await Promise.all(pendingFound.map((i) => addOne(i, lookups[i].result!)));
      await saveWithIds([...addedIds, ...newIds.filter((id): id is string => !!id)]);
    } catch (e) {
      console.error('Failed to add & save discovery collection:', e);
    } finally {
      setIsSavingAll(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl font-black text-[var(--mm-text)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-600 flex items-center justify-center">
            <Globe className="h-4 w-4 text-white" />
          </div>
          {collection.title}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {collection.description && (
          <p className="text-[var(--mm-text-60)] text-sm leading-relaxed">{collection.description}</p>
        )}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[var(--mm-text-50)] uppercase tracking-wider">
            Real titles, verified against TMDB/MyAnimeList/RAWG/Google Books
          </h4>
          {collection.media_titles.map((title, i) => {
            const lookup = lookups[i] ?? { status: 'loading' };
            const isExpanded = !!expanded[i];
            const canExpand = lookup.status === 'found' && !!lookup.result;
            return (
              <div
                key={`${title}-${i}`}
                className="rounded-xl bg-[var(--mm-hover-bg)] border border-[var(--mm-card-border)] overflow-hidden"
              >
                <div
                  onClick={() => canExpand && setExpanded((prev) => ({ ...prev, [i]: !prev[i] }))}
                  className={cn('flex items-start gap-3 p-3', canExpand && 'cursor-pointer')}
                >
                  {lookup.status === 'found' && lookup.result?.poster_url ? (
                    <img
                      src={lookup.result.poster_url}
                      alt={lookup.result.title}
                      className="w-10 h-14 object-cover rounded-lg shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-14 bg-[var(--mm-hover-bg-strong)] rounded-lg flex items-center justify-center text-lg font-bold shrink-0">
                      {title[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--mm-text)] font-medium text-sm truncate">
                        {lookup.result?.title ?? title}
                      </span>
                      {lookup.status === 'loading' && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--mm-text-40)]" />}
                      {canExpand && (
                        <ChevronDown className={cn('h-4 w-4 shrink-0 text-[var(--mm-text-40)] transition-transform', isExpanded && 'rotate-180')} />
                      )}
                    </div>
                    {lookup.status === 'found' && lookup.result?.description && !isExpanded && (
                      <p className="text-xs text-[var(--mm-text-50)] mt-1 line-clamp-2">{lookup.result.description}</p>
                    )}
                    {lookup.status === 'not_found' && (
                      <p className="text-xs text-[var(--mm-text-40)] mt-1">Couldn&apos;t verify this one - skipping it.</p>
                    )}
                    {lookup.status === 'error' && (
                      <p className="text-xs text-red-400 mt-1">Lookup failed.</p>
                    )}
                  </div>
                </div>

                {isExpanded && lookup.result && (
                  <div className="px-3 pb-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                    {lookup.result.description && (
                      <p className="text-xs text-[var(--mm-text-60)] leading-relaxed">{lookup.result.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] border-[var(--mm-card-border)] text-[var(--mm-text-50)]">
                        {getTypeLabel(lookup.result.type)}
                      </Badge>
                      {lookup.result.release_year != null && (
                        <Badge variant="outline" className="text-[10px] border-[var(--mm-card-border)] text-[var(--mm-text-50)]">
                          {lookup.result.release_year}
                        </Badge>
                      )}
                      {lookup.result.api_rating != null && (
                        <Badge variant="outline" className="text-[10px] border-[var(--mm-card-border)] text-[var(--mm-text-50)]">
                          ★ {lookup.result.api_rating.toFixed(1)}
                        </Badge>
                      )}
                      {lookup.result.genres.map((g) => (
                        <Badge key={g} variant="secondary" className="text-[10px] bg-[var(--mm-hover-bg-strong)] border-[var(--mm-card-border)]">
                          {g}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!lookup.addedId || addingIndex === i}
                      onClick={() => handleAdd(i, lookup.result!)}
                      className="h-7 text-xs border-[var(--mm-card-border)] bg-[var(--mm-hover-bg-strong)]"
                    >
                      {addingIndex === i ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : lookup.addedId ? (
                        <Check className="h-3 w-3 mr-1" />
                      ) : (
                        <Plus className="h-3 w-3 mr-1" />
                      )}
                      {lookup.addedId ? 'Added' : 'Add to Library'}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {pendingFound.length > 0 && (
          <Button
            onClick={handleAddAllAndSave}
            disabled={isSavingAll || isSaving}
            className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white rounded-xl h-12"
          >
            {isSavingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {isSavingAll
              ? 'Adding & saving...'
              : `Add All ${pendingFound.length} & Save Whole Collection`}
          </Button>
        )}

        <Button
          onClick={handleSaveCollection}
          disabled={addedIds.length === 0 || isSaving || isSavingAll}
          variant={pendingFound.length > 0 ? 'outline' : 'default'}
          className={cn(
            'w-full rounded-xl h-12',
            pendingFound.length > 0
              ? 'border-[var(--mm-card-border)] bg-[var(--mm-hover-bg-strong)]'
              : 'bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white'
          )}
        >
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          {addedIds.length === 0 ? 'Add at least one title first' : `Save Collection (${addedIds.length} added)`}
        </Button>
      </div>
    </>
  );
}

function SharedCollectionCard({
  collection,
  onClick,
}: {
  collection: SharedCollection;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="glass-card rounded-[24px] p-6 cursor-pointer hover:border-indigo-500/50 transition-all group relative overflow-hidden"
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Folder className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-xl font-black text-[var(--mm-text)] tracking-tight">{collection.title}</h3>
          </div>
        </div>

        {collection.description && (
          <p className="text-[var(--mm-text-60)] text-sm mb-4 leading-relaxed">{collection.description}</p>
        )}

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-[var(--mm-hover-bg)] border-[var(--mm-card-border)] text-[var(--mm-text)] rounded-lg px-3 py-1">
            {collection.media_ids.length} items
          </Badge>
          {collection.owner && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--mm-text-50)]">
              {collection.owner.imageUrl ? (
                <img src={collection.owner.imageUrl} alt={collection.owner.name} className="w-4 h-4 rounded-full" />
              ) : (
                <Users className="h-3 w-3" />
              )}
              {collection.owner.name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SharedCollectionDetail({
  collection,
  onExpandMedia,
  onAddMedia,
  onRemoveMedia,
}: {
  collection: SharedCollection;
  onExpandMedia: (item: Media, readOnly: boolean) => void;
  onAddMedia: () => void;
  onRemoveMedia: (mediaId: string) => void;
}) {
  const [media, setMedia] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentUserId = typeof window !== 'undefined' ? window.Clerk?.user?.id : undefined;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    // The shared collection's media_ids point at the owner's media rows,
    // not mine - fetched fresh rather than filtered from my own media
    // list. RLS ("select friends media") is what actually makes this work:
    // it only returns rows here because owner and viewer are friends.
    (async () => {
      if (collection.media_ids.length === 0) {
        if (!cancelled) {
          setMedia([]);
          setIsLoading(false);
        }
        return;
      }
      try {
        const { data, error } = await (supabase as any)
          .from('media')
          .select('*')
          .in('id', collection.media_ids);
        if (cancelled) return;
        if (error) throw error;
        setMedia((data ?? []) as Media[]);
      } catch (e) {
        console.warn('Failed to load shared collection media:', e);
        if (!cancelled) setMedia([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collection]);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl font-black text-[var(--mm-text)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
            <Folder className="h-4 w-4 text-white" />
          </div>
          {collection.title}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {collection.owner && (
          <p className="text-[var(--mm-text-40)] text-xs">Shared by {collection.owner.name}</p>
        )}
        {collection.description && (
          <p className="text-[var(--mm-text-60)] text-sm leading-relaxed">{collection.description}</p>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[var(--mm-text-50)] uppercase tracking-wider">Media in collection</h4>
            <button
              onClick={onAddMedia}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          {isLoading ? (
            <div className="text-center py-4">
              <Loader2 className="h-5 w-5 text-[var(--mm-text-30)] mx-auto animate-spin" />
            </div>
          ) : media.length > 0 ? (
            media.map((item) => {
              // Any collaborator's write to media itself is blocked by RLS
              // regardless (only the owning account can edit its own media
              // row) - only expand into the fully editable MediaDetail when
              // this item is actually mine.
              const isMine = (item as unknown as { user_id?: string }).user_id === currentUserId;
              return (
                <div
                  key={item.id}
                  onClick={() => onExpandMedia(item, !isMine)}
                  className="flex items-center justify-between p-3 rounded-xl bg-[var(--mm-hover-bg)] border border-[var(--mm-card-border)] hover:border-[var(--mm-card-border-hover)] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.poster_url ? (
                      <img src={item.poster_url} alt={item.title} className="w-10 h-14 object-cover rounded-lg shrink-0" />
                    ) : (
                      <div className="w-10 h-14 bg-[var(--mm-hover-bg-strong)] rounded-lg flex items-center justify-center text-lg font-bold shrink-0">
                        {item.title[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-[var(--mm-text)] font-medium text-sm truncate block">{item.title}</span>
                      <p className="text-xs text-[var(--mm-text-40)]">{getTypeLabel(item.type)}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveMedia(item.id);
                    }}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-[var(--mm-text-30)] hover:text-red-400 transition-colors shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          ) : (
            <p className="text-[var(--mm-text-40)] text-sm text-center py-4">No media in this collection.</p>
          )}
        </div>
      </div>
    </>
  );
}

function ShareCollectionDialog({
  collection,
  onClose,
}: {
  collection: SmartCollection | null;
  onClose: () => void;
}) {
  const { friends, fetchFriends } = useFriendStore();
  const {
    fetchSharesForCollection,
    shareCollection,
    unshareCollection,
    inviteCodes,
    fetchCollectionInviteCode,
    regenerateCollectionInviteCode,
    setCollectionPublic,
  } = useCollectionStore();
  const [shares, setShares] = useState<CollectionShareWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyFriendId, setBusyFriendId] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState<'link' | 'code' | 'public-link' | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  // Local, optimistic mirror of collection.is_public - the `collection`
  // prop is a snapshot passed down from the collections list, which
  // doesn't itself re-render just because the store's underlying row
  // changed, so a toggle here needs its own state to reflect instantly.
  const [isPublic, setIsPublic] = useState(collection?.is_public ?? false);
  const [isTogglingPublic, setIsTogglingPublic] = useState(false);

  useEffect(() => {
    if (!collection) return;
    fetchFriends();
    fetchCollectionInviteCode(collection.id);
    setIsPublic(collection.is_public);
    setIsLoading(true);
    fetchSharesForCollection(collection.id)
      .then(setShares)
      .finally(() => setIsLoading(false));
  }, [collection, fetchFriends, fetchSharesForCollection, fetchCollectionInviteCode]);

  if (!collection) return null;

  const sharedWithIds = new Set(shares.map((s) => s.shared_with_id));
  const code = inviteCodes[collection.id];
  const link = code && typeof window !== 'undefined' ? `${window.location.origin}/collection-invite/${code}` : '';
  const publicLink =
    typeof window !== 'undefined' ? `${window.location.origin}/collections/public/${collection.id}` : '';

  const handleTogglePublic = async () => {
    const next = !isPublic;
    setIsTogglingPublic(true);
    setIsPublic(next);
    try {
      await setCollectionPublic(collection.id, next);
    } catch {
      setIsPublic(!next);
    } finally {
      setIsTogglingPublic(false);
    }
  };

  const copy = async (value: string, which: 'link' | 'code' | 'public-link') => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard denied/unavailable - not worth an error, it's on screen.
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('Generate a new invite code for this collection? The current code and link will stop working.')) {
      return;
    }
    setIsRegenerating(true);
    await regenerateCollectionInviteCode(collection.id);
    setIsRegenerating(false);
  };

  const handleToggle = async (friendId: string) => {
    setBusyFriendId(friendId);
    try {
      const existingShare = shares.find((s) => s.shared_with_id === friendId);
      if (existingShare) {
        await unshareCollection(existingShare.id);
        setShares((prev) => prev.filter((s) => s.id !== existingShare.id));
      } else {
        const result = await shareCollection(collection.id, friendId);
        if (result.success) {
          const updated = await fetchSharesForCollection(collection.id);
          setShares(updated);
        }
      }
    } finally {
      setBusyFriendId(null);
    }
  };

  return (
    <Dialog open={!!collection} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-[var(--mm-card-bg)] border-[var(--mm-card-border)] rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-[var(--mm-text)] flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share &quot;{collection.title}&quot;
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-2xl bg-[var(--mm-hover-bg)] border border-[var(--mm-card-border)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Globe className="h-4 w-4 text-[var(--mm-text-50)] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[var(--mm-text)]">Public collection</p>
                <p className="text-xs text-[var(--mm-text-40)] mt-0.5">
                  {isPublic
                    ? 'Anyone signed in to MediaMind can view this via its link - no friendship needed.'
                    : 'Only you (and anyone you share it with below) can see it.'}
                </p>
              </div>
            </div>
            <Switch checked={isPublic} onCheckedChange={handleTogglePublic} disabled={isTogglingPublic} />
          </div>
          {isPublic && (
            <div className="mt-3 pt-3 border-t border-[var(--mm-card-border)] flex items-center gap-2">
              <Input
                readOnly
                value={publicLink}
                onFocus={(e) => e.target.select()}
                className="bg-[var(--mm-input-bg)] border-[var(--mm-card-border)] rounded-lg h-9 text-xs font-mono text-[var(--mm-text-70)]"
              />
              <Button
                onClick={() => copy(publicLink, 'public-link')}
                size="sm"
                variant="outline"
                className="border-[var(--mm-card-border)] text-[var(--mm-text-70)] hover:text-[var(--mm-text)] hover:bg-[var(--mm-hover-bg-strong)] rounded-lg text-xs shrink-0"
              >
                {copied === 'public-link' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          )}
        </div>

        {code && (
          <div className="rounded-2xl bg-[var(--mm-hover-bg)] border border-[var(--mm-card-border)] p-4 mb-2">
            <h4 className="text-xs font-bold text-[var(--mm-text-50)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <QrCode className="h-3.5 w-3.5" />
              Invite link - anyone with it can join
            </h4>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <button
                  onClick={() => copy(code, 'code')}
                  className="group flex items-center gap-2 mb-2 -ml-1 px-1 rounded-lg hover:bg-[var(--mm-hover-bg)] transition-colors"
                >
                  <span className="font-mono text-lg font-black text-[var(--mm-text)] tracking-[0.15em]">{code}</span>
                  {copied === 'code' ? (
                    <Check className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-[var(--mm-text-30)] group-hover:text-[var(--mm-text-60)]" />
                  )}
                </button>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => copy(link, 'link')}
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs"
                  >
                    {copied === 'link' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copied === 'link' ? 'Copied' : 'Copy link'}
                  </Button>
                  <Button
                    onClick={() => setShowQr((s) => !s)}
                    size="sm"
                    variant="outline"
                    className="border-[var(--mm-card-border)] text-[var(--mm-text-70)] hover:text-[var(--mm-text)] hover:bg-[var(--mm-hover-bg-strong)] rounded-lg text-xs"
                  >
                    <QrCode className="h-3 w-3 mr-1" />
                    {showQr ? 'Hide QR' : 'Show QR'}
                  </Button>
                  <Button
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    size="sm"
                    variant="ghost"
                    className="text-[var(--mm-text-40)] hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                  >
                    {isRegenerating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
              {showQr && link && (
                <div className="bg-white p-2.5 rounded-xl shrink-0">
                  <QRCodeSVG value={link} size={100} />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="py-2">
          <h4 className="text-xs font-bold text-[var(--mm-text-50)] uppercase tracking-wider mb-3">Share with a friend</h4>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-5 w-5 text-[var(--mm-text-30)] mx-auto animate-spin" />
            </div>
          ) : friends.length === 0 ? (
            <p className="text-[var(--mm-text-50)] text-sm text-center py-8">
              Add friends first to share collections with them.
            </p>
          ) : (
            <div className="space-y-2">
              {friends.map((f) => {
                const isShared = f.otherUser && sharedWithIds.has(f.otherUser.id);
                const isBusy = busyFriendId === f.otherUser?.id;
                return (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[var(--mm-hover-bg)] border border-[var(--mm-card-border)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {f.otherUser?.imageUrl ? (
                        <img src={f.otherUser.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center text-white text-xs font-bold">
                          {f.otherUser?.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <span className="text-sm text-[var(--mm-text)] truncate">{f.otherUser?.name}</span>
                    </div>
                    <Button
                      size="sm"
                      disabled={isBusy || !f.otherUser}
                      onClick={() => f.otherUser && handleToggle(f.otherUser.id)}
                      className={cn(
                        'rounded-lg text-xs',
                        isShared
                          ? 'bg-[var(--mm-hover-bg-strong)] hover:bg-red-500/20 text-[var(--mm-text-70)] hover:text-red-400'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      )}
                    >
                      {isBusy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isShared ? (
                        <>
                          <X className="h-3 w-3 mr-1" />
                          Remove
                        </>
                      ) : (
                        'Share'
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddMediaPickerDialog({
  open,
  onClose,
  pool,
  excludeIds,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  pool: Media[];
  excludeIds: string[];
  onAdd: (mediaId: string) => Promise<void> | void;
}) {
  const { addMedia } = useMediaStore();
  const [tab, setTab] = useState<'library' | 'search'>('library');
  const [search, setSearch] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  const [externalQuery, setExternalQuery] = useState('');
  const [externalResults, setExternalResults] = useState<SearchResult[]>([]);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);
  const [addedExternalKeys, setAddedExternalKeys] = useState<Set<string>>(new Set());
  const [externalError, setExternalError] = useState<string | null>(null);

  const available = pool.filter((m) => !excludeIds.includes(m.id));
  const filtered = search.trim()
    ? available.filter((m) => m.title.toLowerCase().includes(search.trim().toLowerCase()))
    : available;

  const handleAdd = async (mediaId: string) => {
    setAddingId(mediaId);
    try {
      await onAdd(mediaId);
    } finally {
      setAddingId(null);
    }
  };

  const handleExternalSearch = async () => {
    if (!externalQuery.trim()) return;
    setIsSearchingExternal(true);
    setExternalError(null);
    try {
      const orchestrator = getSearchOrchestrator();
      const results = await orchestrator.search(externalQuery.trim(), undefined);
      setExternalResults(results);
    } catch (e) {
      setExternalError(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setIsSearchingExternal(false);
    }
  };

  // A title from external search isn't in your library yet - this creates
  // it (same shape as the Search tab's own add flow) and then adds the
  // newly created row to the collection via the same onAdd path used for
  // an existing item, rather than needing a separate "unowned catalog
  // reference" data model just for this.
  const handleAddExternal = async (result: SearchResult) => {
    const key = `${result.type}:${result.title}`;
    setAddingId(key);
    setExternalError(null);
    try {
      const externalIds = mapExternalIds(result);
      const newMedia = await addMedia({
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
        completed_at: null,
        ...externalIds,
      });
      await onAdd(newMedia.id);
      setAddedExternalKeys((prev) => new Set(prev).add(key));
    } catch (e) {
      setExternalError(e instanceof Error ? e.message : 'Failed to add this title.');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-[var(--mm-card-bg)] border-[var(--mm-card-border)] rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-[var(--mm-text)]">Add Media</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'library' | 'search')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-[var(--mm-hover-bg)] p-1 rounded-xl h-auto">
            <TabsTrigger
              value="library"
              className="rounded-lg py-2 px-1 text-xs sm:text-sm data-[state=active]:bg-[var(--mm-hover-bg-strong)] data-[state=active]:text-[var(--mm-text)] text-[var(--mm-text-60)] min-w-0"
            >
              <span className="truncate">My Library</span>
            </TabsTrigger>
            <TabsTrigger
              value="search"
              className="rounded-lg py-2 px-1 text-xs sm:text-sm data-[state=active]:bg-[var(--mm-hover-bg-strong)] data-[state=active]:text-[var(--mm-text)] text-[var(--mm-text-60)] min-w-0"
            >
              <Search className="h-3.5 w-3.5 mr-1 shrink-0" />
              <span className="truncate">Search Web</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="space-y-3 mt-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your library..."
              className="bg-[var(--mm-input-bg)] border-[var(--mm-card-border)] rounded-xl h-11"
            />
            <div className="max-h-80 overflow-y-auto space-y-2">
              {filtered.length === 0 ? (
                <p className="text-[var(--mm-text-40)] text-sm text-center py-6">
                  {available.length === 0 ? "Everything's already in this collection." : 'No matches.'}
                </p>
              ) : (
                filtered.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--mm-hover-bg)] border border-[var(--mm-card-border)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.poster_url ? (
                        <img src={item.poster_url} alt={item.title} className="w-9 h-12 object-cover rounded-lg shrink-0" />
                      ) : (
                        <div className="w-9 h-12 bg-[var(--mm-hover-bg-strong)] rounded-lg flex items-center justify-center text-sm font-bold shrink-0">
                          {item.title[0]}
                        </div>
                      )}
                      <span className="text-[var(--mm-text)] text-sm truncate">{item.title}</span>
                    </div>
                    <Button
                      size="sm"
                      disabled={addingId === item.id}
                      onClick={() => handleAdd(item.id)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shrink-0"
                    >
                      {addingId === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="search" className="space-y-3 mt-3">
            <p className="text-xs text-[var(--mm-text-40)] -mt-1">
              Add a title you don&apos;t track yet - it's added to your library and this collection together.
            </p>
            <div className="flex gap-2">
              <Input
                value={externalQuery}
                onChange={(e) => setExternalQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExternalSearch()}
                placeholder="Search movies, TV, anime, books, games..."
                className="bg-[var(--mm-input-bg)] border-[var(--mm-card-border)] rounded-xl h-11 flex-1"
              />
              <Button
                onClick={handleExternalSearch}
                disabled={isSearchingExternal || !externalQuery.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 px-4"
              >
                {isSearchingExternal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {externalError && <p className="text-xs text-red-400">{externalError}</p>}
            <div className="max-h-72 overflow-y-auto space-y-2">
              {externalResults.map((result, i) => {
                const key = `${result.type}:${result.title}`;
                const added = addedExternalKeys.has(key);
                return (
                  <div
                    key={`${key}-${i}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--mm-hover-bg)] border border-[var(--mm-card-border)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {result.poster_url ? (
                        <img src={result.poster_url} alt={result.title} className="w-9 h-12 object-cover rounded-lg shrink-0" />
                      ) : (
                        <div className="w-9 h-12 bg-[var(--mm-hover-bg-strong)] rounded-lg flex items-center justify-center text-sm font-bold shrink-0">
                          {result.title[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-[var(--mm-text)] text-sm truncate block">{result.title}</span>
                        <span className="text-[10px] text-[var(--mm-text-40)] uppercase tracking-wide">
                          {getTypeLabel(result.type)}
                          {result.release_year ? ` · ${result.release_year}` : ''}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={added || addingId === key}
                      onClick={() => !added && handleAddExternal(result)}
                      className={cn(
                        'rounded-lg shrink-0',
                        added ? 'bg-green-600 hover:bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'
                      )}
                    >
                      {addingId === key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--mm-text)]" />
                      ) : added ? (
                        <Check className="h-3.5 w-3.5 text-[var(--mm-text)]" />
                      ) : (
                        <Plus className="h-3.5 w-3.5 text-[var(--mm-text)]" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default function CollectionsPage() {
  const router = useRouter();
  const { media, updateMedia, deleteMedia } = useMediaStore();
  const {
    collections,
    sharedWithMe,
    fetchCollections,
    fetchSharedWithMe,
    addCollection,
    deleteCollection,
    addMediaToCollection,
    removeMediaFromCollection,
    addMediaToSharedCollection,
    removeMediaFromSharedCollection,
    redeemCollectionCode,
  } = useCollectionStore();

  // Generated-but-unsaved AI suggestions, persisted to db.aiCollectionDrafts
  // so they survive navigation/reload until explicitly saved or discarded.
  const [aiCollections, setAiCollections] = useState<AICollectionDraft[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [themeHint, setThemeHint] = useState('');
  // Which type(s) the Discover (non-library) collection is constrained to -
  // empty means mixed/any type, the AI's own call per title. Only affects
  // generateDiscoveryCollection, not the library-reorganizing generation
  // (that one's types are whatever's already in the library).
  const [discoveryTypes, setDiscoveryTypes] = useState<MediaType[]>([]);
  // Not Dexie-persisted like aiCollections (a fresh one is generated every
  // "Generate" click alongside the library ones, and its titles need a
  // live re-search on open anyway, so there's nothing worth surviving a
  // reload for).
  const [discoveryDraft, setDiscoveryDraft] = useState<AISmartCollection | null>(null);
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [selectedUserCollection, setSelectedUserCollection] = useState<SmartCollection | null>(null);
  const [selectedAICollection, setSelectedAICollection] = useState<AISmartCollection | null>(null);
  const [selectedSharedCollection, setSelectedSharedCollection] = useState<SharedCollection | null>(null);
  const [shareDialogCollection, setShareDialogCollection] = useState<SmartCollection | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('my');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinFeedback, setJoinFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // "Expand" a media row from inside a collection's detail view - editable
  // (readOnly false) for your own collection's items, or when a shared
  // collection's item happens to be one of yours; read-only otherwise.
  const [expandedMedia, setExpandedMedia] = useState<{ item: Media; readOnly: boolean } | null>(null);
  // Which collection an "Add Media" picker is currently targeting, and
  // whether it's one of mine or one shared with me (they call different
  // store actions - own collections vs. collaborative shared ones).
  const [addMediaTarget, setAddMediaTarget] = useState<{ id: string; kind: 'own' | 'shared' } | null>(null);

  useEffect(() => {
    fetchCollections();
    fetchSharedWithMe();
    db.aiCollectionDrafts
      .orderBy('created_at')
      .reverse()
      .toArray()
      .then(setAiCollections)
      .catch((e) => console.warn('Failed to load AI collection drafts:', e));
  }, [fetchCollections, fetchSharedWithMe]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setDiscoveryDraft(null);
    try {
      const ai = getAIClient();
      // Existing saved collections plus whatever drafts are still on
      // screen from a previous generate (about to be cleared below) - both
      // count as "already have this", so a re-generate doesn't just
      // reproduce the same groupings under a slightly different title.
      const avoidTitles = [...collections.map((c) => c.title), ...aiCollections.map((d) => d.data.title)];

      // Two independent generations in parallel: one reorganizes what's
      // already in the library, the other suggests real titles the user
      // probably doesn't own yet (see buildDiscoveryCollectionPrompt).
      // allSettled so a failure in the (non-essential) discovery call
      // never blocks or alerts about the library one succeeding.
      const [libraryResult, discoveryResult] = await Promise.allSettled([
        ai.generateSmartCollections(
          media.map((m) => ({
            title: m.title,
            type: m.type,
            genres: m.genres,
            ai_primary_tone: m.ai_primary_tone,
          })),
          avoidTitles,
          themeHint.trim() || undefined
        ),
        ai.generateDiscoveryCollection(themeHint.trim() || undefined, discoveryTypes.length > 0 ? discoveryTypes : undefined),
      ]);

      if (libraryResult.status === 'fulfilled' && libraryResult.value) {
        const now = new Date().toISOString();
        const drafts: AICollectionDraft[] = libraryResult.value.map((data) => ({
          id: crypto.randomUUID(),
          data,
          created_at: now,
        }));

        // Replace any previous batch of drafts with the new one.
        await db.aiCollectionDrafts.clear();
        await db.aiCollectionDrafts.bulkAdd(drafts);

        setAiCollections(drafts);
        setActiveTab('ai');
      } else if (libraryResult.status === 'rejected') {
        console.error('Library generation failed:', libraryResult.reason);
        alert('Failed to generate AI collections. Make sure you have a Groq or Gemini API key in Settings.');
      }

      if (discoveryResult.status === 'fulfilled' && discoveryResult.value) {
        setDiscoveryDraft(discoveryResult.value);
      } else if (discoveryResult.status === 'rejected') {
        console.warn('Discovery generation failed (non-fatal):', discoveryResult.reason);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const discardAICollection = async (draftId: string) => {
    await db.aiCollectionDrafts.delete(draftId);
    setAiCollections((prev) => prev.filter((d) => d.id !== draftId));
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;

    await addCollection({
      title: newCollectionName,
      description: newCollectionDesc || null,
      media_ids: selectedMediaIds,
      filter_criteria: null,
      is_auto_generated: false,
      is_public: false,
    });

    setNewCollectionName('');
    setNewCollectionDesc('');
    setSelectedMediaIds([]);
    setIsCreateOpen(false);
  };

  const handleSaveAICollection = async (draft: AICollectionDraft) => {
    const aiCollection = draft.data;
    const mediaIds: string[] = [];
    aiCollection.media_titles.forEach((title) => {
      const matchedMedia = media.find(
        (m) => m.title.toLowerCase().includes(title.toLowerCase()) ||
               title.toLowerCase().includes(m.title.toLowerCase())
      );
      if (matchedMedia) {
        mediaIds.push(matchedMedia.id);
      }
    });

    await addCollection({
      title: aiCollection.title,
      description: aiCollection.description,
      media_ids: mediaIds,
      filter_criteria: null,
      is_auto_generated: true,
      is_public: false,
    });

    // Saved for real now - the draft has served its purpose.
    await discardAICollection(draft.id);

    alert(`"${aiCollection.title}" saved!`);
  };

  const handleAddToOwnCollection = async (mediaId: string) => {
    if (!addMediaTarget) return;
    await addMediaToCollection(addMediaTarget.id, mediaId);
    // Keep the open detail dialog's list in sync without closing it.
    setSelectedUserCollection((prev) =>
      prev && prev.id === addMediaTarget.id
        ? { ...prev, media_ids: [...prev.media_ids, mediaId] }
        : prev
    );
  };

  const handleAddToSharedCollection = async (mediaId: string) => {
    if (!addMediaTarget) return;
    await addMediaToSharedCollection(addMediaTarget.id, mediaId);
    setSelectedSharedCollection((prev) =>
      prev && prev.id === addMediaTarget.id
        ? { ...prev, media_ids: [...prev.media_ids, mediaId] }
        : prev
    );
  };

  const handleRemoveFromOwnCollection = async (mediaId: string) => {
    if (!selectedUserCollection) return;
    await removeMediaFromCollection(selectedUserCollection.id, mediaId);
    setSelectedUserCollection((prev) =>
      prev ? { ...prev, media_ids: prev.media_ids.filter((id) => id !== mediaId) } : prev
    );
  };

  const handleJoinByCode = async () => {
    if (!joinCodeInput.trim()) return;
    setIsJoining(true);
    setJoinFeedback(null);
    const result = await redeemCollectionCode(joinCodeInput.trim().toUpperCase());
    setJoinFeedback({ ok: result.success, text: result.message });
    if (result.success) {
      setJoinCodeInput('');
      await fetchSharedWithMe();
      setActiveTab('shared');
    }
    setIsJoining(false);
  };

  const handleRemoveFromSharedCollection = async (mediaId: string) => {
    if (!selectedSharedCollection) return;
    await removeMediaFromSharedCollection(selectedSharedCollection.id, mediaId);
    setSelectedSharedCollection((prev) =>
      prev ? { ...prev, media_ids: prev.media_ids.filter((id) => id !== mediaId) } : prev
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-[var(--mm-text)] hover:bg-[var(--mm-hover-bg-strong)] rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-black text-[var(--mm-text)] tracking-tighter">COLLECTIONS</h1>
            <p className="text-sm text-[var(--mm-text-50)] font-mono">コレクション</p>
          </div>
        </div>
        <Button 
          onClick={() => setIsCreateOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
        >
          <Plus className="mr-2 h-4 w-4" />
          New
        </Button>
      </div>

      <div className="glass-card rounded-[24px] p-6">
        <h3 className="text-sm font-bold text-[var(--mm-text-70)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Join a collection
        </h3>
        <div className="flex gap-2">
          <Input
            value={joinCodeInput}
            onChange={(e) => setJoinCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
            placeholder="Enter invite code"
            className="bg-[var(--mm-input-bg)] border-[var(--mm-card-border)] rounded-xl h-12 flex-1 font-mono uppercase tracking-widest placeholder:font-sans placeholder:normal-case placeholder:tracking-normal"
          />
          <Button
            onClick={handleJoinByCode}
            disabled={isJoining || !joinCodeInput.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 px-6"
          >
            {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Join'}
          </Button>
        </div>
        {joinFeedback && (
          <p className={cn('text-sm mt-3', joinFeedback.ok ? 'text-green-400' : 'text-red-400')}>
            {joinFeedback.text}
          </p>
        )}
      </div>

      <Input
        value={themeHint}
        onChange={(e) => setThemeHint(e.target.value)}
        placeholder="Optional theme or genre to build around (e.g. 'cozy mysteries', 'cyberpunk')"
        className="bg-[var(--mm-input-bg)] border-[var(--mm-card-border)] rounded-xl h-12"
      />

      <div className="space-y-2">
        <p className="text-xs text-[var(--mm-text-40)]">
          Discover collection media type{discoveryTypes.length > 0 ? '' : ' (mixed)'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDiscoveryTypes([])}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              discoveryTypes.length === 0
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-[var(--mm-card-border)] text-[var(--mm-text-50)] hover:text-[var(--mm-text)]'
            )}
          >
            Mixed
          </button>
          {DISCOVERY_TYPE_OPTIONS.map((opt) => {
            const active = discoveryTypes.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setDiscoveryTypes((prev) =>
                    active ? prev.filter((t) => t !== opt.value) : [...prev, opt.value]
                  )
                }
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  active
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-[var(--mm-card-border)] text-[var(--mm-text-50)] hover:text-[var(--mm-text)]'
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={isGenerating || media.length === 0}
        className="w-full bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-700 hover:to-pink-700 text-white rounded-xl h-14"
      >
        <Wand2 className={cn('mr-2 h-5 w-5', isGenerating && 'animate-spin')} />
        {isGenerating ? 'Generating...' : 'Generate AI Collections'}
      </Button>

      {media.length === 0 && (
        <div className="glass-card rounded-2xl p-6 text-center">
          <p className="text-[var(--mm-text-50)]">Add media to generate AI collections.</p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-[var(--mm-hover-bg)] p-1 rounded-2xl h-auto">
          <TabsTrigger value="my" className="rounded-xl py-3 data-[state=active]:bg-[var(--mm-hover-bg-strong)] data-[state=active]:text-[var(--mm-text)] text-[var(--mm-text-60)]">
            <Folder className="h-4 w-4 mr-2" />
            My ({collections.length})
          </TabsTrigger>
          <TabsTrigger value="ai" className="rounded-xl py-3 data-[state=active]:bg-[var(--mm-hover-bg-strong)] data-[state=active]:text-[var(--mm-text)] text-[var(--mm-text-60)]">
            <Sparkles className="h-4 w-4 mr-2" />
            AI ({aiCollections.length})
          </TabsTrigger>
          <TabsTrigger value="shared" className="rounded-xl py-3 data-[state=active]:bg-[var(--mm-hover-bg-strong)] data-[state=active]:text-[var(--mm-text)] text-[var(--mm-text-60)]">
            <Users className="h-4 w-4 mr-2" />
            Shared ({sharedWithMe.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="mt-6">
          {collections.length === 0 ? (
            <div className="glass-card rounded-[28px] p-12 text-center">
              <Folder className="h-12 w-12 text-[var(--mm-text-20)] mx-auto mb-4" />
              <p className="text-[var(--mm-text-50)]">No collections yet.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {collections.map((collection) => (
                <UserCollectionCard
                  key={collection.id}
                  collection={collection}
                  onClick={() => setSelectedUserCollection(collection)}
                  onDelete={(e) => {
                    e.stopPropagation();
                    deleteCollection(collection.id);
                  }}
                  onShare={(e) => {
                    e.stopPropagation();
                    setShareDialogCollection(collection);
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          {aiCollections.length === 0 && !discoveryDraft ? (
            <div className="glass-card rounded-[28px] p-12 text-center">
              <Sparkles className="h-12 w-12 text-[var(--mm-text-20)] mx-auto mb-4" />
              <p className="text-[var(--mm-text-50)]">No AI collections yet.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {discoveryDraft && (
                <DiscoveryCollectionCard
                  collection={discoveryDraft}
                  onOpen={() => setIsDiscoveryOpen(true)}
                  onDiscard={() => setDiscoveryDraft(null)}
                />
              )}
              {aiCollections.map((draft) => (
                <AICollectionCard
                  key={draft.id}
                  collection={draft.data}
                  onOpen={() => setSelectedAICollection(draft.data)}
                  onSave={() => handleSaveAICollection(draft)}
                  onDiscard={() => discardAICollection(draft.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="shared" className="mt-6">
          {sharedWithMe.length === 0 ? (
            <div className="glass-card rounded-[28px] p-12 text-center">
              <Users className="h-12 w-12 text-[var(--mm-text-20)] mx-auto mb-4" />
              <p className="text-[var(--mm-text-50)]">No collections shared with you yet.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {sharedWithMe.map((collection) => (
                <SharedCollectionCard
                  key={collection.id}
                  collection={collection}
                  onClick={() => setSelectedSharedCollection(collection)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg bg-[var(--mm-card-bg)] border-[var(--mm-card-border)] rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[var(--mm-text)]">Create Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs text-[var(--mm-text-50)] uppercase tracking-wider mb-2 block">Name</label>
              <Input
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="e.g., My Top Anime"
                className="bg-[var(--mm-input-bg)] border-[var(--mm-card-border)] rounded-xl h-12"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--mm-text-50)] uppercase tracking-wider mb-2 block">Description</label>
              <Textarea
                value={newCollectionDesc}
                onChange={(e) => setNewCollectionDesc(e.target.value)}
                placeholder="What's this collection about?"
                className="bg-[var(--mm-input-bg)] border-[var(--mm-card-border)] rounded-xl min-h-[80px]"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--mm-text-50)] uppercase tracking-wider mb-2 block">
                Media ({selectedMediaIds.length} selected)
              </label>
              <div className="max-h-48 overflow-y-auto space-y-2 border border-[var(--mm-card-border)] rounded-xl p-2">
                {media.map((item) => (
                  <label key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--mm-hover-bg)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMediaIds.includes(item.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMediaIds([...selectedMediaIds, item.id]);
                        } else {
                          setSelectedMediaIds(selectedMediaIds.filter((id) => id !== item.id));
                        }
                      }}
                      className="w-4 h-4 accent-violet-600"
                    />
                    <span className="text-sm text-[var(--mm-text)] truncate flex-1">{item.title}</span>
                    <Badge variant="outline" className="text-[10px] border-[var(--mm-card-border)] text-[var(--mm-text-50)]">
                      {getTypeLabel(item.type)}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>
            <Button 
              onClick={handleCreateCollection}
              disabled={!newCollectionName.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12"
            >
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedUserCollection} onOpenChange={() => setSelectedUserCollection(null)}>
        <DialogContent className="max-w-md bg-[var(--mm-card-bg)] border-[var(--mm-card-border)] rounded-[28px]">
          {selectedUserCollection && (
            <UserCollectionDetail
              collection={selectedUserCollection}
              media={media}
              onExpandMedia={(item, readOnly) => setExpandedMedia({ item, readOnly })}
              onAddMedia={() => setAddMediaTarget({ id: selectedUserCollection.id, kind: 'own' })}
              onRemoveMedia={handleRemoveFromOwnCollection}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedAICollection} onOpenChange={() => setSelectedAICollection(null)}>
        <DialogContent className="max-w-md bg-[var(--mm-card-bg)] border-[var(--mm-card-border)] rounded-[28px]">
          {selectedAICollection && (
            <AICollectionDetail
              collection={selectedAICollection}
              allMedia={media}
              onExpandMedia={(item) => {
                setSelectedAICollection(null);
                setExpandedMedia({ item, readOnly: false });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDiscoveryOpen} onOpenChange={setIsDiscoveryOpen}>
        <DialogContent className="max-w-md bg-[var(--mm-card-bg)] border-[var(--mm-card-border)] rounded-[28px] max-h-[85vh] overflow-y-auto">
          {discoveryDraft && (
            <DiscoveryCollectionDetail
              collection={discoveryDraft}
              preferredType={discoveryTypes.length === 1 ? discoveryTypes[0] : undefined}
              onSaved={() => {
                setIsDiscoveryOpen(false);
                setDiscoveryDraft(null);
                setActiveTab('my');
                alert(`"${discoveryDraft.title}" saved!`);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedSharedCollection} onOpenChange={() => setSelectedSharedCollection(null)}>
        <DialogContent className="max-w-md bg-[var(--mm-card-bg)] border-[var(--mm-card-border)] rounded-[28px]">
          {selectedSharedCollection && (
            <SharedCollectionDetail
              collection={selectedSharedCollection}
              onExpandMedia={(item, readOnly) => setExpandedMedia({ item, readOnly })}
              onAddMedia={() => setAddMediaTarget({ id: selectedSharedCollection.id, kind: 'shared' })}
              onRemoveMedia={handleRemoveFromSharedCollection}
            />
          )}
        </DialogContent>
      </Dialog>

      <ShareCollectionDialog
        collection={shareDialogCollection}
        onClose={() => setShareDialogCollection(null)}
      />

      <AddMediaPickerDialog
        open={!!addMediaTarget}
        onClose={() => setAddMediaTarget(null)}
        pool={media}
        excludeIds={
          addMediaTarget?.kind === 'own'
            ? selectedUserCollection?.media_ids ?? []
            : selectedSharedCollection?.media_ids ?? []
        }
        onAdd={addMediaTarget?.kind === 'own' ? handleAddToOwnCollection : handleAddToSharedCollection}
      />

      <Dialog open={!!expandedMedia} onOpenChange={() => setExpandedMedia(null)}>
        <DialogContent hideCloseButton className="max-w-4xl h-[90vh] lg:h-auto lg:max-h-[90vh] overflow-hidden bg-[var(--mm-card-bg)] border-[var(--mm-card-border)] p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Media Details</DialogTitle>
          </DialogHeader>
          {expandedMedia && (
            <MediaDetail
              media={expandedMedia.item}
              readOnly={expandedMedia.readOnly}
              onUpdate={
                expandedMedia.readOnly
                  ? undefined
                  : (updates) => {
                      // expandedMedia.item is a snapshot taken when this
                      // dialog opened, not a live reference into the media
                      // store - without also patching it here, a real
                      // update (Analyze Tone & Themes, Find streaming,
                      // rating, notes...) would land correctly but this
                      // still-open dialog would keep rendering the old
                      // snapshot, looking like the action did nothing.
                      updateMedia(expandedMedia.item.id, updates);
                      setExpandedMedia((prev) =>
                        prev ? { ...prev, item: { ...prev.item, ...updates } } : prev
                      );
                    }
              }
              onDelete={
                expandedMedia.readOnly
                  ? undefined
                  : () => {
                      deleteMedia(expandedMedia.item.id);
                      setExpandedMedia(null);
                    }
              }
              onClose={() => setExpandedMedia(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
