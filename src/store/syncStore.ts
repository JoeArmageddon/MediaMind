import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SyncStatus } from '@/types';
import { db } from '@/lib/db/dexie';

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
        const pendingChanges = await db.syncQueue.count();
        set({ 
          pending_changes: pendingChanges,
          is_online: navigator.onLine 
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

// Listen for online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useSyncStore.getState().setOnline(true);
  });
  
  window.addEventListener('offline', () => {
    useSyncStore.getState().setOnline(false);
  });
}
