import { createGeminiClient, GeminiClient } from './gemini';
import { createGroqClient, GroqClient } from './groq';
import { withAICache, AI_CACHE_TTL } from './cache';
import type {
  AISuggestion,
  AIRecommendation,
  AIBurnoutResult,
  AISmartCollection,
  AIMediaAnalysis,
  AIFallbackClassification,
  Media,
  HistoryEntry,
  StreamingPlatform,
} from '../types';

// Ported from src/lib/ai/index.ts - same Groq-primary/Gemini-fallback
// logic. The web version's "AI disabled: offline mode" pre-check
// (navigator.onLine) doesn't have a direct RN equivalent without adding
// @react-native-community/netinfo (not installed - Chunk A explicitly
// deferred full offline handling); dropped here rather than added as a
// half-measure - a genuinely offline device just fails the fetch itself
// and callWithFallback below handles that the same way it handles any
// other AI request failure.
export class AIClient {
  private primary: GroqClient | null = null;
  private fallback: GeminiClient | null = null;

  constructor() {
    try {
      this.primary = createGroqClient();
    } catch {
      this.primary = null;
    }

    try {
      this.fallback = createGeminiClient();
      if (!this.primary) {
        this.primary = this.fallback as unknown as GroqClient;
        this.fallback = null;
      }
    } catch {
      this.fallback = null;
    }
  }

  private async callWithFallback<T>(
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
    featureName: string
  ): Promise<T | null> {
    if (!this.primary && !this.fallback) {
      console.warn('No AI service available');
      return null;
    }

    if (this.primary) {
      try {
        return await primaryFn();
      } catch (error: any) {
        if (error?.message?.includes('429') || error?.message?.includes('quota')) {
          console.warn(`${featureName} rate limited, trying fallback...`);
        } else {
          console.warn(`${featureName} primary failed:`, error?.message || error);
        }

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
    return withAICache('getSuggestions', `${media.type}:${media.title}`, AI_CACHE_TTL.THIRTY_DAYS, () =>
      this.callWithFallback(
        () => this.primary!.getSuggestions(media),
        () => this.fallback!.getSuggestions(media),
        'getSuggestions'
      )
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
      () => this.primary!.getRecommendations(currentWatching, planned, recentlyCompleted, topGenres, mood, minutes),
      () => this.fallback!.getRecommendations(currentWatching, planned, recentlyCompleted, topGenres, mood, minutes),
      'getRecommendations'
    );
  }

  // 3. Burnout Detection
  async detectBurnout(
    recentHistory: HistoryEntry[],
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
    allMedia: Pick<Media, 'title' | 'type' | 'genres' | 'ai_primary_tone'>[],
    avoidTitles: string[] = []
  ): Promise<AISmartCollection[] | null> {
    if (!this.primary) return null;
    return this.callWithFallback(
      () => this.primary!.generateSmartCollections(allMedia, avoidTitles),
      () => this.fallback!.generateSmartCollections(allMedia, avoidTitles),
      'generateSmartCollections'
    );
  }

  // 5. Media Thematic Analysis
  async analyzeMedia(media: Pick<Media, 'title' | 'description' | 'genres'>): Promise<AIMediaAnalysis | null> {
    if (!this.primary) return null;
    return withAICache('analyzeMedia', media.title, AI_CACHE_TTL.THIRTY_DAYS, () =>
      this.callWithFallback(
        () => this.primary!.analyzeMedia(media),
        () => this.fallback!.analyzeMedia(media),
        'analyzeMedia'
      )
    );
  }

  // 6. AI Fallback Classification
  async classifyMedia(title: string): Promise<AIFallbackClassification | null> {
    if (!this.primary) return null;
    return withAICache('classifyMedia', title, AI_CACHE_TTL.THIRTY_DAYS, () =>
      this.callWithFallback(
        () => this.primary!.classifyMedia(title),
        () => this.fallback!.classifyMedia(title),
        'classifyMedia'
      )
    );
  }

  // 7. Streaming Availability Summary
  async summarizeStreamingData(rawData: string): Promise<{ available_on: StreamingPlatform[] } | null> {
    if (!this.primary) return null;
    return this.callWithFallback(
      () => this.primary!.summarizeStreamingData(rawData),
      () => this.fallback!.summarizeStreamingData(rawData),
      'summarizeStreamingData'
    );
  }

  // 8. Descriptive Tag Suggestions
  async suggestTags(media: Pick<Media, 'title' | 'type' | 'description' | 'genres'>): Promise<string[] | null> {
    if (!this.primary) return null;
    return withAICache('suggestTags', `${media.type}:${media.title}`, AI_CACHE_TTL.THIRTY_DAYS, () =>
      this.callWithFallback(
        () => this.primary!.suggestTags(media),
        () => this.fallback!.suggestTags(media),
        'suggestTags'
      )
    );
  }

  isAvailable(): boolean {
    return this.primary !== null;
  }
}

// Create fresh AI client each time to pick up new keys from SecureStore.
export const getAIClient = (): AIClient => new AIClient();
