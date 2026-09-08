import type { SearchResult } from '@/types';

// SearchResult.external_id's shape depends on which source produced it -
// TMDB and RAWG use a raw numeric id, Google Books uses a raw string id,
// Jikan prefixes it ("jikan-anime-{mal_id}" / "jikan-manga-{mal_id}") since
// its ids aren't globally unique across anime/manga. This was never mapped
// back onto the Media row's typed id columns at add-time - every item's
// tmdb_id/mal_id/rawg_id/google_books_id stayed null regardless of source,
// which also meant nothing could ever look the item back up by id later
// (for re-fetching genres, richer metadata, etc.) - only by re-searching
// its title from scratch.
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
    // anime/manga not prefixed with "jikan-" (shouldn't happen given the
    // current jikan.ts, but handled defensively), and
    // manhwa/manhua/donghua/light_novel/visual_novel/web_series/misc
    // (AniList/Open Library/manual entry) have no dedicated id column -
    // left null, same as before this fix.
    default:
      break;
  }

  return ids;
}
