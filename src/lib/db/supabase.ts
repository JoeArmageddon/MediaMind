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

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
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
