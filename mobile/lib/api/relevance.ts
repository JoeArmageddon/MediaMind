// Ported verbatim from the web app's src/lib/api/relevance.ts.
//
// Title-relevance scoring for search results. `SearchResult.confidence` is
// NOT just each API's own rating/score - it's blended with how well the
// result's title actually matches the query, dominant signal first, rating
// only breaking ties within a tier. See relevance.test.ts on web for the
// regression this guards against ("Harry Potter" vs "Harry Potter Deluxe
// Coloring Book").

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

  if (overlap === 0) return 0.12;
  return 0.3 + 0.35 * (overlap / qTokens.length);
}

const RELEVANCE_TIER_EPSILON = 0.05;

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
