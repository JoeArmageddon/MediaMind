import { create } from 'zustand';
import { db } from '@/lib/db/dexie';
import { supabase } from '@/lib/db/supabase';
import type { History, HistoryWithMedia } from '@/types';

interface HistoryStore {
  history: HistoryWithMedia[];
  isLoading: boolean;
  fetchHistory: () => Promise<void>;
  addHistoryEntry: (entry: Omit<History, 'id' | 'created_at'>) => Promise<void>;
}

export const useHistoryStore = create<HistoryStore>((set) => ({
  history: [],
  isLoading: false,

  fetchHistory: async () => {
    set({ isLoading: true });
    try {
      // Load from IndexedDB first
      const localHistory = await db.history
        .orderBy('created_at')
        .reverse()
        .limit(50)
        .toArray();

      // Get media titles for each history entry
      const mediaIds = Array.from(new Set(localHistory.map((h) => h.media_id)));
      const mediaItems = await db.media.where('id').anyOf(mediaIds).toArray();
      const mediaMap = new Map(mediaItems.map((m) => [m.id, m]));

      const historyWithMedia: HistoryWithMedia[] = localHistory.map((h) => ({
        ...h,
        media: mediaMap.get(h.media_id)
          ? {
              id: mediaMap.get(h.media_id)!.id,
              title: mediaMap.get(h.media_id)!.title,
              type: mediaMap.get(h.media_id)!.type,
              poster_url: mediaMap.get(h.media_id)!.poster_url,
            }
          : { id: h.media_id, title: 'Unknown', type: 'misc' as const, poster_url: null },
      }));

      set({ history: historyWithMedia });

      // Sync with Supabase if online
      if (navigator.onLine) {
        try {
          const { data, error } = await (supabase as any)
            .from('history')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

          if (!error && data) {
            // Update IndexedDB
            await db.history.bulkPut(data as History[]);

            // Get updated media info
            const updatedMediaIds = Array.from(new Set(data.map((h: History) => h.media_id)));
            const updatedMediaItems = await db.media.where('id').anyOf(updatedMediaIds).toArray();
            const updatedMediaMap = new Map(updatedMediaItems.map((m) => [m.id, m]));

            const updatedHistoryWithMedia: HistoryWithMedia[] = (data as History[]).map((h) => ({
              ...h,
              media: updatedMediaMap.get(h.media_id)
                ? {
                    id: updatedMediaMap.get(h.media_id)!.id,
                    title: updatedMediaMap.get(h.media_id)!.title,
                    type: updatedMediaMap.get(h.media_id)!.type,
                    poster_url: updatedMediaMap.get(h.media_id)!.poster_url,
                  }
                : { id: h.media_id, title: 'Unknown', type: 'misc' as const, poster_url: null },
            }));

            set({ history: updatedHistoryWithMedia });
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
    const newEntry: History = {
      ...entry,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    // Add to IndexedDB
    await db.history.add(newEntry);

    // Sync with Supabase if online
    if (navigator.onLine) {
      try {
        await (supabase as any).from('history').insert(newEntry);
      } catch (e) {
        console.warn('Failed to sync history:', e);
      }
    }

    // Refresh history
    const store = useHistoryStore.getState();
    await store.fetchHistory();
  },
}));
