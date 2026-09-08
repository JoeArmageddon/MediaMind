import { getClerkToken } from '../supabase';

// Clerk doesn't allow client-side code to resolve other users by email
// or look up a user profile by id (privacy) - those lookups need the
// Clerk secret key, server-side. The web app already has that server side
// (src/app/api/friends/find, src/app/api/friends/profiles) and is
// deployed; mobile has no server of its own, so rather than standing up a
// second backend just for two lookups, these hit the same deployed routes
// over HTTPS. It's the same Clerk application (same publishable key) as
// the web app, so a Bearer token from this app's Clerk session
// authenticates there too - Clerk's Next.js middleware/`auth()` accepts a
// session token via the Authorization header for exactly this
// cross-origin/native-client case, not just its own first-party cookie.
const WEB_API_URL = process.env.EXPO_PUBLIC_WEB_API_URL?.trim();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A rejection the server actually meant (bad token, no such user, bad
// input) - retrying changes nothing, so this always propagates on the
// first attempt. Anything else (thrown before/without a real response -
// a network hiccup, or the deployed serverless function cold-starting) is
// the transient case, worth one retry with a short backoff. This is what
// was making friend names flash to "Unknown user" and then self-correct a
// moment later - a lookup timing out once, not actually failing.
class ClientRejection extends Error {}

async function callWebApi<T>(path: string, body: unknown): Promise<T> {
  if (!WEB_API_URL) {
    throw new Error('Missing EXPO_PUBLIC_WEB_API_URL - check mobile/.env');
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await delay(600);
    try {
      const token = await getClerkToken();
      if (!token) {
        throw new ClientRejection('Not signed in.');
      }
      const res = await fetch(`${WEB_API_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = json?.error || `Request failed (${res.status})`;
        if (res.status < 500) throw new ClientRejection(message);
        throw new Error(message);
      }
      return json as T;
    } catch (e) {
      lastError = e;
      if (e instanceof ClientRejection) throw e;
      // else: network error or 5xx - loop around and retry once.
    }
  }
  throw lastError;
}

export interface FoundUser {
  id: string;
  name: string;
  email: string | null;
  imageUrl: string | null;
}

export async function findUserByEmail(email: string): Promise<FoundUser> {
  return callWebApi<FoundUser>('/api/friends/find', { email });
}

export async function resolveProfiles(
  userIds: string[]
): Promise<Record<string, FoundUser>> {
  if (userIds.length === 0) return {};
  const { profiles } = await callWebApi<{ profiles: Record<string, FoundUser> }>(
    '/api/friends/profiles',
    { userIds }
  );
  return profiles;
}
