import { describe, it, expect } from 'vitest';
import { titleRelevance, rankByRelevance, dedupeByTitle } from '../relevance';

describe('titleRelevance', () => {
  it('scores an exact match highest', () => {
    expect(titleRelevance('naruto', 'Naruto')).toBe(1);
  });

  it('scores a prefix/contains match highly', () => {
    expect(titleRelevance('naruto', 'Naruto Shippuden')).toBeGreaterThan(0.8);
  });

  it('scores an unrelated title low even with punctuation/case differences', () => {
    expect(titleRelevance('naruto', "Attack on Titan: Final Season")).toBeLessThan(0.3);
  });
});

describe('rankByRelevance', () => {
  it('ranks an exact title match above a highly-rated but unrelated result', () => {
    // Reproduces the original bug: sorting purely by rating-derived
    // confidence could put an unrelated, highly-rated title above the
    // actual thing being searched for.
    const results = [
      { title: 'Some Unrelated Hit Show', confidence: 0.95 },
      { title: 'Solo Leveling', confidence: 0.4 },
    ];

    const ranked = rankByRelevance('Solo Leveling', results);

    expect(ranked[0].title).toBe('Solo Leveling');
  });

  it('ranks an exact match above a highly-rated near-match (regression: "Harry Potter" vs "Harry Potter Deluxe Coloring Book")', () => {
    // Live-caught bug: the first blending formula gave rating too much
    // weight, letting a 10.0-rated tie-in product outrank the exact title.
    const results = [
      { title: 'Harry Potter Deluxe Coloring Book', confidence: 1.0 },
      { title: 'Harry Potter', confidence: 0.5 }, // unrated, defaults to 0.5
    ];

    const ranked = rankByRelevance('Harry Potter', results);

    expect(ranked[0].title).toBe('Harry Potter');
  });

  it('lets rating break ties only within the same relevance tier', () => {
    const results = [
      { title: 'Naruto: Shippuden', confidence: 0.3 },
      { title: 'Naruto Uzumaki Chronicles', confidence: 0.9 },
    ];

    // Both are "starts with" matches (same tier) - the higher-rated one should win.
    const ranked = rankByRelevance('Naruto', results);

    expect(ranked[0].title).toBe('Naruto Uzumaki Chronicles');
  });
});

describe('dedupeByTitle', () => {
  it('keeps only the highest-confidence copy of a duplicate title+type pair', () => {
    const results = [
      { title: 'One Piece', type: 'anime', confidence: 0.5 },
      { title: 'one piece', type: 'anime', confidence: 0.9 },
      { title: 'One Piece', type: 'manga', confidence: 0.7 },
    ];

    const deduped = dedupeByTitle(results);

    expect(deduped).toHaveLength(2);
    const anime = deduped.find((r) => r.type === 'anime');
    expect(anime?.confidence).toBe(0.9);
  });
});
