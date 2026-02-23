import type { SearchResult, MediaType } from '@/types';
import { createTMDBClient } from './tmdb';
import { createJikanClient } from './jikan';
import { createRAWGClient } from './rawg';
import { createBooksClient } from './books';
import { getAIClient } from '@/lib/ai';

export class SearchOrchestrator {
  private tmdb = createTMDBClient();
  private jikan = createJikanClient();
  private rawg = createRAWGClient();
  private books = createBooksClient();
  private ai = getAIClient();

  async search(title: string, preferredType?: MediaType): Promise<SearchResult[]> {
    console.log(`=== SEARCH START === Query: "${title}", Type: ${preferredType || 'all'}`);
    
    const results: SearchResult[] = [];
    const errors: string[] = [];

    try {
      // Movies & TV from TMDB
      if (!preferredType || ['movie', 'tv'].includes(preferredType)) {
        console.log('Searching TMDB...');
        try {
          const tmdbResults = await this.tmdb.searchMulti(title);
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

      // Anime, Manga, Manhwa, Donghua from Jikan
      if (!preferredType || ['anime', 'manga', 'manhwa', 'manhua', 'donghua'].includes(preferredType)) {
        console.log('Searching Jikan...');
        try {
          if (results.length > 0) await new Promise(r => setTimeout(r, 800));
          
          const jikanResults = await this.jikan.searchAll(title);
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
              const aiResult = await this.ai.classifyMedia(title);
              
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

      // Games from RAWG
      if (!preferredType || preferredType === 'game') {
        console.log('Searching RAWG...');
        try {
          if (results.length > 0) await new Promise(r => setTimeout(r, 500));
          
          const rawgResults = await this.rawg.searchGames(title);
          console.log(`RAWG found: ${rawgResults.length} results`);
          results.push(...rawgResults);
        } catch (e) {
          const msg = `RAWG error: ${e}`;
          console.error(msg);
          errors.push(msg);
        }
      }

      // Books from Google Books
      if (!preferredType || ['book', 'light_novel', 'visual_novel'].includes(preferredType)) {
        console.log('Searching Google Books...');
        try {
          if (results.length > 0) await new Promise(r => setTimeout(r, 500));
          
          const bookResults = await this.books.searchBooks(title);
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
