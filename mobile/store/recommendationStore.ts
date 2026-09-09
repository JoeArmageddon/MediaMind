import { create } from 'zustand';
import { supabase, getCurrentUserId } from '../lib/supabase';
import { resolveProfiles } from '../lib/api/friends';
import type { Media, Recommendation, RecommendationWithProfile } from '../lib/types';

// Ported from web's src/store/recommendationStore.ts - recommendations are
// an inherently online, friend-to-friend feature, same reasoning as
// friendStore/collectionStore: no AsyncStorage cache, no offline queue. A
// failure just surfaces as an error rather than getting queued.

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
      let profiles: Record<string, { id: string; name: string; imageUrl: string | null }> = {};
      try {
        profiles = await resolveProfiles(fromIds);
      } catch (e) {
        console.warn('Failed to resolve recommendation sender profiles:', e);
      }

      set({ inbox: rows.map((r) => ({ ...r, otherUser: profiles[r.from_user_id] ?? null })) });
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
      let profiles: Record<string, { id: string; name: string; imageUrl: string | null }> = {};
      try {
        profiles = await resolveProfiles(toIds);
      } catch (e) {
        console.warn('Failed to resolve recommendation recipient profiles:', e);
      }

      set({ sent: rows.map((r) => ({ ...r, otherUser: profiles[r.to_user_id] ?? null })) });
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
      return { success: false, message: e instanceof Error ? e.message : 'Failed to send this recommendation.' };
    }
  },

  markRead: async (id) => {
    set((state) => ({
      inbox: state.inbox.map((r) => (r.id === id ? { ...r, is_read: true } : r)),
    }));
    try {
      const { error } = await (supabase as any).from('recommendations').update({ is_read: true }).eq('id', id);
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
