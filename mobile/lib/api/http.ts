// Ported verbatim from the web app's src/lib/api/http.ts - pure
// fetch/Promise logic, no DOM dependency.

/** Races a promise against a timeout, rejecting with a labeled error if it fires first. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Retries `fn` with exponential backoff (1s, 2s, 4s, ...). A user-initiated
 * cancellation (AbortError) is never retried - it's not a transient
 * failure, and retrying would just burn time the caller has already
 * stopped waiting for.
 */
export async function withRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 2): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (error instanceof Error && error.name === 'AbortError') throw error;

      console.warn(`[${label}] Attempt ${i + 1} failed:`, error instanceof Error ? error.message : error);

      if (i < maxRetries) {
        const delay = 1000 * Math.pow(2, i);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/** fetch() with both a timeout and support for an external AbortSignal (e.g. a user cancel button). */
export async function fetchWithTimeout(
  url: string,
  ms: number,
  label: string,
  init: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  const onExternalAbort = () => controller.abort();
  init.signal?.addEventListener('abort', onExternalAbort);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (init.signal?.aborted) throw error; // real cancellation - propagate as-is
      throw new Error(`${label} timeout after ${ms}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    init.signal?.removeEventListener('abort', onExternalAbort);
  }
}
