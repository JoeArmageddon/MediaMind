import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getCurrentUserId } from '../lib/supabase';
import { resolveProfiles } from '../lib/api/friends';
import type { SmartCollection, SharedCollection, CollectionShareWithProfile } from '../lib/types';

const TABLE = 'smart_collections';
const CACHE_KEY = 'mediamind:collections-cache';

// Ported from the web app's src/store/collectionStore.ts, but online-first
// like this app's mediaStore (Chunk A scope - see that file's comment) -
// an AsyncStorage read cache for instant paint, no Dexie-backed offline
// write queue. Shared collections aren't cached at all, same as web:
// they're another account's live data.

export interface CollectionInvitePreview {
  collection_id: string;
  title: string;
  description: string | null;
  owner_id: string;
  item_count: number;
}

// Same alphabet/length reasoning as friendStore's generateCode - 8
// unambiguous characters, ~1 trillion combinations, the code IS the
// credential (see schema.sql's comment on collection_invite_codes).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateCode(length = 8): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

interface CollectionStore {
  collections: SmartCollection[];
  sharedWithMe: SharedCollection[];
  inviteCodes: Record<string, string>;
  isLoading: boolean;
  isLoadingShared: boolean;
  fetchCollections: () => Promise<void>;
  fetchSharedWithMe: () => Promise<void>;
  addCollection: (
    collection: Omit<SmartCollection, 'id' | 'created_at' | 'updated_at'>
  ) => Promise<SmartCollection>;
  updateCollection: (id: string, updates: Partial<SmartCollection>) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addMediaToCollection: (collectionId: string, mediaId: string) => Promise<void>;
  removeMediaFromCollection: (collectionId: string, mediaId: string) => Promise<void>;
  fetchSharesForCollection: (collectionId: string) => Promise<CollectionShareWithProfile[]>;
  shareCollection: (
    collectionId: string,
    friendUserId: string
  ) => Promise<{ success: boolean; message: string }>;
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

export const useCollectionStore = create<CollectionStore>((set, get) => ({
  collections: [],
  sharedWithMe: [],
  inviteCodes: {},
  isLoading: false,
  isLoadingShared: false,

  fetchCollections: async () => {
    set({ isLoading: true });

    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) set({ collections: JSON.parse(cached) });
    } catch (e) {
      console.warn('Failed to read collections cache:', e);
    }

    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        set({ isLoading: false });
        return;
      }

      // Explicitly scoped to the signed-in user - "select shared
      // collections" RLS also returns collections a friend shared with me,
      // which belong in sharedWithMe (fetchSharedWithMe), not mixed in here.
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .or(`user_id.eq.${currentUserId},user_id.is.null`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const fetched = (data ?? []) as SmartCollection[];
      set({ collections: fetched, isLoading: false });
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fetched)).catch((e) =>
        console.warn('Failed to write collections cache:', e)
      );
    } catch (e) {
      console.error('fetchCollections error:', e);
      set({ isLoading: false });
    }
  },

  addCollection: async (collectionData) => {
    const now = new Date().toISOString();
    const payload = { ...collectionData, created_at: now, updated_at: now };

    const { data, error } = await (supabase as any).from(TABLE).insert(payload).select().single();
    if (error) throw error;

    const newCollection = data as SmartCollection;
    set((state) => {
      const collections = [newCollection, ...state.collections];
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(collections)).catch(() => {});
      return { collections };
    });

    return newCollection;
  },

  updateCollection: async (id, updates) => {
    const updated_at = new Date().toISOString();

    set((state) => ({
      collections: state.collections.map((c) => (c.id === id ? { ...c, ...updates, updated_at } : c)),
    }));

    // .select() to detect a silent 0-row RLS no-op - same fix as
    // mediaStore's updateMedia.
    const { data: updatedRows, error } = await (supabase as any)
      .from(TABLE)
      .update({ ...updates, updated_at })
      .eq('id', id)
      .select('id');

    if (error || !updatedRows || updatedRows.length === 0) {
      throw error ?? new Error('Update did not apply - you may be offline or signed out.');
    }

    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(get().collections)).catch(() => {});
  },

  deleteCollection: async (id) => {
    const previous = get().collections;
    set((state) => ({ collections: state.collections.filter((c) => c.id !== id) }));

    const { error } = await (supabase as any).from(TABLE).delete().eq('id', id);
    if (error) {
      set({ collections: previous });
      throw error;
    }

    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(get().collections)).catch(() => {});
  },

  addMediaToCollection: async (collectionId, mediaId) => {
    const collection = get().collections.find((c) => c.id === collectionId);
    if (!collection || collection.media_ids.includes(mediaId)) return;

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
      // "select own collection shares" RLS returns share rows where I'm
      // either party; "select shared collections" separately returns the
      // collection rows themselves - two round trips since
      // collection_shares.owner_id is a Clerk id, not a Postgres FK
      // PostgREST could embed across.
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

      const ownerIds = Array.from(new Set(shareRows.map((s: any) => s.owner_id))) as string[];
      let profiles: Record<string, { id: string; name: string; imageUrl: string | null }> = {};
      try {
        profiles = await resolveProfiles(ownerIds);
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

      const recipientIds = Array.from(new Set(rows.map((r: any) => r.shared_with_id))) as string[];
      let profiles: Record<string, { id: string; name: string; imageUrl: string | null }> = {};
      try {
        profiles = await resolveProfiles(recipientIds);
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
      const { error } = await (supabase as any).from('collection_shares').delete().eq('id', shareId);
      if (error) throw error;
    } catch (e) {
      console.error('unshareCollection failed:', e);
    }
  },

  // A shared collection isn't cached the way "my" collections are - these
  // write straight to Supabase and patch the in-memory sharedWithMe entry,
  // relying on the "collaborators update shared collections" RLS policy.
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

      // First time - generate and persist one, retried a few times on the
      // astronomically unlikely UNIQUE(code) collision rather than
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

  // Unlike friend invite previews, this needs no server proxy - the RPC
  // itself returns the collection's public preview fields directly (no
  // Clerk profile lookup involved), so this app calls it straight from
  // Supabase, same as web.
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
  // wrapper around updateCollection so call sites read as intent ("make
  // this public") rather than a raw partial-update call.
  setCollectionPublic: async (collectionId, isPublic) => {
    await get().updateCollection(collectionId, { is_public: isPublic });
  },

  // Public collections are viewable by any signed-in user, not just the
  // owner or people it's been shared with - not cached in AsyncStorage or
  // merged into collections/sharedWithMe (this is someone else's
  // collection, viewed read-only, not "mine" in either sense). Deliberately
  // doesn't resolve the owner's profile - unlike friend/share-recipient
  // lookups, a public collection's viewer and owner aren't necessarily
  // connected, and /api/friends/profiles only resolves ids that are
  // verifiably the caller's own friend - so the view stays anonymous
  // rather than adding a new arbitrary-id-to-profile lookup.
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
}));
