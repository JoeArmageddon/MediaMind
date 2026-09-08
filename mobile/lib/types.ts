// Ported from the web app's src/types/index.ts (Chunk A subset - AI and
// friends/social types are added when those chunks land on mobile).

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

export interface StreamingPlatform {
  platform: string;
  type: 'subscription' | 'rent' | 'buy';
  url?: string;
}

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

  ai_primary_tone: string | null;
  ai_secondary_tone: string | null;
  ai_core_themes: string[];
  ai_emotional_intensity: number | null;
  ai_pacing: Pacing | null;
  ai_darkness_level: number | null;
  ai_intellectual_depth: number | null;

  tmdb_id: number | null;
  mal_id: number | null;
  rawg_id: number | null;
  google_books_id: string | null;

  created_at: string;
  updated_at: string;
  completed_at: string | null;

  // Local-only bookkeeping (AsyncStorage cache) - never a real Supabase
  // column, always stripped before any write. Same purpose as the web
  // app's mediaStore: distinguishes a genuinely-new local item from one
  // that was deleted elsewhere and just hasn't been pruned from this
  // device's cache yet, once Chunk B adds a real sync queue. For Chunk A
  // (online-first, no offline writes) this mostly just gets set true on
  // every row that ever comes from a real fetch.
  synced?: boolean;
}

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
// Friends (Chunk D - ported from src/types/index.ts)
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
// resolved server-side (mobile has no server component of its own, so
// this hits the same deployed Next.js API routes the web app uses - see
// lib/api/friends.ts).
export interface FriendshipWithProfile extends Friendship {
  otherUser: {
    id: string;
    name: string;
    email: string | null;
    imageUrl: string | null;
  } | null;
}

// A history row belonging to an accepted friend, for the dashboard's
// "Friends' Activity" section.
export interface HistoryEntry {
  id: string;
  media_id: string;
  action_type: HistoryAction;
  value: unknown;
  previous_value: unknown;
  created_at: string;
  user_id: string;
}

export interface FriendActivityEntry extends HistoryEntry {
  media: Pick<Media, 'id' | 'title' | 'type' | 'poster_url'> | null;
  friend: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
}
