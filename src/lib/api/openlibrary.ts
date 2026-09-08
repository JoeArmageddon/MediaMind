import type { SearchResult } from '@/types';
import { fetchWithTimeout } from './http';

// Open Library's search API - free, no API key, and covers a much broader
// (if sometimes less richly-described) catalog than Google Books alone,
// including many older/less mainstream titles Google Books misses.
const OPEN_LIBRARY_URL = 'https://openlibrary.org/search.json';
const COVER_BASE = 'https://covers.openlibrary.org/b/id';

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  subject?: string[];
  ratings_average?: number;
  first_sentence?: string[] | string;
}

interface OpenLibraryResponse {
  docs: OpenLibraryDoc[];
}

function normalize(doc: OpenLibraryDoc): SearchResult {
  const firstSentence = Array.isArray(doc.first_sentence) ? doc.first_sentence[0] : doc.first_sentence;
  const description = firstSentence || (doc.author_name ? `By ${doc.author_name.slice(0, 3).join(', ')}` : null);

  return {
    title: doc.title,
    type: 'book',
    poster_url: doc.cover_i ? `${COVER_BASE}/${doc.cover_i}-L.jpg` : null,
    description,
    release_year: doc.first_publish_year ?? null,
    api_rating: doc.ratings_average ? Math.min(doc.ratings_average * 2, 10) : null, // Open Library uses 0-5
    genres: (doc.subject || []).slice(0, 5),
    total_units: 0,
    external_id: `openlibrary-${doc.key}`,
    confidence: doc.ratings_average ? Math.min(doc.ratings_average / 5, 1) : 0.5,
  };
}

export class OpenLibraryClient {
  async searchBooks(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    try {
      const url = `${OPEN_LIBRARY_URL}?q=${encodeURIComponent(query)}&limit=15&fields=key,title,author_name,first_publish_year,cover_i,subject,ratings_average,first_sentence`;
      const response = await fetchWithTimeout(url, 15000, 'Open Library', { signal });

      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error(`Open Library API error: ${response.status}`);
      }

      const data: OpenLibraryResponse = await response.json();
      return (data.docs || []).map(normalize);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      console.error('Open Library search error:', error);
      return [];
    }
  }
}

let client: OpenLibraryClient | null = null;

export const createOpenLibraryClient = (): OpenLibraryClient => {
  if (!client) client = new OpenLibraryClient();
  return client;
};
