import { createGeminiClient, GeminiClient } from './gemini';
import { createGroqClient, GroqClient } from './groq';
import type {
  AISuggestion,
  AIRecommendation,
  AIBurnoutResult,
  AISmartCollection,
  AIMediaAnalysis,
  AIFallbackClassification,
  Media,
  History,
  StreamingPlatform,
} from '@/types';

// Unified AI Client with Groq as primary
export class AIClient {
  private primary: GroqClient | null = null;
  private fallback: GeminiClient | null = null;
  private primaryType: 'gemini' | 'groq' = 'groq';

  constructor() {
    // Try Groq first (primary)
    try {
      this.primary = createGroqClient();
      this.primaryType = 'groq';
      console.log('✓ Groq AI initialized (primary)');
    } catch (error) {
      console.warn('Groq not configured, will try Gemini as primary');
      this.primary = null;
    }

    // Try Gemini as fallback (or primary if Groq failed)
    try {
      this.fallback = createGeminiClient();
      console.log('✓ Gemini AI initialized (fallback)');
      
      // If Groq failed, use Gemini as primary
      if (!this.primary) {
        this.primary = this.fallback as unknown as GroqClient;
        this.primaryType = 'gemini';
        this.fallback = null;
        console.log('Using Gemini as primary AI');
      }
    } catch (error) {
      console.warn('Gemini not configured');
      this.fallback = null;
      
      // If both failed, we have no AI
      if (!this.primary) {
        console.error('No AI service configured. Please add GROQ_API_KEY or GEMINI_API_KEY to .env.local');
      }
    }
  }

  private async callWithFallback<T>(
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
    featureName: string
  ): Promise<T | null> {
    // Check if AI is enabled (online only)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('AI disabled: offline mode');
      return null;
    }

    // Check if any AI is available
    if (!this.primary && !this.fallback) {
      console.warn('No AI service available');
      return null;
    }

    // Try primary
    if (this.primary) {
      try {
        return await primaryFn();
      } catch (error: any) {
        // Check if it's a rate limit error
        if (error?.message?.includes('429') || error?.message?.includes('quota')) {
          console.warn(`${featureName} rate limited, trying fallback...`);
        } else {
          console.warn(`${featureName} primary failed:`, error?.message || error);
        }
        
        // Try fallback if available
        if (this.fallback) {
          try {
            return await fallbackFn();
          } catch (fallbackError: any) {
            console.error(`${featureName} fallback failed:`, fallbackError?.message || fallbackError);
            return null;
          }
        }
        return null;
      }
    }

    // No primary, try fallback directly
    if (this.fallback) {
      try {
        return await fallbackFn();
      } catch (error: any) {
        console.error(`${featureName} failed:`, error?.message || error);
        return null;
      }
    }

    return null;
  }

  // 1. Similar Media Suggestions
  async getSuggestions(
    media: Pick<Media, 'title' | 'type' | 'genres' | 'description' | 'release_year'>
  ): Promise<AISuggestion[] | null> {
    if (!this.primary) return null;
    return this.callWithFallback(
      () => this.primary!.getSuggestions(media),
      () => this.fallback!.getSuggestions(media),
      'getSuggestions'
    );
  }

  // 2. "What should I watch tonight?"
  async getRecommendations(
    currentWatching: Media[],
    planned: Media[],
    recentlyCompleted: Media[],
    topGenres: string[],
    mood?: string,
    minutes?: number
  ): Promise<AIRecommendation[] | null> {
    if (!this.primary) return null;
    return this.callWithFallback(
      () => this.primary!.getRecommendations(
        currentWatching,
        planned,
        recentlyCompleted,
        topGenres,
        mood,
        minutes
      ),
      () => this.fallback!.getRecommendations(
        currentWatching,
        planned,
        recentlyCompleted,
        topGenres,
        mood,
        minutes
      ),
      'getRecommendations'
    );
  }

  // 3. Burnout Detection
  async detectBurnout(
    recentHistory: History[],
    genreCounts: Record<string, number>
  ): Promise<AIBurnoutResult | null> {
    if (!this.primary) return null;
    return this.callWithFallback(
      () => this.primary!.detectBurnout(recentHistory, genreCounts),
      () => this.fallback!.detectBurnout(recentHistory, genreCounts),
      'detectBurnout'
    );
  }

  // 4. Smart Collection Generator
  async generateSmartCollections(
    allMedia: Pick<Media, 'title' | 'type' | 'genres' | 'ai_primary_tone'>[]
  ): Promise<AISmartCollection[] | null> {
    if (!this.primary) return null;
    return this.callWithFallback(
      () => this.primary!.generateSmartCollections(allMedia),
      () => this.fallback!.generateSmartCollections(allMedia),
      'generateSmartCollections'
    );
  }

  // 5. Media Thematic Analysis
  async analyzeMedia(
    media: Pick<Media, 'title' | 'description' | 'genres'>
  ): Promise<AIMediaAnalysis | null> {
    if (!this.primary) return null;
    return this.callWithFallback(
      () => this.primary!.analyzeMedia(media),
      () => this.fallback!.analyzeMedia(media),
      'analyzeMedia'
    );
  }

  // 6. AI Fallback Classification
  async classifyMedia(title: string): Promise<AIFallbackClassification | null> {
    if (!this.primary) return null;
    return this.callWithFallback(
      () => this.primary!.classifyMedia(title),
      () => this.fallback!.classifyMedia(title),
      'classifyMedia'
    );
  }

  // 7. Streaming Availability Summary
  async summarizeStreamingData(
    rawData: string
  ): Promise<{ available_on: StreamingPlatform[] } | null> {
    if (!this.primary) return null;
    return this.callWithFallback(
      () => this.primary!.summarizeStreamingData(rawData),
      () => this.fallback!.summarizeStreamingData(rawData),
      'summarizeStreamingData'
    );
  }

  // Check if AI is available
  isAvailable(): boolean {
    return this.primary !== null;
  }
}

// Singleton instance
let aiClient: AIClient | null = null;

export const getAIClient = (): AIClient => {
  if (!aiClient) {
    aiClient = new AIClient();
  }
  return aiClient;
};
