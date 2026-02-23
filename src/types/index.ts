// =====================================================
// Core Type Definitions
// =====================================================

export type MediaType =
  | 'movie'
  | 'tv'
  | 'anime'
  | 'manga'
  | 'manhwa'
  | 'manhua'
  | 'donghua'
  | 'game'
  | 'book'
  | 'light_novel'
  | 'visual_novel'
  | 'web_series'
  | 'misc';

export type MediaStatus =
  | 'planned'
  | 'watching'
  | 'completed'
  | 'on_hold'
  | 'dropped'
  | 'rewatching'
  | 'archived';

export type HistoryAction =
  | 'status_change'
  | 'progress_update'
  | 'added'
  | 'updated'
  | 'deleted'
  | 'favorited'
  | 'unfavorited'
  | 'archived'
  | 'unarchived';

export type Pacing = 'slow' | 'moderate' | 'fast';

// =====================================================
// Main Media Type
// =====================================================

export interface Media {
  id: string;
  title: string;
  normalized_title: string;
  type: MediaType;
  poster_url: string | null;
  backdrop_url: string | null;
  description: string | null;
  release_year: number | null;
  api_rating: number | null;
  genres: string[];
  tags: string[];
  studios: string[];
  total_units: number;
  progress: number;
  completion_percent: number;
  status: MediaStatus;
  is_favorite: boolean;
  is_archived: boolean;
  notes: string | null;
  user_rating: number | null;
  streaming_platforms: StreamingPlatform[];
  
  // AI Fields
  ai_primary_tone: string | null;
  ai_secondary_tone: string | null;
  ai_core_themes: string[];
  ai_emotional_intensity: number | null;
  ai_pacing: Pacing | null;
  ai_darkness_level: number | null;
  ai_intellectual_depth: number | null;
  
  // External IDs
  tmdb_id: number | null;
  mal_id: number | null;
  rawg_id: number | null;
  google_books_id: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface StreamingPlatform {
  platform: string;
  type: 'subscription' | 'rent' | 'buy';
  url?: string;
}

// =====================================================
// History Type
// =====================================================

export interface History {
  id: string;
  media_id: string;
  action_type: HistoryAction;
  value: Record<string, unknown> | null;
  previous_value: Record<string, unknown> | null;
  created_at: string;
}

export interface HistoryWithMedia extends History {
  media: Pick<Media, 'id' | 'title' | 'type' | 'poster_url'>;
}

// =====================================================
// Smart Collection Type
// =====================================================

export interface SmartCollection {
  id: string;
  title: string;
  description: string | null;
  media_ids: string[];
  filter_criteria: FilterCriteria | null;
  is_auto_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface FilterCriteria {
  status?: MediaStatus[];
  type?: MediaType[];
  genres?: string[];
  tags?: string[];
  release_year?: { min?: number; max?: number };
  rating?: { min?: number; max?: number };
  is_favorite?: boolean;
  is_archived?: boolean;
}

// =====================================================
// App Settings Type
// =====================================================

export interface AppSettings {
  id: number;
  user_id: string | null;
  theme: 'dark' | 'light' | 'system';
  grid_size: number;
  default_view: 'grid' | 'list';
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Search & API Types
// =====================================================

export interface SearchResult {
  title: string;
  type: MediaType;
  poster_url: string | null;
  description: string | null;
  release_year: number | null;
  api_rating: number | null;
  genres: string[];
  total_units: number;
  external_id: string | number;
  confidence: number;
}

export interface TMDBResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  genre_ids: number[];
  media_type: 'movie' | 'tv';
}

export interface JikanResult {
  mal_id: number;
  title: string;
  images: {
    jpg: {
      image_url: string;
      large_image_url: string;
    };
  };
  synopsis: string;
  year: number | null;
  score: number;
  genres: Array<{ name: string }>;
  episodes: number | null;
  chapters: number | null;
  type: string;
}

export interface RAWGResult {
  id: number;
  name: string;
  background_image: string | null;
  description: string;
  released: string;
  rating: number;
  genres: Array<{ name: string }>;
  playtime: number;
}

export interface GoogleBooksResult {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    publishedDate?: string;
    averageRating?: number;
    pageCount?: number;
    categories?: string[];
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
  };
}

// =====================================================
// AI Types
// =====================================================

export interface AISuggestion {
  title: string;
  reason: string;
  similarity_score: number;
}

export interface AIRecommendation {
  title: string;
  reason: string;
  fit_score: number;
}

export interface AIBurnoutResult {
  burnout_detected: boolean;
  dominant_pattern: string;
  risk_level: 'low' | 'medium' | 'high';
  suggested_shift: string;
  recommended_genre_direction: string;
}

export interface AISmartCollection {
  title: string;
  description: string;
  media_titles: string[];
}

export interface AIMediaAnalysis {
  primary_tone: string;
  secondary_tone: string;
  core_themes: string[];
  emotional_intensity: number;
  pacing: Pacing;
  darkness_level: number;
  intellectual_depth: number;
}

export interface AIFallbackClassification {
  detected_type: MediaType;
  likely_genres: string[];
  confidence: number;
}

// =====================================================
// UI/State Types
// =====================================================

export type ViewMode = 'grid' | 'list';

export interface FilterState {
  status: MediaStatus[];
  type: MediaType[];
  genres: string[];
  tags: string[];
  release_year: { min?: number; max?: number };
  rating: { min?: number; max?: number };
  is_favorite: boolean | null;
  is_archived: boolean;
  search_query: string;
  sort_by: 'updated_at' | 'created_at' | 'title' | 'release_year' | 'rating' | 'completion_percent';
  sort_order: 'asc' | 'desc';
}

export interface SyncStatus {
  is_online: boolean;
  is_syncing: boolean;
  last_sync: string | null;
  pending_changes: number;
  conflict_count: number;
}

// =====================================================
// Analytics Types
// =====================================================

export interface AnalyticsData {
  total_count: number;
  completed_count: number;
  in_progress_count: number;
  planned_count: number;
  dropped_count: number;
  completion_rate: number;
  total_hours: number;
  genre_distribution: Record<string, number>;
  type_distribution: Record<MediaType, number>;
  status_distribution: Record<MediaStatus, number>;
  monthly_activity: Array<{ month: string; count: number }>;
  top_rated: Media[];
  watching_streak: number;
}

export interface CalendarEntry {
  date: string;
  completions: number;
  updates: number;
}
