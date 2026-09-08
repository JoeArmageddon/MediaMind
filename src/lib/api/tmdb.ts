import type { TMDBResult, SearchResult } from '@/types';
import { resolveApiKey } from './apiKey';
import { supabaseUrl, supabaseAnonKey } from '@/lib/db/supabase';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
// Routed through a Supabase Edge Function (see supabase/functions/tmdb-proxy)
// instead of calling api.themoviedb.org directly - some networks block that
// domain outright at the connection level (confirmed: DNS resolves fine,
// but the TCP/TLS handshake never completes), with no way to work around it
// from client-side code alone. Supabase's servers proxy the request through
// instead. image.tmdb.org (a separate CDN) isn't affected and is still
// called directly.
const TMDB_PROXY_URL = `${supabaseUrl}/functions/v1/tmdb-proxy`;

export class TMDBClient {
  private apiKey: string = '';
  private initialized: boolean = false;

  async init() {
    if (this.initialized) return true;

    this.apiKey = await resolveApiKey('tmdb_key', process.env.NEXT_PUBLIC_TMDB_API_KEY);
    this.initialized = true;
  }

  private async getKey(): Promise<string> {
    // Always re-check for keys in case they were saved after initialization
    this.apiKey = await resolveApiKey('tmdb_key', process.env.NEXT_PUBLIC_TMDB_API_KEY);
    return this.apiKey;
  }

  private async fetch<T>(endpoint: string, signal?: AbortSignal): Promise<T | null> {
    const key = await this.getKey();
    if (!key) {
      throw new Error('No TMDB API key');
    }

    const [path, query] = endpoint.split('?');
    const proxyUrl = new URL(TMDB_PROXY_URL);
    proxyUrl.searchParams.set('path', path);
    if (query) {
      new URLSearchParams(query).forEach((v, k) => proxyUrl.searchParams.set(k, v));
    }
    proxyUrl.searchParams.set('api_key', key);

    console.log('TMDB fetch (via proxy):', path);

    const response = await fetch(proxyUrl.toString(), {
      signal,
      headers: { Authorization: `Bearer ${supabaseAnonKey}` },
    });

    if (!response.ok) {
      throw new Error(`TMDB HTTP ${response.status}`);
    }

    return await response.json();
  }

  async searchMovies(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    console.log('TMDB searchMovies:', query);
    const data = await this.fetch<{ results: TMDBResult[] }>(
      `/search/movie?query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`,
      signal
    );

    if (!data?.results) return [];
    return data.results.map((item) => this.normalizeMovie(item));
  }

  async searchTV(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    console.log('TMDB searchTV:', query);
    const data = await this.fetch<{ results: TMDBResult[] }>(
      `/search/tv?query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`,
      signal
    );

    if (!data?.results) return [];
    return data.results.map((item) => this.normalizeTV(item));
  }

  async searchMulti(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    console.log('TMDB searchMulti:', query);

    try {
      const movies = await this.searchMovies(query, signal);
      console.log('TMDB movies:', movies.length);

      const tv = await this.searchTV(query, signal);
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
