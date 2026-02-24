import type { SearchResult, MediaType } from '@/types';
import { createTMDBClient } from './tmdb';
import { createJikanClient } from './jikan';
import { createRAWGClient } from './rawg';
import { createBooksClient } from './books';
import { getAIClient } from '@/lib/ai';

// Timeout wrapper for API calls
const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    )
  ]);
};

export class SearchOrchestrator {
  private tmdb = createTMDBClient();
  private jikan = createJikanClient();
  private rawg = createRAWGClient();
  private books = createBooksClient();
  private ai = getAIClient();
  private initialized = false;

  async init() {
    if (this.initialized) return;
    // Initialize all clients that need async setup
    await Promise.all([
      this.tmdb.init(),
      this.rawg.init(),
      this.books.init(),
    ]);
    this.initialized = true;
  }

  async search(title: string, preferredType?: MediaType): Promise<SearchResult[]> {
    console.log(`=== SEARCH START === Query: "${title}", Type: ${preferredType || 'all'}`);
    
    // Ensure clients are initialized
    await this.init();
    
    const results: SearchResult[] = [];
    const errors: string[] = [];

    try {
      // Movies & TV from TMDB (10s timeout)
      if (!preferredType || ['movie', 'tv'].includes(preferredType)) {
        console.log('Searching TMDB...');
        try {
          const tmdbResults = await withTimeout(
            this.tmdb.searchMulti(title),
            10000,
            'TMDB'
          );
          console.log(`TMDB found: ${tmdbResults.length} results`);
          
          const filtered = preferredType 
            ? tmdbResults.filter(r => r.type === preferredType)
            : tmdbResults;
          
          results.push(...filtered);
        } catch (e) {
          const msg = `TMDB error: ${e}`;
          console.error(msg);
          errors.push(msg);
        }
      }

      // Anime, Manga, Manhwa, Donghua from Jikan (15s timeout - Jikan is slower)
      if (!preferredType || ['anime', 'manga', 'manhwa', 'manhua', 'donghua'].includes(preferredType)) {
        console.log('Searching Jikan...');
        try {
          if (results.length > 0) await new Promise(r => setTimeout(r, 800));
          
          const jikanResults = await withTimeout(
            this.jikan.searchAll(title),
            15000,
            'Jikan'
          );
          console.log(`Jikan found: ${jikanResults.length} results`);
          
          // Map manga results to manhwa if searching for manhwa
          const mappedResults = jikanResults.map(r => {
            if (preferredType === 'manhwa' && r.type === 'manga') {
              return { ...r, type: 'manhwa' as MediaType };
            }
            return r;
          });
          
          // If no results found, try AI classification as fallback
          if (mappedResults.length === 0) {
            console.log('No Jikan results - trying AI classification...');
            try {
              const aiResult = await withTimeout(
                this.ai.classifyMedia(title),
                8000,
                'AI classify'
              );
              
              if (aiResult && ['anime', 'manga', 'manhwa', 'manhua', 'donghua'].includes(aiResult.detected_type)) {
                console.log('AI classified as:', aiResult.detected_type);
                const normalizedConfidence = aiResult.confidence > 1 ? aiResult.confidence / 100 : aiResult.confidence;
                
                results.push({
                  title: title,
                  type: aiResult.detected_type as MediaType,
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
            } catch (aiError) {
              console.error('AI classification failed:', aiError);
            }
          } else {
            const filtered = preferredType && preferredType !== 'manhwa'
              ? mappedResults.filter(r => r.type === preferredType)
              : mappedResults;
            results.push(...filtered);
          }
        } catch (e) {
          const msg = `Jikan error: ${e}`;
          console.error(msg);
          errors.push(msg);
        }
      }

      // Games from RAWG (10s timeout)
      if (!preferredType || preferredType === 'game') {
        console.log('Searching RAWG...');
        try {
          if (results.length > 0) await new Promise(r => setTimeout(r, 500));
          
          const rawgResults = await withTimeout(
            this.rawg.searchGames(title),
            10000,
            'RAWG'
          );
          console.log(`RAWG found: ${rawgResults.length} results`);
          results.push(...rawgResults);
        } catch (e) {
          const msg = `RAWG error: ${e}`;
          console.error(msg);
          errors.push(msg);
        }
      }

      // Books from Google Books (10s timeout)
      if (!preferredType || ['book', 'light_novel', 'visual_novel'].includes(preferredType)) {
        console.log('Searching Google Books...');
        try {
          if (results.length > 0) await new Promise(r => setTimeout(r, 500));
          
          const bookResults = await withTimeout(
            this.books.searchBooks(title),
            10000,
            'Google Books'
          );
          console.log(`Google Books found: ${bookResults.length} results`);
          results.push(...bookResults);
        } catch (e) {
          const msg = `Books error: ${e}`;
          console.error(msg);
          errors.push(msg);
        }
      }
    } catch (error) {
      console.error('Search error:', error);
    }

    // Sort by confidence/popularity
    results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    
    console.log(`=== SEARCH COMPLETE === Total results: ${results.length}`);
    if (errors.length > 0) console.log('Errors:', errors);
    
    return results;
  }

  async batchSearch(titles: string[]): Promise<Map<string, SearchResult[]>> {
    const results = new Map<string, SearchResult[]>();
    
    for (const title of titles) {
      try {
        const searchResults = await this.search(title);
        results.set(title, searchResults);
        await new Promise(resolve => setTimeout(resolve, 1000));
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
