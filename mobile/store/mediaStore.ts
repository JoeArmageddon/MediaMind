import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase, getCurrentUserId } from '../lib/supabase';
import { enqueue, processQueue, peekQueue } from '../lib/offlineQueue';
import { isCurrentlyOnline } from '../lib/useNetworkStatus';
import type { Media } from '../lib/types';

const CACHE_KEY = 'mediamind:media-cache';

// Chunk B: full offline-first parity, mirroring the now-hardened logic in
// the web app's src/store/mediaStore.ts - the AsyncStorage cache this
// store already had (Chunk A) becomes the actual source of truth instead
// of just a paint-while-loading cache, backed by lib/offlineQueue.ts
// (this app's equivalent of web's db.syncQueue) for writes made while
// offline or that fail to reach Supabase.
//
// The `synced` flag (see Media type) is what makes fetchMedia's merge
// safe: a local-only item that was NEVER confirmed synced gets pushed to
// Supabase (it's genuinely new/still offline), but a local-only item that
// WAS previously synced and is now absent from a fresh Supabase fetch was
// deleted elsewhere and gets pruned locally instead of resurrected.
// Conflating those two cases was a real data-loss bug on web; the same
// distinction is preserved here.

function stripForSupabase(item: Partial<Media>): Record<string, unknown> {
  const { normalized_title, synced, ...rest } = item as Record<string, unknown>;
  return rest;
}

// A real Postgrest/Postgres error response (the request reached the
// server and got a definitive answer) always carries a SQLSTATE-shaped
// `code` - a unique violation (23505, the duplicate-title case
// search.tsx's handleAdd specifically translates to "Already in your
// library"), a check constraint, an RLS-denied insert, etc. That's a
// permanent failure the caller needs to know about immediately, not
// something retrying later will ever fix - so it's re-thrown rather than
// queued. A thrown network exception (no response ever reached: airplane
// mode, DNS failure, timeout) has no such shape - that's the genuinely
// offline case worth queuing for later instead of surfacing as an error.
function isDefiniteRejection(e: unknown): e is { code: string; message?: string } {
  return !!e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string';
}

async function readCache(): Promise<Media[]> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (e) {
    console.warn('Failed to read media cache:', e);
    return [];
  }
}

async function writeCache(media: Media[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(media));
  } catch (e) {
    console.warn('Failed to write media cache:', e);
  }
}

interface MediaStore {
  media: Media[];
  isLoading: boolean;
  error: string | null;
  fetchMedia: () => Promise<void>;
  addMedia: (data: Omit<Media, 'id' | 'created_at' | 'updated_at' | 'normalized_title'>) => Promise<Media>;
  updateMedia: (id: string, updates: Partial<Media>) => Promise<void>;
  deleteMedia: (id: string) => Promise<void>;
  syncWithSupabase: () => Promise<void>;
}

export const useMediaStore = create<MediaStore>((set, get) => ({
  media: [],
  isLoading: false,
  error: null,

  fetchMedia: async () => {
    set({ isLoading: true, error: null });

    // Always load local data first - instant paint, and the fallback if
    // the network step below fails or there's no connectivity at all.
    const localMedia = await readCache();
    set({ media: localMedia });

    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
      set({ isLoading: false });
      return;
    }

    const online = await isCurrentlyOnline();
    if (!online) {
      set({ isLoading: false });
      return;
    }

    try {
      // Push pending local writes first, so a fetch right after doesn't
      // race a still-queued change and appear to revert it.
      await get().syncWithSupabase();

      const { data, error } = await supabase
        .from('media')
        .select('*')
        .or(`user_id.eq.${currentUserId},user_id.is.null`)
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetch error, keeping local data:', error);
        set({ isLoading: false });
        return;
      }

      const remoteMedia = (data ?? []) as Media[];
      const localAfterSync = await readCache();

      // Safety check: an all-empty response with real local data is
      // exactly the ambiguous case `synced` exists for (a transient
      // glitch vs. everything genuinely being gone) - only never-synced
      // items get pushed here, previously-confirmed-synced ones are left
      // alone rather than either resurrected-by-reupload or deleted on
      // what might just be a flaky response.
      if (remoteMedia.length === 0 && localAfterSync.length > 0) {
        const neverSynced = localAfterSync.filter((m) => m.synced !== true);
        for (const item of neverSynced) {
          try {
            await supabase.from('media').upsert(stripForSupabase(item));
          } catch (e) {
            console.warn('Failed to upsert never-synced item:', item.title, e);
          }
        }
        set({ isLoading: false });
        return;
      }

      const pendingQueue = await peekQueue();
      const pendingDeleteIds = new Set(
        pendingQueue.filter((q) => q.table === 'media' && q.operation === 'delete').map((q) => q.data.id)
      );

      const remoteIds = new Set(remoteMedia.map((m) => m.id));
      const localOnlyItems = localAfterSync.filter((m) => !remoteIds.has(m.id) && !pendingDeleteIds.has(m.id));

      const unsyncedLocalOnly = localOnlyItems.filter((m) => m.synced !== true);
      // deletedElsewhere (synced===true but missing from the fresh
      // fetch) simply aren't included in `merged` below - that's the
      // pruning; no separate delete call is needed.

      if (unsyncedLocalOnly.length > 0) {
        for (const item of unsyncedLocalOnly) {
          try {
            await supabase.from('media').upsert(stripForSupabase(item));
          } catch (e) {
            console.warn('Failed to push local-only item:', item.title, e);
          }
        }
      }

      const filteredRemote = remoteMedia
        .filter((m) => !pendingDeleteIds.has(m.id))
        .map((m) => ({ ...m, synced: true }));

      const merged = [...filteredRemote, ...unsyncedLocalOnly];

      await writeCache(merged);
      set({ media: merged, isLoading: false });
    } catch (e) {
      console.warn('fetchMedia sync step failed, keeping local data:', e);
      set({ isLoading: false });
    }
  },

  addMedia: async (mediaData) => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) throw new Error('Not signed in.');

    const now = new Date().toISOString();
    const id = Crypto.randomUUID();
    // Not confirmed to exist in Supabase yet - see the Media type's
    // `synced` doc comment for why this distinction matters to fetchMedia.
    const newMedia = { ...mediaData, id, created_at: now, updated_at: now, synced: false } as Media;

    // Local write always succeeds first (optimistic) - offline or online.
    set((state) => {
      const media = [newMedia, ...state.media];
      writeCache(media).catch(() => {});
      return { media };
    });

    const payload = stripForSupabase(newMedia);
    const online = await isCurrentlyOnline();

    if (online) {
      try {
        const { data, error } = await supabase.from('media').insert(payload).select().single();
        if (error) throw error;

        const synced = { ...(data as Media), synced: true };
        set((state) => {
          const media = state.media.map((m) => (m.id === id ? synced : m));
          writeCache(media).catch(() => {});
          return { media };
        });
        return synced;
      } catch (e) {
        if (isDefiniteRejection(e)) {
          // The server definitively rejected this insert (e.g. 23505 -
          // already have this title+type) - roll back the optimistic
          // local copy, since it doesn't really exist and would otherwise
          // sit un-syncable forever, and let the caller handle it (this
          // is exactly the path search.tsx's handleAdd depends on to show
          // "Already in your library" instead of a generic error).
          set((state) => {
            const media = state.media.filter((m) => m.id !== id);
            writeCache(media).catch(() => {});
            return { media };
          });
          throw e;
        }
        console.warn('addMedia sync failed (network), queuing:', e);
        await enqueue({ table: 'media', operation: 'insert', data: payload });
      }
    } else {
      await enqueue({ table: 'media', operation: 'insert', data: payload });
    }

    return newMedia;
  },

  updateMedia: async (id, updates) => {
    const updated_at = new Date().toISOString();

    // Optimistic local update first, reconciled below.
    set((state) => {
      const media = state.media.map((m) => (m.id === id ? { ...m, ...updates, updated_at } : m));
      writeCache(media).catch(() => {});
      return { media };
    });

    const payload = stripForSupabase({ ...updates, updated_at });
    const online = await isCurrentlyOnline();

    if (online) {
      try {
        // .select() to detect a silent 0-row RLS no-op - without it an
        // update blocked by RLS looks identical to a real success.
        const { data: updatedRows, error } = await supabase.from('media').update(payload).eq('id', id).select('id');

        // A response that actually came back from Supabase (this `error`,
        // as opposed to a thrown network exception below) is always a
        // structured PostgrestError - always has a `.code`, so it's
        // already a "definite rejection" by construction. Thrown as-is;
        // the outer catch's isDefiniteRejection check is what decides
        // whether it reaches the caller (this) or gets queued (a genuine
        // network exception with no such shape).
        if (error) throw error;
        if (!updatedRows || updatedRows.length === 0) {
          // 0 rows with no error is RLS silently filtering the row out
          // (most likely a momentarily stale/unresolved auth token) -
          // worth retrying, not a definite rejection, so this falls
          // through to the queue below rather than the caller.
          throw new Error('0 rows affected - likely blocked by RLS on a stale token');
        }
        return;
      } catch (e) {
        if (isDefiniteRejection(e)) throw e;
        console.warn('updateMedia sync failed (network/RLS), queuing:', e);
      }
    }

    await enqueue({ table: 'media', operation: 'update', data: { id, ...payload } });
  },

  deleteMedia: async (id) => {
    set((state) => {
      const media = state.media.filter((m) => m.id !== id);
      writeCache(media).catch(() => {});
      return { media };
    });

    const online = await isCurrentlyOnline();

    if (online) {
      try {
        // Delete is idempotent - 0 rows matched is as valid an outcome as
        // 1 (the row's already gone either way), so only a real `error`
        // counts as failure here.
        const { error } = await supabase.from('media').delete().eq('id', id);
        if (error) throw error;
        return;
      } catch (e) {
        console.warn('deleteMedia sync failed, queuing:', e);
      }
    }

    // Unlike Chunk A (which rolled the optimistic removal back on
    // failure, since there was no queue to fall back to), this queues the
    // delete for retry instead - the item stays gone from the UI, and the
    // queue is what makes that eventually consistent rather than the
    // delete needing to succeed synchronously.
    await enqueue({ table: 'media', operation: 'delete', data: { id } });
  },

  syncWithSupabase: async () => {
    const online = await isCurrentlyOnline();
    if (!online) return;

    const { succeeded } = await processQueue();
    if (succeeded.length === 0) return;

    // A queued media insert that just landed is now confirmed to exist in
    // Supabase - without this, the next fetchMedia's merge would keep
    // treating it as "local-only, needs pushing" forever.
    const insertedIds = new Set(
      succeeded.filter((c) => c.table === 'media' && c.operation === 'insert').map((c) => c.data.id as string)
    );
    if (insertedIds.size > 0) {
      set((state) => {
        const media = state.media.map((m) => (insertedIds.has(m.id) ? { ...m, synced: true } : m));
        writeCache(media).catch(() => {});
        return { media };
      });
    }
  },
}));
