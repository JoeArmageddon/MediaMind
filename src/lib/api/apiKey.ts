import { getApiKey } from '@/lib/db/dexie';

/**
 * Resolves an API key: checks IndexedDB/localStorage (user-entered via
 * Settings) first, falling back to a NEXT_PUBLIC_* env var. Always trims
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
 */
export async function resolveApiKey(dexieKeyName: string, envValue: string | undefined): Promise<string> {
  const stored = await getApiKey(dexieKeyName);
  const resolved = stored || envValue || '';
  return resolved.trim();
}
