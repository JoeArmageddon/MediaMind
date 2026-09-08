import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SyncStatus } from '@/types';
import { db, MAX_SYNC_ATTEMPTS } from '@/lib/db/dexie';
import { useMediaStore } from '@/store/mediaStore';

interface SyncStore extends SyncStatus {
  setOnline: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSync: (date: string) => void;
  setPendingChanges: (count: number) => void;
  setConflictCount: (count: number) => void;
  updateSyncStatus: () => Promise<void>;
}

export const useSyncStore = create<SyncStore>()(
  persist(
    (set, get) => ({
      is_online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      is_syncing: false,
      last_sync: null,
      pending_changes: 0,
      conflict_count: 0,

      setOnline: (online) => set({ is_online: online }),
      
      setSyncing: (syncing) => set({ is_syncing: syncing }),
      
      setLastSync: (date) => set({ last_sync: date }),
      
      setPendingChanges: (count) => set({ pending_changes: count }),
      
      setConflictCount: (count) => set({ conflict_count: count }),

      updateSyncStatus: async () => {
        const queue = await db.syncQueue.toArray();
        const conflictCount = queue.filter((item) => (item.attempts ?? 0) >= MAX_SYNC_ATTEMPTS).length;
        set({
          pending_changes: queue.length,
          conflict_count: conflictCount,
          is_online: navigator.onLine,
        });
      },
    }),
    {
      name: 'sync-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        last_sync: state.last_sync,
      }),
    }
  )
);

// Listen for online/offline events, and actually drive the sync queue -
// previously nothing ever called syncWithSupabase() except indirectly via
// fetchMedia() on page mount, so queued changes (from mediaStore,
// collectionStore, historyStore) could sit unsynced indefinitely.
const SYNC_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

async function runSync() {
  try {
    await useMediaStore.getState().syncWithSupabase();
  } catch (e) {
    console.warn('Background sync failed:', e);
  } finally {
    await useSyncStore.getState().updateSyncStatus();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useSyncStore.getState().setOnline(true);
    runSync();
  });

  window.addEventListener('offline', () => {
    useSyncStore.getState().setOnline(false);
  });

  setInterval(() => {
    if (navigator.onLine) runSync();
  }, SYNC_INTERVAL_MS);

  // Reflect current queue state (and pick up anything left over from a
  // previous session) as soon as the app loads.
  useSyncStore.getState().updateSyncStatus();
}
