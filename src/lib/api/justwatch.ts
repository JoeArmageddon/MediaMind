import type { StreamingPlatform } from '@/types';
import { fetchWithTimeout } from './http';
import { supabaseUrl, supabaseAnonKey } from '@/lib/db/supabase';

// Routed through a Supabase Edge Function (see supabase/functions/
// justwatch-proxy), same pattern as tmdb.ts - apis.justwatch.com/graphql
// sends no Access-Control-Allow-Origin header at all on its CORS
// preflight (confirmed directly), so the browser blocks every direct
// request to it regardless of query correctness. Server-to-server calls
// (this function -> JustWatch) aren't subject to CORS.
const JUSTWATCH_PROXY_URL = `${supabaseUrl}/functions/v1/justwatch-proxy`;

// JustWatch GraphQL queries.
//
// This previously used getSearchTitles/searchTitlesFilter and lowercase
// monetizationType values - JustWatch changed their schema (confirmed by
// querying it directly: the old query now fails validation outright,
// meaning "Find streaming" had a 100% failure rate, not an intermittent
// one). Current shape: searchTitles(filter, source), content/
// watchNowOffer/offers now each require their own country (+
// language/platform) arguments, and monetizationType values are
// UPPERCASE (FLATRATE/RENT/BUY) instead of lowercase.
const SEARCH_QUERY = `
  query GetSearchTitles($search: String!, $country: Country!, $language: Language!, $platform: Platform!) {
    searchTitles(
      filter: { searchQuery: $search }
      country: $country
      source: "SEARCH_BAR"
      first: 5
    ) {
      edges {
        node {
          content(country: $country, language: $language) {
            title
            fullPath
            originalReleaseYear
            externalIds {
              imdbId
            }
          }
          watchNowOffer(country: $country, platform: $platform) {
            standardWebURL
            package {
              clearName
              packageId
            }
            presentationType
            monetizationType
          }
          offers(country: $country, platform: $platform) {
            standardWebURL
            package {
              clearName
              packageId
            }
            presentationType
            monetizationType
          }
        }
      }
    }
  }
`;

export interface JustWatchOffer {
  standardWebURL: string;
  package: {
    clearName: string;
    packageId: number;
  };
  presentationType: string;
  monetizationType: string;
}

export interface JustWatchResult {
  content: {
    title: string;
    fullPath: string;
    originalReleaseYear: number;
    externalIds?: {
      imdbId?: string;
    };
  };
  watchNowOffer?: JustWatchOffer;
  offers?: JustWatchOffer[];
}

export class JustWatchClient {
  private country: string = 'IN'; // Default to India

  constructor(country: string = 'IN') {
    this.country = country;
  }

  async search(title: string, year?: number, signal?: AbortSignal): Promise<JustWatchResult | null> {
    try {
      const response = await fetchWithTimeout(JUSTWATCH_PROXY_URL, 15000, 'JustWatch', {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          query: SEARCH_QUERY,
          variables: {
            search: title,
            country: this.country,
            language: 'en',
            platform: 'WEB',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`JustWatch API error: ${response.status}`);
      }

      const data = await response.json();
      if (data?.errors) {
        throw new Error(`JustWatch GraphQL error: ${data.errors[0]?.message || 'unknown'}`);
      }
      const edges = data?.data?.searchTitles?.edges || [];

      if (edges.length === 0) return null;

      // Find best match
      let bestMatch = edges[0].node;

      if (year) {
        const exactMatch = edges.find(
          (edge: { node: JustWatchResult }) =>
            edge.node.content.originalReleaseYear === year
        );
        if (exactMatch) {
          bestMatch = exactMatch.node;
        }
      }

      return bestMatch;
    } catch (error) {
      console.error('JustWatch search error:', error);
      return null;
    }
  }

  async getStreamingAvailability(
    title: string,
    year?: number,
    signal?: AbortSignal
  ): Promise<StreamingPlatform[]> {
    const result = await this.search(title, year, signal);

    if (!result) return [];

    const platforms = new Map<string, StreamingPlatform>();

    // Process all offers
    const allOffers = [
      ...(result.watchNowOffer ? [result.watchNowOffer] : []),
      ...(result.offers || []),
    ];

    for (const offer of allOffers) {
      const name = offer.package.clearName;
      const type = this.mapMonetizationType(offer.monetizationType);

      // Prefer subscription over rent/buy
      if (!platforms.has(name) || type === 'subscription') {
        platforms.set(name, {
          platform: name,
          type,
          url: offer.standardWebURL,
        });
      }
    }

    return Array.from(platforms.values());
  }

  private mapMonetizationType(
    type: string
  ): 'subscription' | 'rent' | 'buy' {
    // JustWatch's current schema returns these UPPERCASE (FLATRATE/RENT/
    // BUY/FREE) - normalize case defensively rather than assume it stays
    // this way, since it already changed once.
    switch (type.toUpperCase()) {
      case 'FLATRATE':
      case 'FREE':
        return 'subscription';
      case 'RENT':
        return 'rent';
      case 'BUY':
        return 'buy';
      default:
        return 'subscription';
    }
  }

  // Common Indian streaming platforms
  static INDIAN_PLATFORMS = [
    'Netflix',
    'Amazon Prime Video',
    'Disney Plus Hotstar',
    'SonyLiv',
    'Zee5',
    'Jio Cinema',
    'MX Player',
    'Apple TV Plus',
    'YouTube',
    'Google Play Movies',
    'Hungama Play',
    'Eros Now',
    'Voot',
  ];
}

// Factory function
export const createJustWatchClient = () => new JustWatchClient('IN');
