import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getCurrentUserId } from '../lib/supabase';
import type { Media } from '../lib/types';

const CACHE_KEY = 'mediamind:media-cache';

// Chunk A is online-first (see the Phase 3 plan): reads go through an
// AsyncStorage cache for instant paint on relaunch, but writes require
// connectivity and surface a clear error rather than queueing offline -
// porting the web app's full Dexie sync-queue architecture (synced flag,
// verified-update/idempotent-delete fixes, retry-with-backoff) is Chunk B,
// once this online-first shape has been proven on a real device.

// normalized_title is a Postgres GENERATED ALWAYS ... STORED column - any
// insert/update that includes it is rejected outright (same fix as web's
// mediaStore). `synced` is local-only bookkeeping with no Supabase column.
function stripForSupabase(item: Partial<Media>): Record<string, unknown> {
  const { normalized_title, synced, ...rest } = item as Record<string, unknown>;
  return rest;
}

interface MediaStore {
  media: Media[];
  isLoading: boolean;
  error: string | null;
  fetchMedia: () => Promise<void>;
  addMedia: (data: Omit<Media, 'id' | 'created_at' | 'updated_at' | 'normalized_title'>) => Promise<Media>;
  updateMedia: (id: string, updates: Partial<Media>) => Promise<void>;
  deleteMedia: (id: string) => Promise<void>;
}

export const useMediaStore = create<MediaStore>((set, get) => ({
  media: [],
  isLoading: false,
  error: null,

  fetchMedia: async () => {
    set({ isLoading: true, error: null });

    // Instant paint from cache while the real fetch is in flight.
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) set({ media: JSON.parse(cached) });
    } catch (e) {
      console.warn('Failed to read media cache:', e);
    }

    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        set({ isLoading: false });
        return;
      }

      // Explicitly scoped to the signed-in user - see the stripForSupabase
      // comment above; unfiltered RLS is not the same as "mine".
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .or(`user_id.eq.${currentUserId},user_id.is.null`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const fetched = ((data ?? []) as Media[]).map((m) => ({ ...m, synced: true }));
      set({ media: fetched, isLoading: false });
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fetched)).catch((e) =>
        console.warn('Failed to write media cache:', e)
      );
    } catch (error) {
      console.error('fetchMedia error:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to load library.', isLoading: false });
    }
  },

  addMedia: async (mediaData) => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) throw new Error('Not signed in.');

    const now = new Date().toISOString();
    // No `id` field here (the Omit<> parameter type excludes it) - Postgres
    // generates one via the column default, same as a fresh insert on web.
    const payload = {
      ...mediaData,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('media')
      .insert(stripForSupabase(payload))
      .select()
      .single();

    if (error) throw error;

    const newMedia = { ...(data as Media), synced: true };
    set((state) => {
      const media = [newMedia, ...state.media];
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(media)).catch(() => {});
      return { media };
    });

    return newMedia;
  },

  updateMedia: async (id, updates) => {
    const updated_at = new Date().toISOString();

    // Optimistic local update first, reconciled below.
    set((state) => ({
      media: state.media.map((m) => (m.id === id ? { ...m, ...updates, updated_at } : m)),
    }));

    // .select() to detect a silent 0-row RLS no-op (same fix as web's
    // mediaStore) - without it an update blocked by RLS looks identical to
    // a real success.
    const { data: updatedRows, error } = await supabase
      .from('media')
      .update(stripForSupabase({ ...updates, updated_at }))
      .eq('id', id)
      .select('id');

    if (error || !updatedRows || updatedRows.length === 0) {
      throw error ?? new Error('Update did not apply - you may be offline or signed out.');
    }

    const media = get().media;
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(media)).catch(() => {});
  },

  deleteMedia: async (id) => {
    const previous = get().media;
    set((state) => ({ media: state.media.filter((m) => m.id !== id) }));

    // Delete is idempotent - 0 rows matched is as valid an outcome as 1
    // (the row's already gone either way), so only a real `error` counts
    // as failure here.
    const { error } = await supabase.from('media').delete().eq('id', id);

    if (error) {
      // Roll back the optimistic removal - Chunk A has no offline queue to
      // fall back to, so a failed delete needs to actually reappear rather
      // than silently vanish from the UI while still existing server-side.
      set({ media: previous });
      throw error;
    }

    const media = get().media;
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(media)).catch(() => {});
  },
}));
