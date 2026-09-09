import { createClient } from '@supabase/supabase-js';

// Server-only Supabase client using the service role key - bypasses RLS
// entirely. NEVER import this from a 'use client' file or anything that
// could end up in the browser bundle; only from API routes (route.ts).
//
// Its one real use so far: beta_applications has zero RLS policies on
// purpose (see supabase/schema.sql) - public submission happens before
// the person has any session, and review/approval is restricted to one
// specific admin, neither of which maps to a normal auth.jwt()->>'sub'
// policy. The API routes in src/app/api/beta/* do their own validation/
// authorization and use this client to actually read/write.
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin client is not configured (missing URL or service role key)');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export { getSupabaseAdmin };
