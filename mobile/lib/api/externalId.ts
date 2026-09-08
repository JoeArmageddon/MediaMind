import type { SearchResult } from '../types';

// Ported verbatim from the web app's src/lib/api/externalId.ts.
//
// SearchResult.external_id's shape depends on which source produced it -
// TMDB and RAWG use a raw numeric id, Google Books uses a raw string id,
// Jikan prefixes it ("jikan-anime-{mal_id}" / "jikan-manga-{mal_id}").
// Mapping it back onto Media's typed id columns at add-time is what makes
// a future re-lookup by id (richer metadata, genre refresh, etc.) possible
// instead of only ever being able to re-search by title.
export interface MappedExternalIds {
  tmdb_id: number | null;
  mal_id: number | null;
  rawg_id: number | null;
  google_books_id: string | null;
}

export function mapExternalIds(result: Pick<SearchResult, 'type' | 'external_id'>): MappedExternalIds {
  const ids: MappedExternalIds = {
    tmdb_id: null,
    mal_id: null,
    rawg_id: null,
    google_books_id: null,
  };

  const raw = result.external_id;

  if (typeof raw === 'string' && raw.startsWith('jikan-')) {
    const match = raw.match(/^jikan-(?:anime|manga)-(\d+)$/);
    if (match) ids.mal_id = parseInt(match[1], 10);
    return ids;
  }

  switch (result.type) {
    case 'movie':
    case 'tv':
      if (typeof raw === 'number') ids.tmdb_id = raw;
      else if (typeof raw === 'string' && /^\d+$/.test(raw)) ids.tmdb_id = parseInt(raw, 10);
      break;
    case 'game':
      if (typeof raw === 'number') ids.rawg_id = raw;
      else if (typeof raw === 'string' && /^\d+$/.test(raw)) ids.rawg_id = parseInt(raw, 10);
      break;
    case 'book':
      if (typeof raw === 'string') ids.google_books_id = raw;
      break;
    default:
      break;
  }

  return ids;
}
