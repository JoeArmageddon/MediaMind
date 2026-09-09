import { getClerkToken } from './supabase';

// Base for calling the deployed web app's server-side API routes from this
// app, which has no backend of its own. It's the same Clerk application as
// EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, so a Bearer token from this app's
// Clerk session authenticates there too - Clerk's Next.js `auth()` accepts
// a session token via the Authorization header for exactly this
// cross-origin/native-client case, not just its own first-party cookie.
// Originally written for lib/api/friends.ts's email/profile lookups (which
// need the Clerk secret key, server-side only); reused here for the
// server-held-default-key AI/search proxies below, for the same underlying
// reason - anything that needs a real secret has to run on the deployed
// server, never bundled into this app's JS.
const WEB_API_URL = process.env.EXPO_PUBLIC_WEB_API_URL?.trim();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A rejection the server actually meant (bad token, bad input, out of
// quota) - retrying changes nothing, so this always propagates on the
// first attempt. Anything else (thrown before/without a real response - a
// network hiccup, or the deployed serverless function cold-starting) is
// the transient case, worth one retry with a short backoff.
export class ClientRejection extends Error {}

function requireWebApiUrl(): string {
  if (!WEB_API_URL) {
    throw new Error('Missing EXPO_PUBLIC_WEB_API_URL - check mobile/.env');
  }
  return WEB_API_URL;
}

async function authHeader(): Promise<{ Authorization: string }> {
  const token = await getClerkToken();
  if (!token) throw new ClientRejection('Not signed in.');
  return { Authorization: `Bearer ${token}` };
}

// POST helper for routes that return a single wrapped JSON object (always
// `{ ...fields }` on success, `{ error }` on failure) - friends/*, ai/*,
// beta/*.
export async function callWebApi<T>(path: string, body: unknown): Promise<T> {
  const base = requireWebApiUrl();
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await delay(600);
    try {
      const headers = await authHeader();
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
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

// GET helper for the plain passthrough proxies (/api/external/tmdb,
// /api/external/rawg) - these hand back the provider's raw response body
// and status as-is, not a wrapped `{..}` shape, so this returns the raw
// Response rather than unifying error handling the way callWebApi does.
// Callers already know how to interpret their own provider's status codes
// (e.g. RAWGClient treats 404 as "not found", not an error).
export async function callWebApiGet(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal
): Promise<Response> {
  const base = requireWebApiUrl();
  const headers = await authHeader();
  const url = new URL(`${base}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await delay(600);
    try {
      const res = await fetch(url.toString(), { headers, signal });
      if (res.status >= 500) {
        lastError = new Error(`Request failed (${res.status})`);
        continue; // one retry on a transient server error
      }
      return res;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') throw e;
      lastError = e;
    }
  }
  throw lastError;
}
