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

  // Local-only bookkeeping (Dexie/IndexedDB) - never a real column in
  // Supabase, always stripped before any insert/upsert (see mediaStore's
  // stripForSupabase). true once this exact row is confirmed to exist in
  // Supabase; undefined/false means "created locally, not confirmed synced
  // yet" - the distinction fetchMedia's merge needs to tell "genuinely
  // local-only, should be uploaded" apart from "used to be synced, is now
  // absent from a fresh fetch because it was deleted elsewhere, should be
  // pruned locally instead of resurrected".
  synced?: boolean;
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
// Friends Type
// =====================================================

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

// A friendship row annotated with the other party's Clerk profile info,
// resolved server-side (the client can't look up Clerk users directly).
export interface FriendshipWithProfile extends Friendship {
  otherUser: {
    id: string;
    name: string;
    email: string | null;
    imageUrl: string | null;
  } | null;
}

// A history row belonging to an accepted friend, for the dashboard's
// "Friends' Activity" feed - joined with both the media it's about and the
// friend who did it.
export interface FriendActivityEntry extends History {
  media: Pick<Media, 'id' | 'title' | 'type' | 'poster_url'> | null;
  friend: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
}

// =====================================================
// Collection Sharing Type
// =====================================================

export interface CollectionShare {
  id: string;
  collection_id: string;
  owner_id: string;
  shared_with_id: string;
  created_at: string;
}

// A share row for a collection I own, annotated with who it's shared with.
export interface CollectionShareWithProfile extends CollectionShare {
  recipient: { id: string; name: string; imageUrl: string | null } | null;
}

// A collection someone else shared with me, annotated with who owns it.
export interface SharedCollection extends SmartCollection {
  owner: { id: string; name: string; imageUrl: string | null } | null;
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
