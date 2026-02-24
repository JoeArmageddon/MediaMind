import type { TMDBResult, SearchResult } from '@/types';
import { getApiKey } from '@/lib/db/dexie';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export class TMDBClient {
  private apiKey: string = '';
  private useBearer: boolean = false;
  private initialized: boolean = false;

  async init() {
    if (this.initialized) return true;
    
    // Check IndexedDB first (more reliable on mobile), then env vars
    let key = await getApiKey('tmdb_key');
    
    if (!key) {
      key = process.env.NEXT_PUBLIC_TMDB_API_KEY || '';
    }
    
    // Check if it's a Bearer token (JWT format with 3 parts separated by dots)
    const parts = key.split('.');
    if (key && parts.length === 3 && parts[0].startsWith('eyJ')) {
      console.log('TMDB: Using Bearer token authentication');
      this.useBearer = true;
      this.apiKey = key;
    } else {
      console.log('TMDB: Using API key authentication');
      this.useBearer = false;
      this.apiKey = key;
    }
    
    if (!this.apiKey) {
      console.error('TMDB API Key/Token is missing! Add it in Settings.');
    }
    
    this.initialized = true;
  }

  private async fetch<T>(endpoint: string): Promise<T | null> {
    // Always re-check for keys in case they were saved after initialization
    const freshKey = await getApiKey('tmdb_key') || process.env.NEXT_PUBLIC_TMDB_API_KEY || '';
    if (freshKey && freshKey !== this.apiKey) {
      // Key was updated, re-initialize
      this.apiKey = freshKey;
      const parts = freshKey.split('.');
      this.useBearer = !!(freshKey && parts.length === 3 && parts[0].startsWith('eyJ'));
    }
    
    if (!this.apiKey) {
      console.error('Cannot fetch TMDB: No API key/token');
      return null;
    }

    try {
      // For Bearer tokens, we need to use the Authorization header
      // For API keys, we use the api_key query parameter
      const headers: HeadersInit = {
        'Accept': 'application/json',
      };
      
      let url: string;
      
      if (this.useBearer) {
        // Bearer token auth - use Authorization header, no api_key in URL
        headers['Authorization'] = `Bearer ${this.apiKey}`;
        url = `${TMDB_BASE_URL}${endpoint}`;
      } else {
        // API key auth - add api_key to URL
        const separator = endpoint.includes('?') ? '&' : '?';
        url = `${TMDB_BASE_URL}${endpoint}${separator}api_key=${this.apiKey}`;
      }
      
      console.log('TMDB fetching:', url.replace(this.apiKey, '***'));
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, { 
        headers,
        signal: controller.signal,
        mode: 'cors',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('TMDB API error:', response.status, errorData.status_message || '');
        throw new Error(`TMDB HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error: any) {
      console.error('TMDB fetch error:', error?.message || error);
      if (error.name === 'AbortError') {
        throw new Error('TMDB request timed out');
      }
      throw error;
    }
  }

  async searchMovies(query: string): Promise<SearchResult[]> {
    const data = await this.fetch<{ results: TMDBResult[] }>(
      `/search/movie?query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`
    );

    if (!data?.results) return [];
    return data.results.map((item) => this.normalizeMovie(item));
  }

  async searchTV(query: string): Promise<SearchResult[]> {
    const data = await this.fetch<{ results: TMDBResult[] }>(
      `/search/tv?query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`
    );

    if (!data?.results) return [];
    return data.results.map((item) => this.normalizeTV(item));
  }

  async searchMulti(query: string): Promise<SearchResult[]> {
    console.log('TMDB searching for:', query);
    
    const [movies, tv] = await Promise.all([
      this.searchMovies(query),
      this.searchTV(query),
    ]);

    console.log(`TMDB results: ${movies.length} movies, ${tv.length} TV shows`);
    
    const combined = [...movies, ...tv];
    combined.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    
    return combined;
  }

  private normalizeMovie(item: TMDBResult): SearchResult {
    return {
      title: item.title || 'Unknown',
      type: 'movie',
      poster_url: item.poster_path ? `${TMDB_IMAGE_BASE}/w500${item.poster_path}` : null,
      description: item.overview || null,
      release_year: item.release_date ? parseInt(item.release_date.split('-')[0]) : null,
      api_rating: item.vote_average || null,
      genres: [],
      total_units: 1,
      external_id: item.id,
      confidence: item.vote_average ? Math.min(item.vote_average / 10, 1) : 0.5,
    };
  }

  private normalizeTV(item: TMDBResult): SearchResult {
    return {
      title: item.name || 'Unknown',
      type: 'tv',
      poster_url: item.poster_path ? `${TMDB_IMAGE_BASE}/w500${item.poster_path}` : null,
      description: item.overview || null,
      release_year: item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) : null,
      api_rating: item.vote_average || null,
      genres: [],
      total_units: 0,
      external_id: item.id,
      confidence: item.vote_average ? Math.min(item.vote_average / 10, 1) : 0.5,
    };
  }
}

export const createTMDBClient = () => new TMDBClient();
