import type { TMDBResult, SearchResult } from '@/types';
import { getApiKey } from '@/lib/db/dexie';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export class TMDBClient {
  private apiKey: string = '';
  private initialized: boolean = false;

  async init() {
    if (this.initialized) return true;
    
    // Check IndexedDB first (more reliable on mobile), then env vars
    let key = await getApiKey('tmdb_key');
    
    if (!key) {
      key = process.env.NEXT_PUBLIC_TMDB_API_KEY || '';
    }
    
    this.apiKey = key;
    this.initialized = true;
  }

  private async getKey(): Promise<string> {
    const key = await getApiKey('tmdb_key') || process.env.NEXT_PUBLIC_TMDB_API_KEY || '';
    this.apiKey = key;
    return key;
  }

  private async fetch<T>(endpoint: string): Promise<T | null> {
    const key = await this.getKey();
    if (!key) {
      throw new Error('No TMDB API key');
    }

    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${TMDB_BASE_URL}${endpoint}${separator}api_key=${key}`;

    console.log('TMDB fetch:', endpoint.split('?')[0]);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`TMDB HTTP ${response.status}`);
    }

    return await response.json();
  }

  async searchMovies(query: string): Promise<SearchResult[]> {
    console.log('TMDB searchMovies:', query);
    const data = await this.fetch<{ results: TMDBResult[] }>(
      `/search/movie?query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`
    );

    if (!data?.results) return [];
    return data.results.map((item) => this.normalizeMovie(item));
  }

  async searchTV(query: string): Promise<SearchResult[]> {
    console.log('TMDB searchTV:', query);
    const data = await this.fetch<{ results: TMDBResult[] }>(
      `/search/tv?query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`
    );

    if (!data?.results) return [];
    return data.results.map((item) => this.normalizeTV(item));
  }

  async searchMulti(query: string): Promise<SearchResult[]> {
    console.log('TMDB searchMulti:', query);

    try {
      const movies = await this.searchMovies(query);
      console.log('TMDB movies:', movies.length);

      const tv = await this.searchTV(query);
      console.log('TMDB tv:', tv.length);

      const combined = [...movies, ...tv];
      combined.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

      return combined;
    } catch (e) {
      console.error('TMDB searchMulti error:', e);
      throw e;
    }
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
