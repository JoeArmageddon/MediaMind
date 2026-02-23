import type { GoogleBooksResult, SearchResult } from '@/types';

const GOOGLE_BOOKS_BASE_URL = 'https://www.googleapis.com/books/v1';

export class GoogleBooksClient {
  private apiKey: string | null;

  constructor(apiKey: string | null = null) {
    this.apiKey = apiKey;
  }

  private async fetch<T>(endpoint: string): Promise<T | null> {
    try {
      const keyParam = this.apiKey ? `&key=${this.apiKey}` : '';
      const response = await fetch(
        `${GOOGLE_BOOKS_BASE_URL}${endpoint}${keyParam}`
      );
      
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Google Books API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Google Books fetch error:', error);
      return null;
    }
  }

  async searchBooks(query: string): Promise<SearchResult[]> {
    const data = await this.fetch<{ items: GoogleBooksResult[] }>(
      `/volumes?q=${encodeURIComponent(query)}&maxResults=10&orderBy=relevance&printType=books`
    );

    if (!data?.items) return [];

    return data.items.map((item) => this.normalizeBook(item));
  }

  async getBookDetails(id: string): Promise<SearchResult | null> {
    const data = await this.fetch<GoogleBooksResult>(`/volumes/${id}`);
    if (!data) return null;
    return this.normalizeBook(data);
  }

  private normalizeBook(item: GoogleBooksResult): SearchResult {
    const info = item.volumeInfo;
    const year = info.publishedDate
      ? parseInt(info.publishedDate.split('-')[0])
      : null;
    
    // Determine type based on categories
    const type = this.determineBookType(info.categories);

    return {
      title: info.title,
      type,
      poster_url: info.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
      description: info.description || null,
      release_year: year,
      api_rating: info.averageRating ? info.averageRating * 2 : null, // Convert 0-5 to 0-10
      genres: info.categories || [],
      total_units: info.pageCount || 0,
      external_id: item.id,
      confidence: info.averageRating ? info.averageRating / 5 : 0.5,
    };
  }

  private determineBookType(categories: string[] | undefined): 'book' | 'light_novel' | 'visual_novel' {
    if (!categories) return 'book';
    
    const cats = categories.join(' ').toLowerCase();
    
    if (cats.includes('light novel') || cats.includes('lightnovel')) {
      return 'light_novel';
    }
    
    if (cats.includes('visual novel') || cats.includes('visualnovel')) {
      return 'visual_novel';
    }
    
    return 'book';
  }
}

// Factory function
export const createBooksClient = () => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY || null;
  return new GoogleBooksClient(apiKey);
};
