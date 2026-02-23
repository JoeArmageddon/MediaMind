import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
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
