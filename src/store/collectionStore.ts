import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { db } from '@/lib/db/dexie';
import { supabase } from '@/lib/db/supabase';
import type { SmartCollection, SharedCollection, CollectionShareWithProfile } from '@/types';

const TABLE = 'smart_collections';

function getCurrentUserId(): string | undefined {
  return typeof window !== 'undefined' ? window.Clerk?.user?.id : undefined;
}

export interface CollectionInvitePreview {
  collection_id: string;
  title: string;
  description: string | null;
  owner_id: string;
  item_count: number;
}

interface CollectionStore {
  collections: SmartCollection[];
  sharedWithMe: SharedCollection[];
  inviteCodes: Record<string, string>;
  isLoading: boolean;
  isLoadingShared: boolean;
  fetchCollections: () => Promise<void>;
  fetchSharedWithMe: () => Promise<void>;
  addCollection: (collection: Omit<SmartCollection, 'id' | 'created_at' | 'updated_at'>) => Promise<SmartCollection>;
  updateCollection: (id: string, updates: Partial<SmartCollection>) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addMediaToCollection: (collectionId: string, mediaId: string) => Promise<void>;
  removeMediaFromCollection: (collectionId: string, mediaId: string) => Promise<void>;
  fetchSharesForCollection: (collectionId: string) => Promise<CollectionShareWithProfile[]>;
  shareCollection: (collectionId: string, friendUserId: string) => Promise<{ success: boolean; message: string }>;
  unshareCollection: (shareId: string) => Promise<void>;
  addMediaToSharedCollection: (collectionId: string, mediaId: string) => Promise<void>;
  removeMediaFromSharedCollection: (collectionId: string, mediaId: string) => Promise<void>;
  fetchCollectionInviteCode: (collectionId: string) => Promise<void>;
  regenerateCollectionInviteCode: (collectionId: string) => Promise<void>;
  previewCollectionCode: (
    code: string
  ) => Promise<{ success: boolean; preview?: CollectionInvitePreview; message?: string }>;
  redeemCollectionCode: (code: string) => Promise<{ success: boolean; collectionId?: string; message: string }>;
  setCollectionPublic: (collectionId: string, isPublic: boolean) => Promise<void>;
  fetchPublicCollection: (collectionId: string) => Promise<SmartCollection | null>;
}

// Same alphabet/length reasoning as friendStore's generateCode - 8
// unambiguous characters, ~1 trillion combinations, the code IS the
// credential (see the schema.sql comment on collection_invite_codes).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateCode(length = 8): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
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
      sharedWithMe: [],
      inviteCodes: {},
      isLoading: false,
      isLoadingShared: false,

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
              // Explicitly scoped to the signed-in user - the "select shared
              // collections" RLS policy means an unfiltered select('*') here
              // would also pull in collections a friend shared with me,
              // mixing them into "my" collections instead of staying
              // separate (see fetchSharedWithMe for that).
              const currentUserId = getCurrentUserId();
              let query = (supabase as any)
                .from(TABLE)
                .select('*')
                .order('updated_at', { ascending: false });
              if (currentUserId) {
                query = query.or(`user_id.eq.${currentUserId},user_id.is.null`);
              }
              const { data, error } = await query;

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
            // .select() to detect a silent 0-row RLS no-op - without it, an
            // update blocked by RLS (e.g. a momentarily stale/unresolved
            // auth token on this one request) comes back as { error: null }
            // exactly like a real success, same as mediaStore's version of
            // this bug.
            const { data: updatedRows, error } = await (supabase as any)
              .from(TABLE)
              .update({ ...updates, updated_at })
              .eq('id', id)
              .select('id');
            if (error || !updatedRows || updatedRows.length === 0) {
              throw error ?? new Error('0 rows affected - likely blocked by RLS on a stale token');
            }
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
            // Delete is idempotent - 0 rows matched is as much "this
            // collection is gone" as 1 row matched, so only a real `error`
            // counts as failure (unlike update, where 0 rows means a
            // specific change didn't land).
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

      fetchSharedWithMe: async () => {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) return;

        set({ isLoadingShared: true });
        try {
          // "select shared collections" RLS returns collection rows shared
          // with me; "select own collection shares" lets me read the share
          // rows themselves to know whose they are and resolve owner
          // profiles - two round trips since there's no FK PostgREST can
          // embed across (collection_shares.owner_id is a Clerk id, not a
          // foreign key into any Postgres table).
          const { data: shares, error: sharesError } = await (supabase as any)
            .from('collection_shares')
            .select('*')
            .eq('shared_with_id', currentUserId);
          if (sharesError) throw sharesError;

          const shareRows = shares ?? [];
          if (shareRows.length === 0) {
            set({ sharedWithMe: [], isLoadingShared: false });
            return;
          }

          const collectionIds = Array.from(new Set(shareRows.map((s: any) => s.collection_id)));
          const { data: collections, error: collectionsError } = await (supabase as any)
            .from(TABLE)
            .select('*')
            .in('id', collectionIds);
          if (collectionsError) throw collectionsError;

          const ownerIds = Array.from(new Set(shareRows.map((s: any) => s.owner_id)));
          let profiles: Record<string, { id: string; name: string; imageUrl: string | null }> = {};
          try {
            const res = await fetch('/api/friends/profiles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userIds: ownerIds }),
            });
            if (res.ok) {
              const json = await res.json();
              profiles = json.profiles ?? {};
            }
          } catch (e) {
            console.warn('Failed to resolve collection owner profiles:', e);
          }

          const ownerByCollectionId = new Map<string, string>(
            shareRows.map((s: any) => [s.collection_id as string, s.owner_id as string])
          );

          const withOwner: SharedCollection[] = (collections ?? []).map((c: SmartCollection) => {
            const ownerId = ownerByCollectionId.get(c.id);
            return { ...c, owner: (ownerId && profiles[ownerId]) || null };
          });

          set({ sharedWithMe: withOwner });
        } catch (e) {
          console.warn('fetchSharedWithMe failed:', e);
        } finally {
          set({ isLoadingShared: false });
        }
      },

      fetchSharesForCollection: async (collectionId) => {
        try {
          const { data, error } = await (supabase as any)
            .from('collection_shares')
            .select('*')
            .eq('collection_id', collectionId);
          if (error) throw error;

          const rows = data ?? [];
          if (rows.length === 0) return [];

          const recipientIds = Array.from(new Set(rows.map((r: any) => r.shared_with_id)));
          let profiles: Record<string, { id: string; name: string; imageUrl: string | null }> = {};
          try {
            const res = await fetch('/api/friends/profiles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userIds: recipientIds }),
            });
            if (res.ok) {
              const json = await res.json();
              profiles = json.profiles ?? {};
            }
          } catch (e) {
            console.warn('Failed to resolve share recipient profiles:', e);
          }

          return rows.map((r: any) => ({ ...r, recipient: profiles[r.shared_with_id] ?? null }));
        } catch (e) {
          console.warn('fetchSharesForCollection failed:', e);
          return [];
        }
      },

      shareCollection: async (collectionId, friendUserId) => {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) return { success: false, message: 'Not signed in.' };

        try {
          const { error } = await (supabase as any).from('collection_shares').insert({
            collection_id: collectionId,
            owner_id: currentUserId,
            shared_with_id: friendUserId,
          });
          if (error) {
            // Unique violation just means it's already shared with them.
            if (error.code === '23505') {
              return { success: false, message: 'Already shared with this friend.' };
            }
            throw error;
          }
          return { success: true, message: 'Collection shared.' };
        } catch (e) {
          console.error('shareCollection failed:', e);
          return {
            success: false,
            message: e instanceof Error ? e.message : 'Failed to share collection.',
          };
        }
      },

      unshareCollection: async (shareId) => {
        try {
          const { error } = await (supabase as any)
            .from('collection_shares')
            .delete()
            .eq('id', shareId);
          if (error) throw error;
        } catch (e) {
          console.error('unshareCollection failed:', e);
        }
      },

      // A shared collection isn't cached in Dexie the way "my" collections
      // are (see fetchSharedWithMe) - these write straight to Supabase and
      // patch the in-memory sharedWithMe entry, relying on the
      // "collaborators update shared collections" RLS policy to allow it.
      addMediaToSharedCollection: async (collectionId, mediaId) => {
        const target = get().sharedWithMe.find((c) => c.id === collectionId);
        if (!target || target.media_ids.includes(mediaId)) return;

        const updatedMediaIds = [...target.media_ids, mediaId];
        const updated_at = new Date().toISOString();
        const { error } = await (supabase as any)
          .from(TABLE)
          .update({ media_ids: updatedMediaIds, updated_at })
          .eq('id', collectionId);
        if (error) throw error;

        set((state) => ({
          sharedWithMe: state.sharedWithMe.map((c) =>
            c.id === collectionId ? { ...c, media_ids: updatedMediaIds, updated_at } : c
          ),
        }));
      },

      removeMediaFromSharedCollection: async (collectionId, mediaId) => {
        const target = get().sharedWithMe.find((c) => c.id === collectionId);
        if (!target) return;

        const updatedMediaIds = target.media_ids.filter((id) => id !== mediaId);
        const updated_at = new Date().toISOString();
        const { error } = await (supabase as any)
          .from(TABLE)
          .update({ media_ids: updatedMediaIds, updated_at })
          .eq('id', collectionId);
        if (error) throw error;

        set((state) => ({
          sharedWithMe: state.sharedWithMe.map((c) =>
            c.id === collectionId ? { ...c, media_ids: updatedMediaIds, updated_at } : c
          ),
        }));
      },

      fetchCollectionInviteCode: async (collectionId) => {
        try {
          const { data, error } = await (supabase as any)
            .from('collection_invite_codes')
            .select('code')
            .eq('collection_id', collectionId)
            .maybeSingle();
          if (error) throw error;

          if (data?.code) {
            set((state) => ({ inviteCodes: { ...state.inviteCodes, [collectionId]: data.code } }));
            return;
          }

          // First time - generate and persist one, retried a few times on
          // the astronomically unlikely UNIQUE(code) collision rather than
          // surfacing a raw constraint error for one bit of bad luck.
          let lastError: unknown = null;
          for (let attempt = 0; attempt < 5; attempt++) {
            const code = generateCode();
            const { error: insertError } = await (supabase as any)
              .from('collection_invite_codes')
              .insert({ collection_id: collectionId, code });
            if (!insertError) {
              set((state) => ({ inviteCodes: { ...state.inviteCodes, [collectionId]: code } }));
              return;
            }
            lastError = insertError;
            if ((insertError as { code?: string })?.code !== '23505') break;
          }
          throw lastError ?? new Error('Failed to generate an invite code.');
        } catch (e) {
          console.error('fetchCollectionInviteCode failed:', e);
        }
      },

      regenerateCollectionInviteCode: async (collectionId) => {
        try {
          let lastError: unknown = null;
          for (let attempt = 0; attempt < 5; attempt++) {
            const code = generateCode();
            const { error } = await (supabase as any)
              .from('collection_invite_codes')
              .update({ code })
              .eq('collection_id', collectionId);
            if (!error) {
              set((state) => ({ inviteCodes: { ...state.inviteCodes, [collectionId]: code } }));
              return;
            }
            lastError = error;
            if ((error as { code?: string })?.code !== '23505') break;
          }
          throw lastError ?? new Error('Failed to regenerate the invite code.');
        } catch (e) {
          console.error('regenerateCollectionInviteCode failed:', e);
        }
      },

      previewCollectionCode: async (code) => {
        try {
          const { data, error } = await (supabase as any).rpc('preview_collection_code', { target_code: code });
          if (error || !data || data.length === 0) {
            return { success: false, message: 'This collection invite is invalid or has expired.' };
          }
          return { success: true, preview: data[0] as CollectionInvitePreview };
        } catch (e) {
          console.error('previewCollectionCode failed:', e);
          return { success: false, message: e instanceof Error ? e.message : 'Failed to look up this invite.' };
        }
      },

      redeemCollectionCode: async (code) => {
        try {
          const { data: collectionId, error } = await (supabase as any).rpc('redeem_collection_code', {
            target_code: code,
          });
          if (error) throw error;

          await get().fetchSharedWithMe();
          return { success: true, collectionId, message: "You've joined this collection." };
        } catch (e: any) {
          console.error('redeemCollectionCode failed:', e);
          const message =
            e?.message?.includes('invalid_code') ? 'This invite code is invalid.'
            : e?.message?.includes('self_code') ? "That's your own collection."
            : e instanceof Error ? e.message : 'Failed to join this collection.';
          return { success: false, message };
        }
      },

      // Owner-only in practice (RLS's "update own or claim unclaimed
      // collections" policy enforces that server-side) - a thin, named
      // wrapper around updateCollection so call sites read as intent
      // ("make this public") rather than a raw partial-update call.
      setCollectionPublic: async (collectionId, isPublic) => {
        await get().updateCollection(collectionId, { is_public: isPublic });
      },

      // Public collections are viewable by any signed-in user, not just the
      // owner or people it's been shared with - not cached in Dexie or
      // merged into `collections`/`sharedWithMe` (this is someone else's
      // collection, viewed read-only, not "mine" in either sense). Deliberately
      // doesn't resolve the owner's profile - unlike friend/share-recipient
      // lookups, a public collection's viewer and owner aren't necessarily
      // connected in any way, and /api/friends/profiles only resolves ids
      // that are verifiably the caller's own friend - so the view stays
      // anonymous rather than adding a new arbitrary-id-to-profile lookup.
      fetchPublicCollection: async (collectionId) => {
        try {
          const { data, error } = await (supabase as any)
            .from(TABLE)
            .select('*')
            .eq('id', collectionId)
            .eq('is_public', true)
            .maybeSingle();
          if (error) throw error;
          return (data as SmartCollection) ?? null;
        } catch (e) {
          console.warn('fetchPublicCollection failed:', e);
          return null;
        }
      },
    }),
    {
      name: 'collection-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ collections: state.collections }),
    }
  )
);
