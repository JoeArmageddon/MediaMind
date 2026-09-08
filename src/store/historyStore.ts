import { create } from 'zustand';
import { db } from '@/lib/db/dexie';
import { supabase } from '@/lib/db/supabase';
import { logHistory } from '@/lib/history';
import type { History, HistoryWithMedia, Media } from '@/types';

interface HistoryStore {
  history: HistoryWithMedia[];
  isLoading: boolean;
  fetchHistory: () => Promise<void>;
  addHistoryEntry: (entry: Omit<History, 'id' | 'created_at'>) => Promise<void>;
}

async function withMedia(entries: History[]): Promise<HistoryWithMedia[]> {
  const mediaIds = Array.from(new Set(entries.map((h) => h.media_id)));
  const mediaItems = await db.media.where('id').anyOf(mediaIds).toArray();
  const mediaMap = new Map(mediaItems.map((m) => [m.id, m]));

  return entries.map((h) => {
    const media = mediaMap.get(h.media_id);
    return {
      ...h,
      media: media
        ? { id: media.id, title: media.title, type: media.type, poster_url: media.poster_url }
        : ({ id: h.media_id, title: 'Unknown', type: 'misc', poster_url: null } as Pick<
            Media,
            'id' | 'title' | 'type' | 'poster_url'
          >),
    };
  });
}

export const useHistoryStore = create<HistoryStore>((set) => ({
  history: [],
  isLoading: false,

  fetchHistory: async () => {
    set({ isLoading: true });
    try {
      // Load from IndexedDB first - always the source of truth for the UI.
      const localHistory = await db.history.orderBy('created_at').reverse().limit(50).toArray();
      set({ history: await withMedia(localHistory) });

      // Sync with Supabase if online. History rows there are authored by the
      // media_history_log DB trigger (see supabase/schema.sql), so this is a
      // read-only pull - nothing here ever writes back to Supabase.
      if (navigator.onLine) {
        try {
          const { data, error } = await (supabase as any)
            .from('history')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

          if (!error && data) {
            const serverRows = data as History[];

            // bulkPut upserts by id - it merges into IndexedDB without
            // touching rows that only exist locally (e.g. entries logged
            // offline, or not yet reflected by the trigger).
            await db.history.bulkPut(serverRows);

            // Re-read from IndexedDB (now containing both server-synced and
            // local-only rows) rather than using the Supabase response
            // alone, so local-only entries don't disappear from the UI.
            const mergedHistory = await db.history
              .orderBy('created_at')
              .reverse()
              .limit(50)
              .toArray();

            // Local placeholder rows (written by logHistory() for instant
            // offline-first UI) are never synced up - the media_history_log
            // trigger is what actually produces the authoritative Supabase
            // row for the same mutation, under a different id. Once that
            // authoritative row has synced down for a given media item, any
            // local placeholder at-or-before it has served its purpose and
            // would otherwise sit forever as a visual duplicate.
            const newestServerRowByMedia = new Map<string, string>();
            for (const row of serverRows) {
              const newest = newestServerRowByMedia.get(row.media_id);
              if (!newest || row.created_at > newest) {
                newestServerRowByMedia.set(row.media_id, row.created_at);
              }
            }
            const serverIds = new Set(serverRows.map((h) => h.id));
            const stalePlaceholderIds = mergedHistory
              .filter((h) => !serverIds.has(h.id))
              .filter((h) => {
                const newestServer = newestServerRowByMedia.get(h.media_id);
                return newestServer !== undefined && h.created_at <= newestServer;
              })
              .map((h) => h.id);

            if (stalePlaceholderIds.length > 0) {
              await db.history.bulkDelete(stalePlaceholderIds);
            }

            const finalHistory = mergedHistory.filter((h) => !stalePlaceholderIds.includes(h.id));
            set({ history: await withMedia(finalHistory) });
          }
        } catch (e) {
          console.warn('Supabase history sync failed:', e);
        }
      }
    } catch (error) {
      console.error('fetchHistory error:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addHistoryEntry: async (entry) => {
    const newEntry = await logHistory(entry);
    const [entryWithMedia] = await withMedia([newEntry]);
    set((state) => ({ history: [entryWithMedia, ...state.history] }));
  },
}));
