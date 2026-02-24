import type { RAWGResult, SearchResult } from '@/types';
import { getApiKey } from '@/lib/db/dexie';

const RAWG_BASE_URL = 'https://api.rawg.io/api';

export class RAWGClient {
  private apiKey: string = '';
  private initialized: boolean = false;

  async init() {
    if (this.initialized) return true;
    
    // Check IndexedDB first (more reliable on mobile), then env vars
    let key = await getApiKey('rawg_key');
    
    if (!key) {
      key = process.env.NEXT_PUBLIC_RAWG_API_KEY || '';
    }
    
    this.apiKey = key;
    this.initialized = true;
  }

  private async fetch<T>(endpoint: string): Promise<T | null> {
    await this.init();
    
    try {
      const response = await fetch(
        `${RAWG_BASE_URL}${endpoint}&key=${this.apiKey}`
      );
      
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`RAWG API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('RAWG fetch error:', error);
      return null;
    }
  }

  async searchGames(query: string): Promise<SearchResult[]> {
    const data = await this.fetch<{ results: RAWGResult[] }>(
      `/games?search=${encodeURIComponent(query)}&page_size=10&ordering=-rating`
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
