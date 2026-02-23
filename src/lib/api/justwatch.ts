import type { StreamingPlatform } from '@/types';

const JUSTWATCH_BASE_URL = 'https://apis.justwatch.com/graphql';

// JustWatch GraphQL queries
const SEARCH_QUERY = `
  query GetSearchTitles($search: String!, $country: String!) {
    getSearchTitles(
      searchTitlesFilter: { searchQuery: $search }
      country: $country
      first: 5
    ) {
      edges {
        node {
          content {
            title
            fullPath
            originalReleaseYear
            externalIds {
              imdbId
            }
          }
          watchNowOffer {
            standardWebURL
            package {
              clearName
              packageId
            }
            presentationType
            monetizationType
          }
          offers {
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
  monetizationType: 'flatrate' | 'rent' | 'buy' | 'free';
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

  async search(title: string, year?: number): Promise<JustWatchResult | null> {
    try {
      const response = await fetch(JUSTWATCH_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query: SEARCH_QUERY,
          variables: {
            search: title,
            country: this.country,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`JustWatch API error: ${response.status}`);
      }

      const data = await response.json();
      const edges = data?.data?.getSearchTitles?.edges || [];

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
    year?: number
  ): Promise<StreamingPlatform[]> {
    const result = await this.search(title, year);
    
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
    switch (type) {
      case 'flatrate':
      case 'free':
        return 'subscription';
      case 'rent':
        return 'rent';
      case 'buy':
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
