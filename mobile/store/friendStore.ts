import { create } from 'zustand';
import { supabase, getCurrentUserId } from '../lib/supabase';
import { findUserByEmail, resolveProfiles, previewInviteCode as previewInviteCodeApi } from '../lib/api/friends';
import type { Friendship, FriendshipWithProfile, FriendActivityEntry } from '../lib/types';

// Ported from the web app's src/store/friendStore.ts - friends are an
// online-only feature (no AsyncStorage cache, no offline queue), same as
// there. Every action goes straight to Supabase; a failure just surfaces
// as an error rather than getting queued for later.

export interface InvitePreview {
  id: string;
  name: string;
  email: string | null;
  imageUrl: string | null;
}

interface FriendStore {
  friends: FriendshipWithProfile[];
  incomingRequests: FriendshipWithProfile[];
  outgoingRequests: FriendshipWithProfile[];
  activity: FriendActivityEntry[];
  myInviteCode: string | null;
  isLoading: boolean;
  isLoadingActivity: boolean;
  isLoadingCode: boolean;
  error: string | null;
  fetchFriends: () => Promise<void>;
  fetchFriendsActivity: () => Promise<void>;
  sendRequest: (email: string) => Promise<{ success: boolean; message: string }>;
  acceptRequest: (friendshipId: string) => Promise<void>;
  declineRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  fetchMyInviteCode: () => Promise<void>;
  regenerateInviteCode: () => Promise<void>;
  previewInviteCode: (code: string) => Promise<{ success: boolean; profile?: InvitePreview; message?: string }>;
  redeemInviteCode: (code: string) => Promise<{ success: boolean; message: string }>;
}

// 8 unambiguous, case-insensitive-safe characters (no 0/O, 1/I/L) - short
// enough to type/read off a screen, long enough (32^8 ≈ 1 trillion
// combinations) that guessing one isn't practical. Same alphabet as web
// (see schema.sql's comment on friend_invite_codes) - the code IS the
// credential, not a shared secret layered on top of something else.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateCode(length = 8): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export const useFriendStore = create<FriendStore>()((set, get) => ({
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  activity: [],
  myInviteCode: null,
  isLoading: false,
  isLoadingActivity: false,
  isLoadingCode: false,
  error: null,

  fetchFriends: async () => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return;

    set({ isLoading: true, error: null });
    try {
      // RLS already scopes this to rows where I'm the requester or addressee.
      const { data, error } = await (supabase as any)
        .from('friendships')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as Friendship[];
      const otherIds = Array.from(
        new Set(rows.map((r) => (r.requester_id === currentUserId ? r.addressee_id : r.requester_id)))
      );

      let profiles: Record<string, FriendshipWithProfile['otherUser']> = {};
      if (otherIds.length > 0) {
        try {
          profiles = await resolveProfiles(otherIds);
        } catch (e) {
          // A transient failure here (the deployed web app's proxy route
          // hiccups, or this app's Clerk token isn't ready yet) shouldn't
          // blank out names that were already resolved on a previous
          // fetch - that's what was flashing "Unknown user" briefly before
          // the next successful refetch fixed it. Fall through to the
          // previously-known profile per id below instead of an empty map.
          console.warn('Failed to resolve friend profiles:', e);
        }
      }

      const previousById = new Map(
        [...get().friends, ...get().incomingRequests, ...get().outgoingRequests]
          .filter((f) => f.otherUser)
          .map((f) => [f.otherUser!.id, f.otherUser!])
      );

      const withProfiles: FriendshipWithProfile[] = rows.map((r) => {
        const otherId = r.requester_id === currentUserId ? r.addressee_id : r.requester_id;
        return { ...r, otherUser: profiles[otherId] ?? previousById.get(otherId) ?? null };
      });

      set({
        friends: withProfiles.filter((f) => f.status === 'accepted'),
        incomingRequests: withProfiles.filter(
          (f) => f.status === 'pending' && f.addressee_id === currentUserId
        ),
        outgoingRequests: withProfiles.filter(
          (f) => f.status === 'pending' && f.requester_id === currentUserId
        ),
      });
    } catch (e) {
      console.error('fetchFriends failed:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to load friends.' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchFriendsActivity: async () => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return;

    set({ isLoadingActivity: true });
    try {
      let { friends } = get();
      if (friends.length === 0) {
        await get().fetchFriends();
        friends = get().friends;
      }
      if (friends.length === 0) {
        set({ activity: [], isLoadingActivity: false });
        return;
      }

      const friendIds = friends.map((f) => f.otherUser?.id).filter((id): id is string => !!id);
      const profileById = new Map(friends.map((f) => [f.otherUser?.id, f.otherUser]));

      // history.media_id -> media.id has a real FK, so PostgREST can embed
      // it directly. RLS applies to the embedded table too, so this only
      // ever returns media rows the "select friends media" policy permits.
      const { data, error } = await (supabase as any)
        .from('history')
        .select('*, media(id, title, type, poster_url)')
        .in('user_id', friendIds)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const entries: FriendActivityEntry[] = (data ?? [])
        .map((row: any) => {
          const profile = profileById.get(row.user_id);
          if (!profile) return null;
          return {
            id: row.id,
            media_id: row.media_id,
            action_type: row.action_type,
            value: row.value,
            previous_value: row.previous_value,
            created_at: row.created_at,
            user_id: row.user_id,
            media: row.media,
            friend: { id: profile.id, name: profile.name, imageUrl: profile.imageUrl },
          };
        })
        .filter((e: FriendActivityEntry | null): e is FriendActivityEntry => e !== null);

      set({ activity: entries });
    } catch (e) {
      console.warn('fetchFriendsActivity failed:', e);
    } finally {
      set({ isLoadingActivity: false });
    }
  },

  sendRequest: async (email) => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return { success: false, message: 'Not signed in.' };

    set({ isLoading: true, error: null });
    try {
      let found;
      try {
        found = await findUserByEmail(email);
      } catch (e) {
        return { success: false, message: e instanceof Error ? e.message : 'User not found.' };
      }

      // Check for an existing row in either direction before inserting -
      // the unique constraint is only on (requester_id, addressee_id) in
      // that exact order, so without this check a reverse-direction
      // request could silently create a duplicate/conflicting relationship.
      const { data: existing } = await (supabase as any)
        .from('friendships')
        .select('*')
        .or(
          `and(requester_id.eq.${currentUserId},addressee_id.eq.${found.id}),and(requester_id.eq.${found.id},addressee_id.eq.${currentUserId})`
        )
        .maybeSingle();

      if (existing) {
        if (existing.status === 'accepted') {
          return { success: false, message: `You're already friends with ${found.name}.` };
        }
        if (existing.status === 'pending' && existing.requester_id === found.id) {
          // They'd already sent a request - accept it instead of duplicating.
          await get().acceptRequest(existing.id);
          return { success: true, message: `Accepted ${found.name}'s existing request.` };
        }
        if (existing.status === 'pending') {
          return { success: false, message: 'Request already sent.' };
        }
        // status === 'declined': only the addressee can UPDATE a row (RLS),
        // so a requester can't self-serve un-decline it - delete and
        // re-create fresh instead.
        const { error: delError } = await (supabase as any)
          .from('friendships')
          .delete()
          .eq('id', existing.id);
        if (delError) throw delError;
      }

      const { error: insError } = await (supabase as any).from('friendships').insert({
        requester_id: currentUserId,
        addressee_id: found.id,
        status: 'pending',
      });
      if (insError) throw insError;

      await get().fetchFriends();
      return { success: true, message: `Friend request sent to ${found.name}.` };
    } catch (e) {
      console.error('sendRequest failed:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Failed to send request.' };
    } finally {
      set({ isLoading: false });
    }
  },

  acceptRequest: async (friendshipId) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await (supabase as any)
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);
      if (error) throw error;
      await get().fetchFriends();
    } catch (e) {
      console.error('acceptRequest failed:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to accept request.' });
    } finally {
      set({ isLoading: false });
    }
  },

  declineRequest: async (friendshipId) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await (supabase as any)
        .from('friendships')
        .update({ status: 'declined' })
        .eq('id', friendshipId);
      if (error) throw error;
      await get().fetchFriends();
    } catch (e) {
      console.error('declineRequest failed:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to decline request.' });
    } finally {
      set({ isLoading: false });
    }
  },

  removeFriend: async (friendshipId) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await (supabase as any).from('friendships').delete().eq('id', friendshipId);
      if (error) throw error;
      set((state) => ({
        friends: state.friends.filter((f) => f.id !== friendshipId),
        incomingRequests: state.incomingRequests.filter((f) => f.id !== friendshipId),
        outgoingRequests: state.outgoingRequests.filter((f) => f.id !== friendshipId),
      }));
    } catch (e) {
      console.error('removeFriend failed:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to remove friend.' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMyInviteCode: async () => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return;

    set({ isLoadingCode: true });
    try {
      const { data, error } = await (supabase as any)
        .from('friend_invite_codes')
        .select('code')
        .eq('user_id', currentUserId)
        .maybeSingle();
      if (error) throw error;

      if (data?.code) {
        set({ myInviteCode: data.code });
        return;
      }

      // First time - generate and persist one. A collision on the global
      // UNIQUE(code) constraint is astronomically unlikely at 8 chars
      // from a 32-symbol alphabet, but retried a few times regardless
      // rather than surfacing a raw constraint error for one bit of bad
      // luck on a random draw.
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateCode();
        const { error: insertError } = await (supabase as any)
          .from('friend_invite_codes')
          .insert({ user_id: currentUserId, code });
        if (!insertError) {
          set({ myInviteCode: code });
          return;
        }
        lastError = insertError;
        if ((insertError as { code?: string })?.code !== '23505') break;
      }
      throw lastError ?? new Error('Failed to generate an invite code.');
    } catch (e) {
      console.error('fetchMyInviteCode failed:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to load your invite code.' });
    } finally {
      set({ isLoadingCode: false });
    }
  },

  regenerateInviteCode: async () => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return;

    set({ isLoadingCode: true, error: null });
    try {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateCode();
        const { error } = await (supabase as any)
          .from('friend_invite_codes')
          .update({ code })
          .eq('user_id', currentUserId);
        if (!error) {
          set({ myInviteCode: code });
          return;
        }
        lastError = error;
        if ((error as { code?: string })?.code !== '23505') break;
      }
      throw lastError ?? new Error('Failed to regenerate your invite code.');
    } catch (e) {
      console.error('regenerateInviteCode failed:', e);
      set({ error: e instanceof Error ? e.message : 'Failed to regenerate your invite code.' });
    } finally {
      set({ isLoadingCode: false });
    }
  },

  previewInviteCode: async (code) => {
    try {
      const profile = await previewInviteCodeApi(code);
      return { success: true, profile };
    } catch (e) {
      console.error('previewInviteCode failed:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Failed to look up this invite.' };
    }
  },

  redeemInviteCode: async (code) => {
    set({ isLoading: true, error: null });
    try {
      const { data: ownerId, error } = await (supabase as any).rpc('redeem_friend_code', {
        target_code: code,
      });
      if (error) throw error;

      await get().fetchFriends();
      const friend = get().friends.find((f) => f.otherUser?.id === ownerId);
      return {
        success: true,
        message: friend?.otherUser?.name ? `You're now connected with ${friend.otherUser.name}.` : "You're connected.",
      };
    } catch (e: any) {
      console.error('redeemInviteCode failed:', e);
      const message =
        e?.message?.includes('invalid_code') ? 'This invite code is invalid.'
        : e?.message?.includes('self_code') ? "That's your own invite code."
        : e instanceof Error ? e.message : 'Failed to redeem this invite.';
      return { success: false, message };
    } finally {
      set({ isLoading: false });
    }
  },
}));
