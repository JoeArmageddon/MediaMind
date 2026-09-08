import type { RAWGResult, SearchResult } from '../types';
import { resolveApiKey } from '../apiKeys';

const RAWG_BASE_URL = 'https://api.rawg.io/api';

export class RAWGClient {
  private apiKey: string = '';
  private initialized: boolean = false;

  async init() {
    if (this.initialized) return true;
    this.apiKey = await resolveApiKey('rawg_key', process.env.EXPO_PUBLIC_RAWG_API_KEY);
    this.initialized = true;
  }

  private async fetch<T>(endpoint: string, signal?: AbortSignal): Promise<T | null> {
    this.apiKey = await resolveApiKey('rawg_key', process.env.EXPO_PUBLIC_RAWG_API_KEY);
    if (!this.apiKey) {
      console.error('Cannot fetch RAWG: No API key');
      return null;
    }

    try {
      const response = await fetch(`${RAWG_BASE_URL}${endpoint}&key=${this.apiKey}`, { signal });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`RAWG API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      console.error('RAWG fetch error:', error);
      return null;
    }
  }

  async searchGames(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    const data = await this.fetch<{ results: RAWGResult[] }>(
      `/games?search=${encodeURIComponent(query)}&page_size=20&ordering=-rating`,
      signal
    );
    if (!data?.results) return [];
    return data.results.map((item) => this.normalizeGame(item));
  }

  private normalizeGame(item: RAWGResult): SearchResult {
    const year = item.released ? parseInt(item.released.split('-')[0]) : null;
    return {
      title: item.name,
      type: 'game',
      poster_url: item.background_image,
      description: item.description || null,
      release_year: year,
      api_rating: item.rating ? item.rating * 2 : null,
      genres: item.genres?.map((g) => g.name) || [],
      total_units: 100,
      external_id: item.id,
      confidence: item.rating ? item.rating / 5 : 0.5,
    };
  }
}

export const createRAWGClient = () => new RAWGClient();
