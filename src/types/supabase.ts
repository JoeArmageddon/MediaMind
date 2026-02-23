export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      media: {
        Row: {
          id: string
          title: string
          normalized_title: string
          type: string
          poster_url: string | null
          backdrop_url: string | null
          description: string | null
          release_year: number | null
          api_rating: number | null
          genres: string[]
          tags: string[]
          studios: string[]
          total_units: number
          progress: number
          completion_percent: number
          status: string
          is_favorite: boolean
          is_archived: boolean
          notes: string | null
          user_rating: number | null
          streaming_platforms: Json
          ai_primary_tone: string | null
          ai_secondary_tone: string | null
          ai_core_themes: string[]
          ai_emotional_intensity: number | null
          ai_pacing: string | null
          ai_darkness_level: number | null
          ai_intellectual_depth: number | null
          tmdb_id: number | null
          mal_id: number | null
          rawg_id: number | null
          google_books_id: string | null
          created_at: string
          updated_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          title: string
          normalized_title?: string
          type: string
          poster_url?: string | null
          backdrop_url?: string | null
          description?: string | null
          release_year?: number | null
          api_rating?: number | null
          genres?: string[]
          tags?: string[]
          studios?: string[]
          total_units?: number
          progress?: number
          completion_percent?: number
          status?: string
          is_favorite?: boolean
          is_archived?: boolean
          notes?: string | null
          user_rating?: number | null
          streaming_platforms?: Json
          ai_primary_tone?: string | null
          ai_secondary_tone?: string | null
          ai_core_themes?: string[]
          ai_emotional_intensity?: number | null
          ai_pacing?: string | null
          ai_darkness_level?: number | null
          ai_intellectual_depth?: number | null
          tmdb_id?: number | null
          mal_id?: number | null
          rawg_id?: number | null
          google_books_id?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          normalized_title?: string
          type?: string
          poster_url?: string | null
          backdrop_url?: string | null
          description?: string | null
          release_year?: number | null
          api_rating?: number | null
          genres?: string[]
          tags?: string[]
          studios?: string[]
          total_units?: number
          progress?: number
          completion_percent?: number
          status?: string
          is_favorite?: boolean
          is_archived?: boolean
          notes?: string | null
          user_rating?: number | null
          streaming_platforms?: Json
          ai_primary_tone?: string | null
          ai_secondary_tone?: string | null
          ai_core_themes?: string[]
          ai_emotional_intensity?: number | null
          ai_pacing?: string | null
          ai_darkness_level?: number | null
          ai_intellectual_depth?: number | null
          tmdb_id?: number | null
          mal_id?: number | null
          rawg_id?: number | null
          google_books_id?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
      }
      history: {
        Row: {
          id: string
          media_id: string
          action_type: string
          value: Json | null
          previous_value: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          media_id: string
          action_type: string
          value?: Json | null
          previous_value?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          media_id?: string
          action_type?: string
          value?: Json | null
          previous_value?: Json | null
          created_at?: string
        }
      }
      smart_collections: {
        Row: {
          id: string
          title: string
          description: string | null
          media_ids: string[]
          filter_criteria: Json | null
          is_auto_generated: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          media_ids?: string[]
          filter_criteria?: Json | null
          is_auto_generated?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          media_ids?: string[]
          filter_criteria?: Json | null
          is_auto_generated?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      app_settings: {
        Row: {
          id: number
          user_id: string | null
          theme: string
          grid_size: number
          default_view: string
          last_sync_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id?: string | null
          theme?: string
          grid_size?: number
          default_view?: string
          last_sync_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string | null
          theme?: string
          grid_size?: number
          default_view?: string
          last_sync_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
