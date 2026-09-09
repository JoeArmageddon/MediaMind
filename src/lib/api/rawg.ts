import type { RAWGResult, SearchResult } from '@/types';
import { resolveApiKey } from './apiKey';

const RAWG_BASE_URL = 'https://api.rawg.io/api';

export class RAWGClient {
  private apiKey: string = '';
  private initialized: boolean = false;

  async init() {
    if (this.initialized) return true;

    this.apiKey = await resolveApiKey('rawg_key', undefined);
    this.initialized = true;
  }

  private async fetch<T>(endpoint: string, signal?: AbortSignal): Promise<T | null> {
    // Always re-check for keys in case they were saved after initialization
    this.apiKey = await resolveApiKey('rawg_key', undefined);

    try {
      let response: Response;
      if (this.apiKey) {
        response = await fetch(`${RAWG_BASE_URL}${endpoint}&key=${this.apiKey}`, { signal });
      } else {
        // No key of your own - fall back to our server-side proxy (a
        // shared default key, never exposed to the client). endpoint is
        // e.g. "/games?search=...&page_size=20" - split into path+query
        // the same way the proxy route expects.
        const [path, query] = endpoint.split('?');
        const proxyUrl = new URL('/api/external/rawg', window.location.origin);
        proxyUrl.searchParams.set('path', path);
        if (query) {
          new URLSearchParams(query).forEach((v, k) => proxyUrl.searchParams.set(k, v));
        }
        response = await fetch(proxyUrl.toString(), { signal });
      }

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

  async getGameDetails(id: number): Promise<SearchResult | null> {
    const data = await this.fetch<RAWGResult>(`/games/${id}`);
    if (!data) return null;
    return this.normalizeGame(data);
  }

  private normalizeGame(item: RAWGResult): SearchResult {
    const year = item.released ? parseInt(item.released.split('-')[0]) : null;
    
    // Estimate 100% completion for games
    const estimatedHours = item.playtime || 20;
    
    return {
      title: item.name,
      type: 'game',
      poster_url: item.background_image,
      description: item.description || null,
      release_year: year,
      api_rating: item.rating ? item.rating * 2 : null, // RAWG uses 0-5, convert to 0-10
      genres: item.genres?.map((g) => g.name) || [],
      total_units: 100, // Games use percentage
      external_id: item.id,
      confidence: item.rating ? item.rating / 5 : 0.5,
    };
  }
}

// Factory function
export const createRAWGClient = () => {
  return new RAWGClient();
};
