import type { SearchResult, MediaType } from '@/types';
import { fetchWithTimeout } from './http';

// AniList's public GraphQL API - no API key required, generous rate limits.
// Supplements Jikan (MyAnimeList data), which is comprehensive for
// Japanese-origin anime/manga but weak on Korean/Chinese content - AniList's
// `countryOfOrigin` field lets us properly detect manhwa/manhua/donghua,
// which previously had almost no real search coverage.
const ANILIST_URL = 'https://graphql.anilist.co';

const SEARCH_QUERY = `
  query ($search: String, $type: MediaType, $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(search: $search, type: $type, sort: SEARCH_MATCH) {
        id
        type
        format
        countryOfOrigin
        title {
          romaji
          english
        }
        coverImage {
          large
        }
        description(asHtml: false)
        startDate {
          year
        }
        averageScore
        episodes
        chapters
        genres
      }
    }
  }
`;

interface AniListMedia {
  id: number;
  type: 'ANIME' | 'MANGA';
  format: string | null;
  countryOfOrigin: string | null;
  title: { romaji: string | null; english: string | null };
  coverImage: { large: string | null } | null;
  description: string | null;
  startDate: { year: number | null } | null;
  averageScore: number | null;
  episodes: number | null;
  chapters: number | null;
  genres: string[];
}

function stripHtml(s: string | null): string | null {
  if (!s) return null;
  return s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim() || null;
}

function mapMediaType(item: AniListMedia): MediaType {
  if (item.type === 'ANIME') {
    return item.countryOfOrigin === 'CN' || item.countryOfOrigin === 'TW' ? 'donghua' : 'anime';
  }
  // MANGA type - covers manga, manhwa, manhua, and prose light novels
  if (item.format === 'NOVEL') return 'light_novel';
  if (item.countryOfOrigin === 'KR') return 'manhwa';
  if (item.countryOfOrigin === 'CN' || item.countryOfOrigin === 'TW') return 'manhua';
  return 'manga';
}

function normalize(item: AniListMedia): SearchResult {
  const title = item.title.english || item.title.romaji || 'Unknown Title';
  return {
    title,
    type: mapMediaType(item),
    poster_url: item.coverImage?.large || null,
    description: stripHtml(item.description),
    release_year: item.startDate?.year ?? null,
    api_rating: item.averageScore != null ? item.averageScore / 10 : null, // 0-100 -> 0-10
    genres: item.genres || [],
    total_units: item.type === 'ANIME' ? item.episodes || 0 : item.chapters || 0,
    external_id: `anilist-${item.id}`,
    confidence: item.averageScore != null ? Math.min(item.averageScore / 100, 1) : 0.5,
  };
}

export class AniListClient {
  private async query(type: 'ANIME' | 'MANGA', search: string, perPage: number, signal?: AbortSignal): Promise<AniListMedia[]> {
    if (!search.trim()) return [];

    const response = await fetchWithTimeout(ANILIST_URL, 15000, 'AniList', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: SEARCH_QUERY,
        variables: { search, type, perPage },
      }),
    });

    if (!response.ok) {
      // AniList rate-limits aggressively (429) under load - treat as "no results" rather than failing the whole search.
      if (response.status === 429 || response.status === 404) return [];
      throw new Error(`AniList API error: ${response.status}`);
    }

    const data = await response.json();
    return data?.data?.Page?.media || [];
  }

  async searchAnime(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    try {
      const media = await this.query('ANIME', query, 12, signal);
      return media.map(normalize);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      console.error('AniList anime search error:', error);
      return [];
    }
  }

  async searchManga(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    try {
      const media = await this.query('MANGA', query, 12, signal);
      return media.map(normalize);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      console.error('AniList manga search error:', error);
      return [];
    }
  }

  async searchAll(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    const anime = await this.searchAnime(query, signal);
    const manga = await this.searchManga(query, signal);
    return [...anime, ...manga];
  }
}

let client: AniListClient | null = null;

export const createAniListClient = (): AniListClient => {
  if (!client) client = new AniListClient();
  return client;
};
