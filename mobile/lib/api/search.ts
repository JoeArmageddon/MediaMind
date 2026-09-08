import type { SearchResult, MediaType } from '../types';
import { createTMDBClient } from './tmdb';
import { createJikanClient } from './jikan';
import { createRAWGClient } from './rawg';
import { createBooksClient } from './books';
import { withTimeout, withRetry } from './http';
import { rankByRelevance, dedupeByTitle } from './relevance';

// Simplified from the web app's src/lib/api/search.ts for Chunk A: TMDB,
// Jikan, RAWG, and Google Books only (AniList/Open Library and the AI
// classification fallback are deferred - see the Phase 3 plan). Sources
// still run concurrently, same reasoning as web: a single slow/failing
// source shouldn't gate every other source behind it.
export class SearchOrchestrator {
  private tmdb = createTMDBClient();
  private jikan = createJikanClient();
  private rawg = createRAWGClient();
  private books = createBooksClient();

  async search(title: string, preferredType?: MediaType, signal?: AbortSignal): Promise<SearchResult[]> {
    const checkAborted = () => {
      if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError');
    };
    checkAborted();

    const shouldSearchTMDB = !preferredType || ['movie', 'tv'].includes(preferredType);
    const shouldSearchJikan = !preferredType || ['anime', 'manga'].includes(preferredType);
    const shouldSearchRAWG = !preferredType || preferredType === 'game';
    const shouldSearchBooks = !preferredType || ['book', 'light_novel', 'visual_novel'].includes(preferredType);

    const fail = (label: string, e: any): SearchResult[] => {
      if (e?.name === 'AbortError') throw e;
      console.error(`${label}: ${e?.message || 'Failed'}`);
      return [];
    };

    const searchTMDB = async (): Promise<SearchResult[]> => {
      try {
        return await withRetry(async () => {
          await withTimeout(this.tmdb.init(), 5000, 'TMDB init');
          const results = await withTimeout(this.tmdb.searchMulti(title, signal), 20000, 'TMDB');
          return preferredType ? results.filter((r) => r.type === preferredType) : results;
        }, 'TMDB', 2);
      } catch (e: any) {
        return fail('TMDB', e);
      }
    };

    const searchJikan = async (): Promise<SearchResult[]> => {
      try {
        return await withRetry(async () => {
          const results = await withTimeout(this.jikan.searchAll(title, signal), 25000, 'Jikan');
          return preferredType ? results.filter((r) => r.type === preferredType) : results;
        }, 'Jikan', 2);
      } catch (e: any) {
        return fail('Jikan', e);
      }
    };

    const searchRAWG = async (): Promise<SearchResult[]> => {
      try {
        return await withRetry(async () => {
          await this.rawg.init();
          return await withTimeout(this.rawg.searchGames(title, signal), 20000, 'RAWG');
        }, 'RAWG', 2);
      } catch (e: any) {
        return fail('RAWG', e);
      }
    };

    const searchBooks = async (): Promise<SearchResult[]> => {
      try {
        return await withRetry(async () => {
          await this.books.init();
          return await withTimeout(this.books.searchBooks(title, signal), 20000, 'Books');
        }, 'Books', 2);
      } catch (e: any) {
        return fail('Books', e);
      }
    };

    const tasks: Promise<SearchResult[]>[] = [];
    if (shouldSearchTMDB) tasks.push(searchTMDB());
    if (shouldSearchJikan) tasks.push(searchJikan());
    if (shouldSearchRAWG) tasks.push(searchRAWG());
    if (shouldSearchBooks) tasks.push(searchBooks());

    const settled = await Promise.all(tasks);
    let results: SearchResult[] = settled.flat();

    results = dedupeByTitle(rankByRelevance(title, results));

    return results;
  }
}

let orchestrator: SearchOrchestrator | null = null;

export const getSearchOrchestrator = (): SearchOrchestrator => {
  if (!orchestrator) orchestrator = new SearchOrchestrator();
  return orchestrator;
};
