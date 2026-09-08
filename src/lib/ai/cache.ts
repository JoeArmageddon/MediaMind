import { supabase } from '@/lib/db/supabase';

/**
 * Wraps an AI call with a shared, server-side cache (the `ai_cache` Supabase
 * table - defined in supabase/schema.sql but never previously used). Cuts
 * redundant Groq/Gemini calls (and their latency/cost) when the same stable
 * input - e.g. the same title - is looked up again, including across
 * different library entries or devices, since the cache lives in Supabase
 * rather than per-browser.
 *
 * Only used for calls whose result only depends on a stable input (title,
 * mostly unchanging metadata) - NOT for things like recommendations that
 * depend on the current state of the whole library.
 */
export async function withAICache<T>(
  responseType: string,
  keyInput: string,
  ttlMs: number,
  compute: () => Promise<T | null>
): Promise<T | null> {
  const cacheKey = `${responseType}:${keyInput.trim().toLowerCase()}`;
  const online = typeof navigator === 'undefined' || navigator.onLine;

  if (online) {
    try {
      const { data, error } = await (supabase as any)
        .from('ai_cache')
        .select('response_data, expires_at')
        .eq('cache_key', cacheKey)
        .maybeSingle();

      if (!error && data && new Date(data.expires_at).getTime() > Date.now()) {
        return data.response_data as T;
      }
    } catch (e) {
      console.warn(`AI cache read failed for ${responseType}:`, e);
    }
  }

  const result = await compute();

  if (result !== null && online) {
    try {
      await (supabase as any).from('ai_cache').upsert(
        {
          cache_key: cacheKey,
          response_type: responseType,
          response_data: result,
          expires_at: new Date(Date.now() + ttlMs).toISOString(),
        },
        { onConflict: 'cache_key' }
      );
    } catch (e) {
      console.warn(`AI cache write failed for ${responseType}:`, e);
    }
  }

  return result;
}

export const AI_CACHE_TTL = {
  THIRTY_DAYS: 30 * 24 * 60 * 60 * 1000,
} as const;
