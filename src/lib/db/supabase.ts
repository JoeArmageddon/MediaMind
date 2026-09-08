import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// .trim() guards against a CRLF-line-ended .env.local silently appending a
// trailing \r to the value (confirmed as a real bug in this project - it
// broke the Supabase URL's DNS resolution with no obvious error).
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Clerk (not Supabase Auth) owns the session now - RLS policies read the
// signed-in user's id via auth.jwt()->>'sub' (see supabase/schema.sql).
// This callback runs before every request and must return a fresh Clerk
// session token. window.Clerk is Clerk's documented global instance,
// populated once <ClerkProvider> has mounted; since every store that calls
// Supabase only ever runs client-side after mount, it's reliably available
// by the time any real request happens. Returning null (signed out, or
// Clerk not yet loaded) just falls back to the anon role - RLS then denies
// anything requiring a real user_id, which is the correct behavior.
declare global {
  interface Window {
    Clerk?: {
      session?: {
        getToken: () => Promise<string | null>;
      } | null;
      user?: {
        id: string;
      } | null;
    };
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  async accessToken() {
    if (typeof window === 'undefined') return null;
    try {
      return (await window.Clerk?.session?.getToken()) ?? null;
    } catch {
      return null;
    }
  },
  db: {
    schema: 'public',
  },
});

// Real-time subscriptions
export const subscribeToMedia = (callback: (payload: unknown) => void) => {
  return supabase
    .channel('media_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'media' },
      callback
    )
    .subscribe();
};

export const subscribeToHistory = (callback: (payload: unknown) => void) => {
  return supabase
    .channel('history_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'history' },
      callback
    )
    .subscribe();
};
