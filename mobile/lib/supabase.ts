import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// .trim() guards against the same class of bug the web app hit for real:
// a CRLF-corrupted .env.local silently appending a trailing \r to a value,
// breaking DNS resolution with no obvious error. Cheap insurance here too.
export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY - check mobile/.env'
  );
}

// Same accessToken-callback pattern as the web app's src/lib/db/supabase.ts
// (Clerk owns the session, RLS reads auth.jwt()->>'sub') - but React Native
// has no `window.Clerk` global to read a fresh token from directly. Instead,
// AuthTokenBridge (in app/_layout.tsx) calls setClerkTokenGetter() once
// Clerk's useAuth() hook is available, handing this module a function that
// always returns the current token. Returning null (signed out, or Clerk
// not yet loaded) falls back to the anon role - RLS then denies anything
// requiring a real user_id, which is the correct behavior.
let clerkTokenGetter: (() => Promise<string | null>) | null = null;

export function setClerkTokenGetter(getter: (() => Promise<string | null>) | null) {
  clerkTokenGetter = getter;
}

// Same bridge pattern for the signed-in user's id - mediaStore needs this
// to scope its own queries explicitly (RLS also permits reading an
// accepted friend's rows once Chunk D lands on mobile, same as web, so
// "RLS returned it" stops being equivalent to "it's mine" and every
// my-library query needs its own explicit filter).
let currentUserIdGetter: (() => string | undefined) | null = null;

export function setCurrentUserIdGetter(getter: (() => string | undefined) | null) {
  currentUserIdGetter = getter;
}

export function getCurrentUserId(): string | undefined {
  return currentUserIdGetter?.();
}

// Same bridge, exposed as a raw token getter for call sites that need to
// attach it to a plain fetch's Authorization header (the friends feature's
// calls to the deployed web app's API routes - see lib/api/friends.ts)
// rather than handing it to the Supabase client.
export async function getClerkToken(): Promise<string | null> {
  try {
    return (await clerkTokenGetter?.()) ?? null;
  } catch {
    return null;
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => {
    try {
      return (await clerkTokenGetter?.()) ?? null;
    } catch {
      return null;
    }
  },
  auth: {
    // Clerk owns the session, not Supabase Auth - no point in Supabase
    // trying to persist/refresh a session of its own.
    persistSession: false,
    autoRefreshToken: false,
  },
});
