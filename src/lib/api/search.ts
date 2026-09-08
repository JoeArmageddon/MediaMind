import type { SearchResult, MediaType } from '@/types';
import { createTMDBClient } from './tmdb';
import { createJikanClient } from './jikan';
import { createAniListClient } from './anilist';
import { createRAWGClient } from './rawg';
import { createBooksClient } from './books';
import { createOpenLibraryClient } from './openlibrary';
import { getAIClient } from '@/lib/ai';
import { withTimeout, withRetry } from './http';
import { rankByRelevance, dedupeByTitle } from './relevance';

// Detect if we're on a mobile device
const isMobile = () => {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export class SearchOrchestrator {
  private tmdb = createTMDBClient();
  private jikan = createJikanClient();
  private anilist = createAniListClient();
  private rawg = createRAWGClient();
  private books = createBooksClient();
  private openLibrary = createOpenLibraryClient();
  private ai = getAIClient();

  async search(title: string, preferredType?: MediaType, signal?: AbortSignal): Promise<SearchResult[]> {
    console.log(`=== SEARCH START === Query: "${title}", Type: ${preferredType || 'all'}, Mobile: ${isMobile()}`);

    const checkAborted = () => {
      if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError');
    };
    checkAborted();

    const errors: string[] = [];
    const mobile = isMobile();

    // Define which APIs to call based on preferred type
    const shouldSearchTMDB = !preferredType || ['movie', 'tv'].includes(preferredType);
    const shouldSearchJikan = !preferredType || ['anime', 'manga', 'manhwa', 'manhua', 'donghua'].includes(preferredType);
    const shouldSearchRAWG = !preferredType || preferredType === 'game';
    const shouldSearchBooks = !preferredType || ['book', 'light_novel', 'visual_novel'].includes(preferredType);
    // Open Library only ever returns plain "book" results, so skip it when
    // specifically searching for light_novel/visual_novel.
    const shouldSearchOpenLibrary = shouldSearchBooks && (!preferredType || preferredType === 'book');

    const fail = (label: string, e: any): SearchResult[] => {
      if (e?.name === 'AbortError') throw e;
      const msg = `${label}: ${e?.message || 'Failed'}`;
      console.error(msg);
      errors.push(msg);
      return [];
    };

    // Every source below runs concurrently (see the Promise.all further
    // down) - they previously ran one after another, each with its own
    // timeout+retry cycle, so a single slow/failing source (TMDB timing out
    // is common) delayed every source queued behind it. With 6 sources that
    // could add up to several minutes for one search. Now the total time is
    // bounded by the single slowest source, not the sum of all of them.

    const searchTMDB = async (): Promise<SearchResult[]> => {
      console.log('Searching TMDB...');
      try {
        return await withRetry(async () => {
          await withTimeout(this.tmdb.init(), 5000, 'TMDB init');
          const tmdbResults = await withTimeout(
            this.tmdb.searchMulti(title, signal),
            mobile ? 20000 : 15000,
            'TMDB'
          );
          console.log(`TMDB found: ${tmdbResults.length} results`);
          return preferredType ? tmdbResults.filter((r) => r.type === preferredType) : tmdbResults;
        }, 'TMDB', 2);
      } catch (e: any) {
        return fail('TMDB', e);
      }
    };

    const searchJikan = async (): Promise<SearchResult[]> => {
      console.log('Searching Jikan...');
      try {
        return await withRetry(async () => {
          const jikanResults = await withTimeout(
            this.jikan.searchAll(title, signal),
            mobile ? 25000 : 20000,
            'Jikan'
          );
          console.log(`Jikan found: ${jikanResults.length} results`);

          // Map manga results to manhwa if searching for manhwa (Jikan/MAL
          // can't reliably distinguish these - AniList, run alongside this,
          // can via countryOfOrigin).
          const mappedResults = jikanResults.map((r) =>
            preferredType === 'manhwa' && r.type === 'manga' ? { ...r, type: 'manhwa' as MediaType } : r
          );

          return preferredType && preferredType !== 'manhwa'
            ? mappedResults.filter((r) => r.type === preferredType)
            : mappedResults;
        }, 'Jikan', 2);
      } catch (e: any) {
        return fail('Jikan', e);
      }
    };

    // Supplements Jikan (MyAnimeList data, Japan-centric) with far better
    // manhwa/manhua/donghua coverage: AniList's countryOfOrigin field lets
    // us correctly detect Korean/Chinese content, which Jikan largely can't
    // distinguish from Japanese manga at all.
    const searchAniList = async (): Promise<SearchResult[]> => {
      console.log('Searching AniList...');
      try {
        return await withRetry(async () => {
          const aniListResults = await withTimeout(
            this.anilist.searchAll(title, signal),
            mobile ? 20000 : 15000,
            'AniList'
          );
          console.log(`AniList found: ${aniListResults.length} results`);
          // AniList already correctly types manhwa/manhua/donghua via
          // countryOfOrigin, so (unlike Jikan) no special-case remapping is
          // needed here - just filter to the requested type if any.
          return preferredType ? aniListResults.filter((r) => r.type === preferredType) : aniListResults;
        }, 'AniList', 2);
      } catch (e: any) {
        return fail('AniList', e);
      }
    };

    const searchRAWG = async (): Promise<SearchResult[]> => {
      console.log('Searching RAWG...');
      try {
        return await withRetry(async () => {
          await this.rawg.init();
          const rawgResults = await withTimeout(
            this.rawg.searchGames(title, signal),
            mobile ? 20000 : 15000,
            'RAWG'
          );
          console.log(`RAWG found: ${rawgResults.length} results`);
          return rawgResults;
        }, 'RAWG', 2);
      } catch (e: any) {
        return fail('RAWG', e);
      }
    };

    const searchBooks = async (): Promise<SearchResult[]> => {
      console.log('Searching Google Books...');
      try {
        return await withRetry(async () => {
          await this.books.init();
          const bookResults = await withTimeout(
            this.books.searchBooks(title, signal),
            mobile ? 20000 : 15000,
            'Google Books'
          );
          console.log(`Google Books found: ${bookResults.length} results`);
          return bookResults;
        }, 'Books', 2);
      } catch (e: any) {
        return fail('Books', e);
      }
    };

    // Free, no key required, broader catalog than Google Books alone
    // (particularly for older/less mainstream titles).
    const searchOpenLibrary = async (): Promise<SearchResult[]> => {
      console.log('Searching Open Library...');
      try {
        return await withRetry(async () => {
          const olResults = await withTimeout(
            this.openLibrary.searchBooks(title, signal),
            mobile ? 20000 : 15000,
            'Open Library'
          );
          console.log(`Open Library found: ${olResults.length} results`);
          return olResults;
        }, 'Open Library', 2);
      } catch (e: any) {
        return fail('Open Library', e);
      }
    };

    const tasks: Promise<SearchResult[]>[] = [];
    if (shouldSearchTMDB) tasks.push(searchTMDB());
    if (shouldSearchJikan) tasks.push(searchJikan());
    if (shouldSearchJikan) tasks.push(searchAniList());
    if (shouldSearchRAWG) tasks.push(searchRAWG());
    if (shouldSearchBooks) tasks.push(searchBooks());
    if (shouldSearchOpenLibrary) tasks.push(searchOpenLibrary());

    const settled = await Promise.all(tasks);
    let results: SearchResult[] = settled.flat();

    // AI classification fallback - only when neither Jikan nor AniList
    // turned up anything (checked against the combined pool, not just
    // Jikan alone, since AniList often finds titles Jikan misses).
    if (shouldSearchJikan && this.ai.isAvailable()) {
      const animeMangaTypes: MediaType[] = ['anime', 'manga', 'manhwa', 'manhua', 'donghua'];
      const foundAnimeManga = results.some((r) => animeMangaTypes.includes(r.type));

      if (!foundAnimeManga) {
        checkAborted();
        console.log('No Jikan/AniList results - trying AI classification...');
        try {
          const aiResult = await withTimeout(this.ai.classifyMedia(title), 10000, 'AI classify');

          if (aiResult && animeMangaTypes.includes(aiResult.detected_type)) {
            console.log('AI classified as:', aiResult.detected_type);
            const normalizedConfidence = aiResult.confidence > 1 ? aiResult.confidence / 100 : aiResult.confidence;

            results.push({
              title,
              type: aiResult.detected_type,
              poster_url: null,
              description: `AI-classified ${aiResult.detected_type}. Likely genres: ${aiResult.likely_genres.join(', ')}`,
              release_year: null,
              api_rating: null,
              genres: aiResult.likely_genres,
              total_units: 0,
              external_id: `ai-${Date.now()}`,
              confidence: normalizedConfidence * 0.7,
            });
          }
        } catch (aiError: any) {
          if (aiError?.name === 'AbortError') throw aiError;
          console.error('AI classification failed:', aiError);
        }
      }
    }

    // Re-rank by how well each title actually matches the query (previously
    // sorted purely by each API's rating/score, which had nothing to do
    // with relevance to what was searched), then drop near-duplicates that
    // multiple sources returned for the same title.
    results = dedupeByTitle(rankByRelevance(title, results));

    console.log(`=== SEARCH COMPLETE === Total results: ${results.length}, Errors: ${errors.length}`);
    if (errors.length > 0) console.log('Errors:', errors);

    // Return results even if some APIs failed
    return results;
  }

  async batchSearch(titles: string[]): Promise<Map<string, SearchResult[]>> {
    const results = new Map<string, SearchResult[]>();

    for (const title of titles) {
      try {
        const searchResults = await this.search(title);
        results.set(title, searchResults);
        // Longer delay between batch items to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('Batch search error for:', title, error);
        results.set(title, []);
      }
    }

    return results;
  }
}

let orchestrator: SearchOrchestrator | null = null;

export const getSearchOrchestrator = (): SearchOrchestrator => {
  if (!orchestrator) {
    orchestrator = new SearchOrchestrator();
  }
  return orchestrator;
};
