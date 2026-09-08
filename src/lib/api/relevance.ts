/**
 * Title-relevance scoring for search results.
 *
 * Previously, `SearchResult.confidence` (shown to users as "% match" and
 * used to sort/rank results) was derived purely from each API's own
 * rating/score field (TMDB vote_average, Jikan score, RAWG rating, Google
 * Books averageRating) - it had nothing to do with how well the result
 * actually matched the search query. That meant a highly-rated but
 * unrelated title could rank above the exact thing being searched for, and
 * the "% match" badge was really a "% rating" badge. This scores how
 * closely a result's title matches the query and blends that in as the
 * dominant ranking signal, with the original rating-derived score only
 * breaking ties among similarly-relevant results.
 */

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents (e.g. "é" -> "e")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function titleRelevance(query: string, title: string): number {
  const q = normalizeForMatch(query);
  const t = normalizeForMatch(title);
  if (!q || !t) return 0.2;

  if (t === q) return 1;
  if (t.startsWith(q) || q.startsWith(t)) return 0.9;
  if (t.includes(q) || q.includes(t)) return 0.78;

  const qTokens = q.split(' ').filter(Boolean);
  const tTokens = new Set(t.split(' ').filter(Boolean));
  const overlap = qTokens.filter((w) => tTokens.has(w)).length;

  if (overlap === 0) return 0.12; // the API matched it somehow (alt title, synopsis, etc.) - keep, but rank low
  return 0.3 + 0.35 * (overlap / qTokens.length); // graded, tops out well below the "includes" tier above
}

// Relevance differences at or above this are never worth trading away for a
// better rating - e.g. an exact title match (1.0) must always outrank a
// merely-similar one (0.78), no matter how highly-rated the latter is.
// Only within this margin (same tier, or close within the graded
// token-overlap range) does the original rating-derived score break ties.
const RELEVANCE_TIER_EPSILON = 0.05;

/**
 * Sorts by title relevance to `query` first (tiered - see epsilon above),
 * rating only as a tie-breaker within a tier, then rewrites `confidence` to
 * a display-friendly blend of the two for the "% match" badge. The blended
 * number is for display only; it is never what determines sort order, so a
 * high rating can no longer buy a weaker title match a higher rank than a
 * better one (see relevance.test.ts for the regression this guards against).
 */
export function rankByRelevance<T extends { title: string; confidence: number }>(query: string, results: T[]): T[] {
  const scored = results.map((item) => ({ item, relevance: titleRelevance(query, item.title) }));

  scored.sort((a, b) => {
    if (Math.abs(a.relevance - b.relevance) > RELEVANCE_TIER_EPSILON) {
      return b.relevance - a.relevance;
    }
    return (b.item.confidence || 0) - (a.item.confidence || 0);
  });

  for (const { item, relevance } of scored) {
    item.confidence = relevance * 0.85 + (item.confidence || 0.5) * 0.15;
  }

  return scored.map((s) => s.item);
}

/**
 * Drops near-duplicate results (same normalized title + same media type)
 * across sources, keeping the highest-confidence copy. Multiple sources
 * (e.g. Jikan and AniList) legitimately return the same title.
 */
export function dedupeByTitle<T extends { title: string; type: string; confidence: number }>(results: T[]): T[] {
  const bestByKey = new Map<string, T>();
  for (const r of results) {
    const key = `${r.type}:${normalizeForMatch(r.title)}`;
    const existing = bestByKey.get(key);
    if (!existing || r.confidence > existing.confidence) {
      bestByKey.set(key, r);
    }
  }
  return Array.from(bestByKey.values());
}
