import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { db } from '@/lib/db/dexie';
import { supabase } from '@/lib/db/supabase';
import type { SmartCollection, Media } from '@/types';

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

export const useCollectionStore = create<CollectionStore>()(
  persist(
    (set, get) => ({
      collections: [],
      isLoading: false,

      fetchCollections: async () => {
        set({ isLoading: true });
        try {
          // Load from IndexedDB first
          const localCollections = await db.smartCollections
            .orderBy('updated_at')
            .reverse()
            .toArray();
          
          set({ collections: localCollections });

          // Sync with Supabase if online
          if (navigator.onLine) {
            try {
              const { data, error } = await (supabase as any)
                .from('smart_collections')
                .select('*')
                .order('updated_at', { ascending: false });

              if (!error && data) {
                // Merge: prefer Supabase data
                await db.smartCollections.clear();
                await db.smartCollections.bulkAdd(data as SmartCollection[]);
                set({ collections: data as SmartCollection[] });
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

        // Add to IndexedDB
        await db.smartCollections.add(newCollection);

        // Update state
        set((state) => ({
          collections: [newCollection, ...state.collections],
        }));

        // Sync with Supabase if online
        if (navigator.onLine) {
          try {
            await (supabase as any).from('smart_collections').insert(newCollection);
          } catch (e) {
            console.warn('Failed to sync collection:', e);
          }
        }

        return newCollection;
      },

      updateCollection: async (id, updates) => {
        const updated_at = new Date().toISOString();
        
        // Update IndexedDB
        await db.smartCollections.update(id, { ...updates, updated_at });

        // Update state
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === id ? { ...c, ...updates, updated_at } : c
          ),
        }));

        // Sync with Supabase if online
        if (navigator.onLine) {
          try {
            await (supabase as any)
              .from('smart_collections')
              .update({ ...updates, updated_at })
              .eq('id', id);
          } catch (e) {
            console.warn('Failed to sync collection update:', e);
          }
        }
      },

      deleteCollection: async (id) => {
        // Delete from IndexedDB
        await db.smartCollections.delete(id);

        // Update state
        set((state) => ({
          collections: state.collections.filter((c) => c.id !== id),
        }));

        // Sync with Supabase if online
        if (navigator.onLine) {
          try {
            await (supabase as any).from('smart_collections').delete().eq('id', id);
          } catch (e) {
            console.warn('Failed to sync collection deletion:', e);
          }
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
