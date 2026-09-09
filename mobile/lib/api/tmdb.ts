import type { TMDBResult, SearchResult } from '../types';
import { resolveApiKey } from '../apiKeys';
import { supabaseUrl, supabaseAnonKey } from '../supabase';
import { callWebApiGet } from '../webApi';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
// Same Supabase Edge Function proxy the web app uses - some networks block
// api.themoviedb.org directly at the connection level, confirmed as a real
// issue this project hit on web. Routing through Supabase's servers sidesteps
// it, and it's already public/callable from anywhere with the anon key, so
// mobile reuses it as-is with zero backend changes.
const TMDB_PROXY_URL = `${supabaseUrl}/functions/v1/tmdb-proxy`;

// TMDB's search endpoints only return numeric genre_ids, not names -
// resolving those needs a separate call to /genre/movie/list and
// /genre/tv/list, cached at module scope since genre lists essentially
// never change. (This bug - genres silently hardcoded to [] - was found
// and fixed on web this same session; porting the fixed version, not the
// original.)
let movieGenreMap: Map<number, string> | null = null;
let tvGenreMap: Map<number, string> | null = null;
let genreMapsLoading: Promise<void> | null = null;

export class TMDBClient {
  private apiKey: string = '';
  private initialized: boolean = false;

  async init() {
    if (this.initialized) return true;
    // No EXPO_PUBLIC_ fallback - see webApi.ts's header comment. fetch()
    // below calls the deployed web app's server-held default key instead
    // of bundling one into this app's JS.
    this.apiKey = await resolveApiKey('tmdb_key', undefined);
    this.initialized = true;
  }

  private async getKey(): Promise<string> {
    this.apiKey = await resolveApiKey('tmdb_key', undefined);
    return this.apiKey;
  }

  private async fetch<T>(endpoint: string, signal?: AbortSignal): Promise<T | null> {
    const key = await this.getKey();
    const [path, query] = endpoint.split('?');
    const queryParams: Record<string, string> = {};
    if (query) {
      new URLSearchParams(query).forEach((v, k) => {
        queryParams[k] = v;
      });
    }

    let response: Response;
    if (key) {
      // Bring-your-own-key path: through the Supabase edge proxy, same as
      // before - some networks block api.themoviedb.org directly at the
      // connection level.
      const proxyUrl = new URL(TMDB_PROXY_URL);
      proxyUrl.searchParams.set('path', path);
      Object.entries(queryParams).forEach(([k, v]) => proxyUrl.searchParams.set(k, v));
      proxyUrl.searchParams.set('api_key', key);
      response = await fetch(proxyUrl.toString(), {
        signal,
        headers: { Authorization: `Bearer ${supabaseAnonKey}` },
      });
    } else {
      // No user key - fall back to the deployed web app's server-side
      // default-key proxy instead of a bundled EXPO_PUBLIC_ key.
      response = await callWebApiGet('/api/external/tmdb', { path, ...queryParams }, signal);
    }

    if (!response.ok) throw new Error(`TMDB HTTP ${response.status}`);
    return await response.json();
  }

  private async ensureGenreMaps(): Promise<void> {
    if (movieGenreMap && tvGenreMap) return;
    if (genreMapsLoading) return genreMapsLoading;

    genreMapsLoading = (async () => {
      try {
        const [movieData, tvData] = await Promise.all([
          this.fetch<{ genres: { id: number; name: string }[] }>('/genre/movie/list?language=en-US'),
          this.fetch<{ genres: { id: number; name: string }[] }>('/genre/tv/list?language=en-US'),
        ]);
        movieGenreMap = new Map((movieData?.genres ?? []).map((g) => [g.id, g.name]));
        tvGenreMap = new Map((tvData?.genres ?? []).map((g) => [g.id, g.name]));
      } catch (e) {
        console.warn('Failed to load TMDB genre lists - genres will be empty:', e);
        movieGenreMap = movieGenreMap ?? new Map();
        tvGenreMap = tvGenreMap ?? new Map();
      }
    })();

    return genreMapsLoading;
  }

  async searchMovies(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    const [data] = await Promise.all([
      this.fetch<{ results: TMDBResult[] }>(
        `/search/movie?query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`,
        signal
      ),
      this.ensureGenreMaps(),
    ]);
    if (!data?.results) return [];
    return data.results.map((item) => this.normalizeMovie(item));
  }

  async searchTV(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    const [data] = await Promise.all([
      this.fetch<{ results: TMDBResult[] }>(
        `/search/tv?query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`,
        signal
      ),
      this.ensureGenreMaps(),
    ]);
    if (!data?.results) return [];
    return data.results.map((item) => this.normalizeTV(item));
  }

  async searchMulti(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    const movies = await this.searchMovies(query, signal);
    const tv = await this.searchTV(query, signal);
    const combined = [...movies, ...tv];
    combined.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    return combined;
  }

  private normalizeMovie(item: TMDBResult): SearchResult {
    const genres = (item.genre_ids ?? [])
      .map((id) => movieGenreMap?.get(id))
      .filter((g): g is string => !!g);
    return {
      title: item.title || 'Unknown',
      type: 'movie',
      poster_url: item.poster_path ? `${TMDB_IMAGE_BASE}/w500${item.poster_path}` : null,
      description: item.overview || null,
      release_year: item.release_date ? parseInt(item.release_date.split('-')[0]) : null,
      api_rating: item.vote_average || null,
      genres,
      total_units: 1,
      external_id: item.id,
      confidence: item.vote_average ? Math.min(item.vote_average / 10, 1) : 0.5,
    };
  }

  private normalizeTV(item: TMDBResult): SearchResult {
    const genres = (item.genre_ids ?? [])
      .map((id) => tvGenreMap?.get(id))
      .filter((g): g is string => !!g);
    return {
      title: item.name || 'Unknown',
      type: 'tv',
      poster_url: item.poster_path ? `${TMDB_IMAGE_BASE}/w500${item.poster_path}` : null,
      description: item.overview || null,
      release_year: item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) : null,
      api_rating: item.vote_average || null,
      genres,
      total_units: 0,
      external_id: item.id,
      confidence: item.vote_average ? Math.min(item.vote_average / 10, 1) : 0.5,
    };
  }
}

export const createTMDBClient = () => new TMDBClient();
