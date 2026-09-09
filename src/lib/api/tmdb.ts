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

// TMDB's search/list endpoints only return numeric genre_ids, not names -
// resolving those to actual genre strings needs a separate call to
// /genre/movie/list and /genre/tv/list. That call was never made; every
// movie/TV search result had its `genres` field hardcoded to [] instead.
// Genre lists change essentially never, so these are cached at module scope
// (shared across every TMDBClient instance/search) rather than re-fetched
// per search.
let movieGenreMap: Map<number, string> | null = null;
let tvGenreMap: Map<number, string> | null = null;
let genreMapsLoading: Promise<void> | null = null;

export class TMDBClient {
  private apiKey: string = '';
  private initialized: boolean = false;

  async init() {
    if (this.initialized) return true;

    this.apiKey = await resolveApiKey('tmdb_key', undefined);
    this.initialized = true;
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
        // Fall back to empty maps rather than retrying every single search
        // result on a persistently failing network/key.
        movieGenreMap = movieGenreMap ?? new Map();
        tvGenreMap = tvGenreMap ?? new Map();
      }
    })();

    return genreMapsLoading;
  }

  private async getKey(): Promise<string> {
    // Always re-check for keys in case they were saved after initialization
    this.apiKey = await resolveApiKey('tmdb_key', undefined);
    return this.apiKey;
  }

  private async fetch<T>(endpoint: string, signal?: AbortSignal): Promise<T | null> {
    const key = await this.getKey();
    const [path, query] = endpoint.split('?');

    let response: Response;
    if (key) {
      // Own key - via the Supabase edge function proxy, which exists to
      // route around ISP-level blocks of api.themoviedb.org on some
      // networks (see TMDB_PROXY_URL's comment above).
      const proxyUrl = new URL(TMDB_PROXY_URL);
      proxyUrl.searchParams.set('path', path);
      if (query) {
        new URLSearchParams(query).forEach((v, k) => proxyUrl.searchParams.set(k, v));
      }
      proxyUrl.searchParams.set('api_key', key);

      console.log('TMDB fetch (via proxy):', path);
      response = await fetch(proxyUrl.toString(), {
        signal,
        headers: { Authorization: `Bearer ${supabaseAnonKey}` },
      });
    } else {
      // No key of your own - fall back to our own server-side proxy (a
      // shared default key, never exposed to the client). Runs on
      // Vercel's servers, not the end user's network, so the ISP-block
      // reason for the edge function above doesn't apply here.
      const proxyUrl = new URL('/api/external/tmdb', window.location.origin);
      proxyUrl.searchParams.set('path', path);
      if (query) {
        new URLSearchParams(query).forEach((v, k) => proxyUrl.searchParams.set(k, v));
      }

      console.log('TMDB fetch (via default-key proxy):', path);
      response = await fetch(proxyUrl.toString(), { signal });
    }

    if (!response.ok) {
      throw new Error(`TMDB HTTP ${response.status}`);
    }

    return await response.json();
  }

  async searchMovies(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    console.log('TMDB searchMovies:', query);
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
    console.log('TMDB searchTV:', query);
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
