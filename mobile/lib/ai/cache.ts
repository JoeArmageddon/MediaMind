import { supabase } from '../supabase';

// Ported directly from src/lib/ai/cache.ts - a shared, server-side cache
// (the `ai_cache` Supabase table) rather than per-device storage, so a
// lookup for the same stable input (a title, mostly) is shared across
// every device/platform, mobile included. Only used for calls whose
// result only depends on a stable input - not recommendations, which
// depend on the current state of the whole library.
export async function withAICache<T>(
  responseType: string,
  keyInput: string,
  ttlMs: number,
  compute: () => Promise<T | null>
): Promise<T | null> {
  const cacheKey = `${responseType}:${keyInput.trim().toLowerCase()}`;

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

  const result = await compute();

  if (result !== null) {
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
