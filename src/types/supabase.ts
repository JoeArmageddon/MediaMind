export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_cache: {
        Row: {
          cache_key: string
          created_at: string | null
          expires_at: string
          id: string
          response_data: Json
          response_type: string
        }
        Insert: {
          cache_key: string
          created_at?: string | null
          expires_at: string
          id?: string
          response_data: Json
          response_type: string
        }
        Update: {
          cache_key?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          response_data?: Json
          response_type?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          clerk_user_id: string | null
          created_at: string | null
          default_view: string | null
          grid_size: number | null
          id: number
          last_sync_at: string | null
          theme: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          clerk_user_id?: string | null
          created_at?: string | null
          default_view?: string | null
          grid_size?: number | null
          id?: number
          last_sync_at?: string | null
          theme?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          clerk_user_id?: string | null
          created_at?: string | null
          default_view?: string | null
          grid_size?: number | null
          id?: number
          last_sync_at?: string | null
          theme?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      collection_invite_codes: {
        Row: {
          code: string
          collection_id: string
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          code: string
          collection_id: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          collection_id?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_invite_codes_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: true
            referencedRelation: "smart_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_shares: {
        Row: {
          collection_id: string
          created_at: string | null
          id: string
          owner_id: string
          shared_with_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string | null
          id?: string
          owner_id: string
          shared_with_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string | null
          id?: string
          owner_id?: string
          shared_with_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_shares_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "smart_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_invite_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string | null
          id: string
          requester_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          addressee_id: string
          created_at?: string | null
          id?: string
          requester_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          addressee_id?: string
          created_at?: string | null
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      history: {
        Row: {
          action_type: Database["public"]["Enums"]["history_action"]
          created_at: string | null
          id: string
          media_id: string | null
          previous_value: Json | null
          user_id: string | null
          value: Json | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["history_action"]
          created_at?: string | null
          id?: string
          media_id?: string | null
          previous_value?: Json | null
          user_id?: string | null
          value?: Json | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["history_action"]
          created_at?: string | null
          id?: string
          media_id?: string | null
          previous_value?: Json | null
          user_id?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      media: {
        Row: {
          ai_core_themes: string[] | null
          ai_darkness_level: number | null
          ai_emotional_intensity: number | null
          ai_intellectual_depth: number | null
          ai_pacing: string | null
          ai_primary_tone: string | null
          ai_secondary_tone: string | null
          api_rating: number | null
          backdrop_url: string | null
          completed_at: string | null
          completion_percent: number | null
          created_at: string | null
          description: string | null
          genres: string[] | null
          google_books_id: string | null
          id: string
          is_archived: boolean | null
          is_favorite: boolean | null
          mal_id: number | null
          normalized_title: string | null
          notes: string | null
          poster_url: string | null
          progress: number | null
          rawg_id: number | null
          release_year: number | null
          status: Database["public"]["Enums"]["media_status"] | null
          streaming_platforms: Json | null
          studios: string[] | null
          tags: string[] | null
          title: string
          tmdb_id: number | null
          total_units: number | null
          type: Database["public"]["Enums"]["media_type"]
          updated_at: string | null
          user_id: string | null
          user_rating: number | null
        }
        Insert: {
          ai_core_themes?: string[] | null
          ai_darkness_level?: number | null
          ai_emotional_intensity?: number | null
          ai_intellectual_depth?: number | null
          ai_pacing?: string | null
          ai_primary_tone?: string | null
          ai_secondary_tone?: string | null
          api_rating?: number | null
          backdrop_url?: string | null
          completed_at?: string | null
          completion_percent?: number | null
          created_at?: string | null
          description?: string | null
          genres?: string[] | null
          google_books_id?: string | null
          id?: string
          is_archived?: boolean | null
          is_favorite?: boolean | null
          mal_id?: number | null
          normalized_title?: string | null
          notes?: string | null
          poster_url?: string | null
          progress?: number | null
          rawg_id?: number | null
          release_year?: number | null
          status?: Database["public"]["Enums"]["media_status"] | null
          streaming_platforms?: Json | null
          studios?: string[] | null
          tags?: string[] | null
          title: string
          tmdb_id?: number | null
          total_units?: number | null
          type: Database["public"]["Enums"]["media_type"]
          updated_at?: string | null
          user_id?: string | null
          user_rating?: number | null
        }
        Update: {
          ai_core_themes?: string[] | null
          ai_darkness_level?: number | null
          ai_emotional_intensity?: number | null
          ai_intellectual_depth?: number | null
          ai_pacing?: string | null
          ai_primary_tone?: string | null
          ai_secondary_tone?: string | null
          api_rating?: number | null
          backdrop_url?: string | null
          completed_at?: string | null
          completion_percent?: number | null
          created_at?: string | null
          description?: string | null
          genres?: string[] | null
          google_books_id?: string | null
          id?: string
          is_archived?: boolean | null
          is_favorite?: boolean | null
          mal_id?: number | null
          normalized_title?: string | null
          notes?: string | null
          poster_url?: string | null
          progress?: number | null
          rawg_id?: number | null
          release_year?: number | null
          status?: Database["public"]["Enums"]["media_status"] | null
          streaming_platforms?: Json | null
          studios?: string[] | null
          tags?: string[] | null
          title?: string
          tmdb_id?: number | null
          total_units?: number | null
          type?: Database["public"]["Enums"]["media_type"]
          updated_at?: string | null
          user_id?: string | null
          user_rating?: number | null
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          api_rating: number | null
          created_at: string
          description: string | null
          from_user_id: string
          genres: string[] | null
          google_books_id: string | null
          id: string
          is_read: boolean
          mal_id: number | null
          message: string | null
          poster_url: string | null
          rawg_id: number | null
          release_year: number | null
          title: string
          tmdb_id: number | null
          to_user_id: string
          type: Database["public"]["Enums"]["media_type"]
        }
        Insert: {
          api_rating?: number | null
          created_at?: string
          description?: string | null
          from_user_id: string
          genres?: string[] | null
          google_books_id?: string | null
          id?: string
          is_read?: boolean
          mal_id?: number | null
          message?: string | null
          poster_url?: string | null
          rawg_id?: number | null
          release_year?: number | null
          title: string
          tmdb_id?: number | null
          to_user_id: string
          type: Database["public"]["Enums"]["media_type"]
        }
        Update: {
          api_rating?: number | null
          created_at?: string
          description?: string | null
          from_user_id?: string
          genres?: string[] | null
          google_books_id?: string | null
          id?: string
          is_read?: boolean
          mal_id?: number | null
          message?: string | null
          poster_url?: string | null
          rawg_id?: number | null
          release_year?: number | null
          title?: string
          tmdb_id?: number | null
          to_user_id?: string
          type?: Database["public"]["Enums"]["media_type"]
        }
        Relationships: []
      }
      smart_collections: {
        Row: {
          created_at: string | null
          description: string | null
          filter_criteria: Json | null
          id: string
          is_auto_generated: boolean | null
          is_public: boolean
          media_ids: string[] | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          filter_criteria?: Json | null
          id?: string
          is_auto_generated?: boolean | null
          is_public?: boolean
          media_ids?: string[] | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          filter_criteria?: Json | null
          id?: string
          is_auto_generated?: boolean | null
          is_public?: boolean
          media_ids?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      preview_collection_code: {
        Args: { target_code: string }
        Returns: {
          collection_id: string
          description: string
          item_count: number
          owner_id: string
          title: string
        }[]
      }
      preview_friend_code: { Args: { target_code: string }; Returns: string }
      redeem_collection_code: { Args: { target_code: string }; Returns: string }
      redeem_friend_code: { Args: { target_code: string }; Returns: string }
    }
    Enums: {
      history_action:
        | "status_change"
        | "progress_update"
        | "added"
        | "updated"
        | "deleted"
        | "favorited"
        | "unfavorited"
        | "archived"
        | "unarchived"
      media_status:
        | "planned"
        | "watching"
        | "completed"
        | "on_hold"
        | "dropped"
        | "rewatching"
        | "archived"
      media_type:
        | "movie"
        | "tv"
        | "anime"
        | "manga"
        | "manhwa"
        | "game"
        | "book"
        | "light_novel"
        | "visual_novel"
        | "web_series"
        | "misc"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      history_action: [
        "status_change",
        "progress_update",
        "added",
        "updated",
        "deleted",
        "favorited",
        "unfavorited",
        "archived",
        "unarchived",
      ],
      media_status: [
        "planned",
        "watching",
        "completed",
        "on_hold",
        "dropped",
        "rewatching",
        "archived",
      ],
      media_type: [
        "movie",
        "tv",
        "anime",
        "manga",
        "manhwa",
        "game",
        "book",
        "light_novel",
        "visual_novel",
        "web_series",
        "misc",
      ],
    },
  },
} as const
