import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { db } from '@/lib/db/dexie';
import { supabase } from '@/lib/db/supabase';
import type { SmartCollection } from '@/types';

const TABLE = 'smart_collections';

interface CollectionStore {
  collections: SmartCollection[];
  isLoading: boolean;
  fetchCollections: () => Promise<void>;
  addCollection: (collection: Omit<SmartCollection, 'id' | 'created_at' | 'updated_at'>) => Promise<SmartCollection>;
  updateCollection: (id: string, updates: Partial<SmartCollection>) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addMediaToCollection: (collectionId: string, mediaId: string) => Promise<void>;
  removeMediaFromCollection: (collectionId: string, mediaId: string) => Promise<void>;
}

// Queues a write for later retry - picked up generically by
// mediaStore.syncWithSupabase(), which processes db.syncQueue regardless of
// which store enqueued the entry.
async function queueChange(operation: 'insert' | 'update' | 'delete', data: Record<string, unknown>) {
  await db.syncQueue.add({
    id: crypto.randomUUID(),
    table: TABLE,
    operation,
    data,
    created_at: new Date().toISOString(),
  });
}

export const useCollectionStore = create<CollectionStore>()(
  persist(
    (set, get) => ({
      collections: [],
      isLoading: false,

      fetchCollections: async () => {
        set({ isLoading: true });
        try {
          // Load from IndexedDB first - always the source of truth for the UI.
          const localCollections = await db.smartCollections
            .orderBy('updated_at')
            .reverse()
            .toArray();

          set({ collections: localCollections });

          // Sync with Supabase if online
          if (navigator.onLine) {
            try {
              const { data, error } = await (supabase as any)
                .from(TABLE)
                .select('*')
                .order('updated_at', { ascending: false });

              if (!error && data) {
                // Collections pending deletion shouldn't reappear just
                // because the delete hasn't reached Supabase yet.
                const pendingDeletes = await db.syncQueue
                  .where('table')
                  .equals(TABLE)
                  .toArray();
                const pendingDeleteIds = new Set(
                  pendingDeletes.filter((c) => c.operation === 'delete').map((c) => c.data.id)
                );

                const serverCollections = (data as SmartCollection[]).filter(
                  (c) => !pendingDeleteIds.has(c.id)
                );
                const serverIds = new Set(serverCollections.map((c) => c.id));

                // Local-only collections (created/edited offline, or whose
                // sync hasn't landed yet) must survive a refetch instead of
                // being wiped by clear()+bulkAdd() of server data.
                const localOnly = localCollections.filter(
                  (c) => !serverIds.has(c.id) && !pendingDeleteIds.has(c.id)
                );

                const merged = [...serverCollections, ...localOnly];

                await db.smartCollections.bulkPut(merged);
                set({ collections: merged });
              }
            } catch (e) {
              console.warn('Supabase collections sync failed:', e);
            }
          }
        } catch (error) {
          console.error('fetchCollections error:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      addCollection: async (collectionData) => {
        const now = new Date().toISOString();
        const newCollection: SmartCollection = {
          ...collectionData,
          id: crypto.randomUUID(),
          created_at: now,
          updated_at: now,
        };

        // Add to IndexedDB first (always succeeds locally)
        await db.smartCollections.add(newCollection);

        set((state) => ({
          collections: [newCollection, ...state.collections],
        }));

        if (navigator.onLine) {
          try {
            const { error } = await (supabase as any).from(TABLE).insert(newCollection);
            if (error) throw error;
          } catch (e) {
            console.warn('Failed to sync new collection, queuing:', e);
            await queueChange('insert', newCollection as unknown as Record<string, unknown>);
          }
        } else {
          await queueChange('insert', newCollection as unknown as Record<string, unknown>);
        }

        return newCollection;
      },

      updateCollection: async (id, updates) => {
        const updated_at = new Date().toISOString();

        await db.smartCollections.update(id, { ...updates, updated_at });

        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === id ? { ...c, ...updates, updated_at } : c
          ),
        }));

        if (navigator.onLine) {
          try {
            const { error } = await (supabase as any)
              .from(TABLE)
              .update({ ...updates, updated_at })
              .eq('id', id);
            if (error) throw error;
          } catch (e) {
            console.warn('Failed to sync collection update, queuing:', e);
            await queueChange('update', { id, ...updates, updated_at });
          }
        } else {
          await queueChange('update', { id, ...updates, updated_at });
        }
      },

      deleteCollection: async (id) => {
        await db.smartCollections.delete(id);

        set((state) => ({
          collections: state.collections.filter((c) => c.id !== id),
        }));

        if (navigator.onLine) {
          try {
            const { error } = await (supabase as any).from(TABLE).delete().eq('id', id);
            if (error) throw error;
          } catch (e) {
            console.warn('Failed to sync collection deletion, queuing:', e);
            await queueChange('delete', { id });
          }
        } else {
          await queueChange('delete', { id });
        }
      },

      addMediaToCollection: async (collectionId, mediaId) => {
        const collection = get().collections.find((c) => c.id === collectionId);
        if (!collection) return;

        if (collection.media_ids.includes(mediaId)) return;

        const updatedMediaIds = [...collection.media_ids, mediaId];
        await get().updateCollection(collectionId, { media_ids: updatedMediaIds });
      },

      removeMediaFromCollection: async (collectionId, mediaId) => {
        const collection = get().collections.find((c) => c.id === collectionId);
        if (!collection) return;

        const updatedMediaIds = collection.media_ids.filter((id) => id !== mediaId);
        await get().updateCollection(collectionId, { media_ids: updatedMediaIds });
      },
    }),
    {
      name: 'collection-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ collections: state.collections }),
    }
  )
);
