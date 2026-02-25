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

// Detect if we're on a mobile device
const isMobile = () => {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Retry wrapper with exponential backoff
const withRetry = async <T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries: number = 2
): Promise<T> => {
  let lastError: any;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      console.log(`[${label}] Attempt ${i + 1}/${maxRetries + 1}`);
      return await fn();
    } catch (error: any) {
      lastError = error;
      console.warn(`[${label}] Attempt ${i + 1} failed:`, error?.message || error);
      
      if (i < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = 1000 * Math.pow(2, i);
        console.log(`[${label}] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

export class SearchOrchestrator {
  private tmdb = createTMDBClient();
  private jikan = createJikanClient();
  private rawg = createRAWGClient();
  private books = createBooksClient();
  private ai = getAIClient();

  async search(title: string, preferredType?: MediaType): Promise<SearchResult[]> {
    console.log(`=== SEARCH START === Query: "${title}", Type: ${preferredType || 'all'}, Mobile: ${isMobile()}`);
    
    const results: SearchResult[] = [];
    const errors: string[] = [];
    const mobile = isMobile();

    // Define which APIs to call based on preferred type
    const shouldSearchTMDB = !preferredType || ['movie', 'tv'].includes(preferredType);
    const shouldSearchJikan = !preferredType || ['anime', 'manga', 'manhwa', 'manhua', 'donghua'].includes(preferredType);
    const shouldSearchRAWG = !preferredType || preferredType === 'game';
    const shouldSearchBooks = !preferredType || ['book', 'light_novel', 'visual_novel'].includes(preferredType);

    // TMDB search - with long timeout and retry
    if (shouldSearchTMDB) {
      console.log('Searching TMDB...');
      try {
        await withRetry(async () => {
          // Initialize client first
          await withTimeout(this.tmdb.init(), 5000, 'TMDB init');
          
          // Search with LONG timeout for mobile networks
          const tmdbResults = await withTimeout(
            this.tmdb.searchMulti(title),
            mobile ? 20000 : 15000, // 20s on mobile, 15s on desktop
            'TMDB'
          );
          
          console.log(`TMDB found: ${tmdbResults.length} results`);
          
          const filtered = preferredType 
            ? tmdbResults.filter(r => r.type === preferredType)
            : tmdbResults;
          
          results.push(...filtered);
        }, 'TMDB', 2); // 2 retries
      } catch (e: any) {
        const msg = `TMDB: ${e?.message || 'Failed'}`;
        console.error(msg);
        errors.push(msg);
        // Don't throw - continue with other APIs
      }
    }

    // Jikan search - with timeout and retry
    if (shouldSearchJikan) {
      console.log('Searching Jikan...');
      try {
        // Small delay to avoid hammering APIs simultaneously
        if (shouldSearchTMDB) {
          await new Promise(r => setTimeout(r, 300));
        }
        
        await withRetry(async () => {
          const jikanResults = await withTimeout(
            this.jikan.searchAll(title),
            mobile ? 25000 : 20000, // Longer timeout for Jikan (it's slower)
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
          if (mappedResults.length === 0 && this.ai.isAvailable()) {
            console.log('No Jikan results - trying AI classification...');
            try {
              const aiResult = await withTimeout(
                this.ai.classifyMedia(title),
                10000,
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
        }, 'Jikan', 2);
      } catch (e: any) {
        const msg = `Jikan: ${e?.message || 'Failed'}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    // RAWG search - games
    if (shouldSearchRAWG) {
      console.log('Searching RAWG...');
      try {
        if (shouldSearchTMDB || shouldSearchJikan) {
          await new Promise(r => setTimeout(r, 200));
        }
        
        await withRetry(async () => {
          await this.rawg.init();
          const rawgResults = await withTimeout(
            this.rawg.searchGames(title),
            mobile ? 20000 : 15000,
            'RAWG'
          );
          console.log(`RAWG found: ${rawgResults.length} results`);
          results.push(...rawgResults);
        }, 'RAWG', 2);
      } catch (e: any) {
        const msg = `RAWG: ${e?.message || 'Failed'}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    // Books search
    if (shouldSearchBooks) {
      console.log('Searching Google Books...');
      try {
        if (shouldSearchTMDB || shouldSearchJikan || shouldSearchRAWG) {
          await new Promise(r => setTimeout(r, 300));
        }
        
        await withRetry(async () => {
          await this.books.init();
          const bookResults = await withTimeout(
            this.books.searchBooks(title),
            mobile ? 20000 : 15000,
            'Google Books'
          );
          console.log(`Google Books found: ${bookResults.length} results`);
          results.push(...bookResults);
        }, 'Books', 2);
      } catch (e: any) {
        const msg = `Books: ${e?.message || 'Failed'}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    // Sort by confidence/popularity
    results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    
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
