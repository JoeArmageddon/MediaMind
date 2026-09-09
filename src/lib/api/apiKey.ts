import { getApiKey } from '@/lib/db/dexie';

/**
 * Resolves an API key: checks IndexedDB/localStorage (user-entered via
 * Settings) first, optionally falling back to a second value. Always trims
 * the result.
 *
 * Why this matters: a .env.local file with CRLF line endings (common when
 * saved by certain editors, or copy-pasted from Windows sources) silently
 * appends a trailing \r to the last line's value. That corrupted value then
 * flows straight into API requests with no obvious error - TMDB/RAWG/Books
 * return 401s that look like "no results", a corrupted Supabase URL fails
 * DNS resolution outright. This was confirmed as a real, live bug in this
 * project (see git history) - every single var in .env.local had a
 * trailing \r, breaking TMDB search entirely. Trimming defensively here
 * means it can't silently recur even if a future edit reintroduces it.
 *
 * NEVER pass a NEXT_PUBLIC_* env var as envValue. This function (and every
 * *Client that calls it - tmdb/rawg/books/gemini/groq) runs in the
 * browser, and Next.js inlines any NEXT_PUBLIC_ var straight into the
 * public JS bundle - a "bundled default" API key passed this way is
 * trivially extractable by anyone (view source / network tab) and usable
 * against your own quota/billing. This was a real, live finding
 * (NEXT_PUBLIC_GEMINI_API_KEY was actually set in production) - every
 * call site was fixed to pass `undefined` instead, requiring each user's
 * own key. If a bundled default is ever wanted again, it has to be served
 * through a server API route using a non-public env var, never read here.
 */
export async function resolveApiKey(dexieKeyName: string, envValue: string | undefined): Promise<string> {
  const stored = await getApiKey(dexieKeyName);
  const resolved = stored || envValue || '';
  return resolved.trim();
}
