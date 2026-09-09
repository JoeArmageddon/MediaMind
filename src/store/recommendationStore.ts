import { create } from 'zustand';
import { supabase } from '@/lib/db/supabase';
import type { Media, Recommendation, RecommendationWithProfile } from '@/types';

// Recommendations are an inherently online, friend-to-friend feature - same
// reasoning as friendStore: no Dexie caching, no offline queue. A failure
// just surfaces as an error rather than getting queued.

function getCurrentUserId(): string | undefined {
  return typeof window !== 'undefined' ? window.Clerk?.user?.id : undefined;
}

interface RecommendationStore {
  inbox: RecommendationWithProfile[];
  sent: RecommendationWithProfile[];
  isLoading: boolean;
  fetchInbox: () => Promise<void>;
  fetchSent: () => Promise<void>;
  send: (toUserId: string, media: Media, message: string) => Promise<{ success: boolean; message: string }>;
  markRead: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
}

async function resolveProfiles(userIds: string[]) {
  let profiles: Record<string, { id: string; name: string; email: string | null; imageUrl: string | null }> = {};
  if (userIds.length === 0) return profiles;
  try {
    const res = await fetch('/api/friends/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds }),
    });
    if (res.ok) {
      const json = await res.json();
      profiles = json.profiles ?? {};
    }
  } catch (e) {
    console.warn('Failed to resolve recommendation profiles:', e);
  }
  return profiles;
}

export const useRecommendationStore = create<RecommendationStore>()((set, get) => ({
  inbox: [],
  sent: [],
  isLoading: false,

  fetchInbox: async () => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return;

    set({ isLoading: true });
    try {
      const { data, error } = await (supabase as any)
        .from('recommendations')
        .select('*')
        .eq('to_user_id', currentUserId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as Recommendation[];
      const fromIds = Array.from(new Set(rows.map((r) => r.from_user_id)));
      const profiles = await resolveProfiles(fromIds);

      set({
        inbox: rows.map((r) => ({ ...r, otherUser: profiles[r.from_user_id] ?? null })),
      });
    } catch (e) {
      console.warn('fetchInbox failed:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSent: async () => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return;

    try {
      const { data, error } = await (supabase as any)
        .from('recommendations')
        .select('*')
        .eq('from_user_id', currentUserId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as Recommendation[];
      const toIds = Array.from(new Set(rows.map((r) => r.to_user_id)));
      const profiles = await resolveProfiles(toIds);

      set({
        sent: rows.map((r) => ({ ...r, otherUser: profiles[r.to_user_id] ?? null })),
      });
    } catch (e) {
      console.warn('fetchSent failed:', e);
    }
  },

  send: async (toUserId, media, message) => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return { success: false, message: 'Not signed in.' };

    try {
      const { error } = await (supabase as any).from('recommendations').insert({
        from_user_id: currentUserId,
        to_user_id: toUserId,
        title: media.title,
        type: media.type,
        poster_url: media.poster_url,
        description: media.description,
        release_year: media.release_year,
        api_rating: media.api_rating,
        genres: media.genres,
        tmdb_id: media.tmdb_id,
        mal_id: media.mal_id,
        rawg_id: media.rawg_id,
        google_books_id: media.google_books_id,
        message: message.trim() || null,
      });
      if (error) throw error;

      await get().fetchSent();
      return { success: true, message: `Sent "${media.title}".` };
    } catch (e) {
      console.error('send recommendation failed:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to send this recommendation.',
      };
    }
  },

  markRead: async (id) => {
    set((state) => ({
      inbox: state.inbox.map((r) => (r.id === id ? { ...r, is_read: true } : r)),
    }));
    try {
      const { error } = await (supabase as any)
        .from('recommendations')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn('markRead failed:', e);
    }
  },

  dismiss: async (id) => {
    set((state) => ({
      inbox: state.inbox.filter((r) => r.id !== id),
      sent: state.sent.filter((r) => r.id !== id),
    }));
    try {
      const { error } = await (supabase as any).from('recommendations').delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn('dismiss recommendation failed:', e);
    }
  },
}));
