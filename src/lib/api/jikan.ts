import type { SearchResult } from '@/types';

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const MAX_RETRIES = 3;
const REQUEST_DELAY = 800; // ms - Jikan is strict with rate limiting

interface JikanResponse {
  data: any[];
  pagination?: {
    has_next_page: boolean;
    last_visible_page: number;
  };
}

export class JikanClient {
  private lastRequestTime = 0;
  private minRequestInterval = 800; // ms

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delayTime = this.minRequestInterval - timeSinceLastRequest;
      await this.delay(delayTime);
    }
    this.lastRequestTime = Date.now();
  }

  private async fetchWithRetry(url: string, retries = 0): Promise<JikanResponse> {
    await this.rateLimit();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      clearTimeout(timeoutId);

      if (response.status === 429) {
        if (retries < MAX_RETRIES) {
          const waitTime = 2000 * (retries + 1);
          console.warn(`Jikan rate limited. Retrying after ${waitTime}ms...`);
          await this.delay(waitTime);
          return this.fetchWithRetry(url, retries + 1);
        }
        throw new Error('Jikan API rate limit exceeded. Please try again later.');
      }

      if (response.status === 404) {
        return { data: [] };
      }

      if (!response.ok) {
        throw new Error(`Jikan API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - Jikan API took too long to respond');
      }
      throw error;
    }
  }

  private mapAnimeResult(anime: any): SearchResult {
    return {
      title: anime.title_english || anime.title || 'Unknown Title',
      type: 'anime',
      poster_url: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || null,
      description: anime.synopsis || null,
      release_year: anime.aired?.prop?.from?.year || null,
      api_rating: anime.score || null,
      genres: anime.genres?.map((g: any) => g.name) || [],
      total_units: anime.episodes || null,
      external_id: `jikan-anime-${anime.mal_id}`,
      confidence: anime.score ? Math.min(anime.score / 10, 1) : 0.5,
    };
  }

  private mapMangaResult(manga: any): SearchResult {
    return {
      title: manga.title_english || manga.title || 'Unknown Title',
      type: 'manga',
      poster_url: manga.images?.jpg?.large_image_url || manga.images?.jpg?.image_url || null,
      description: manga.synopsis || null,
      release_year: manga.published?.prop?.from?.year || null,
      api_rating: manga.score || null,
      genres: manga.genres?.map((g: any) => g.name) || [],
      total_units: manga.chapters || null,
      external_id: `jikan-manga-${manga.mal_id}`,
      confidence: manga.score ? Math.min(manga.score / 10, 1) : 0.5,
    };
  }

  async searchAnime(query: string, limit = 10): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    try {
      const encodedQuery = encodeURIComponent(query.trim());
      const data = await this.fetchWithRetry(
        `${JIKAN_BASE_URL}/anime?q=${encodedQuery}&limit=${limit}&sfw=false&order_by=score&sort=desc`
      );

      return (data.data || []).map(this.mapAnimeResult);
    } catch (error) {
      console.error('Anime search error:', error);
      return [];
    }
  }

  async searchManga(query: string, limit = 10): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    try {
      const encodedQuery = encodeURIComponent(query.trim());
      const data = await this.fetchWithRetry(
        `${JIKAN_BASE_URL}/manga?q=${encodedQuery}&limit=${limit}&order_by=score&sort=desc`
      );

      return (data.data || []).map(this.mapMangaResult);
    } catch (error) {
      console.error('Manga search error:', error);
      return [];
    }
  }

  async searchAll(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    try {
      // Search anime first
      const animeResults = await this.searchAnime(query, 5);
      results.push(...animeResults);

      // Wait before searching manga
      if (animeResults.length > 0) {
        await this.delay(500);
      }

      const mangaResults = await this.searchManga(query, 5);
      results.push(...mangaResults);

    } catch (error) {
      console.error('Jikan searchAll error:', error);
    }

    return results;
  }

  async getTopAnime(limit = 5): Promise<SearchResult[]> {
    try {
      const data = await this.fetchWithRetry(
        `${JIKAN_BASE_URL}/top/anime?limit=${limit}&filter=airing`
      );
      return (data.data || []).map(this.mapAnimeResult);
    } catch (error) {
      console.error('Top anime error:', error);
      return [];
    }
  }
}

// Singleton
let client: JikanClient | null = null;

export const createJikanClient = (): JikanClient => {
  if (!client) {
    client = new JikanClient();
  }
  return client;
};
