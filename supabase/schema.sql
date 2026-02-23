-- =====================================================
-- Personal Media Intelligence - Supabase Schema
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUM TYPES
-- =====================================================

CREATE TYPE media_type AS ENUM (
  'movie',
  'tv',
  'anime',
  'manga',
  'manhwa',
  'game',
  'book',
  'light_novel',
  'visual_novel',
  'web_series',
  'misc'
);

CREATE TYPE media_status AS ENUM (
  'planned',
  'watching',
  'completed',
  'on_hold',
  'dropped',
  'rewatching',
  'archived'
);

CREATE TYPE history_action AS ENUM (
  'status_change',
  'progress_update',
  'added',
  'updated',
  'deleted',
  'favorited',
  'unfavorited',
  'archived',
  'unarchived'
);

-- =====================================================
-- TABLES
-- =====================================================

-- Main Media Table
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Core Info
  title TEXT NOT NULL,
  normalized_title TEXT GENERATED ALWAYS AS (LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9]', '', 'g'))) STORED,
  type media_type NOT NULL,
  
  -- Visual
  poster_url TEXT,
  backdrop_url TEXT,
  description TEXT,
  
  -- Metadata
  release_year INTEGER,
  api_rating DECIMAL(3,1),
  genres TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  studios TEXT[] DEFAULT '{}',
  
  -- Progress Tracking
  total_units INTEGER DEFAULT 0, -- episodes, chapters, pages, 100 for games
  progress INTEGER DEFAULT 0,
  completion_percent DECIMAL(5,2) DEFAULT 0,
  
  -- Status
  status media_status DEFAULT 'planned',
  is_favorite BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  
  -- User Content
  notes TEXT,
  user_rating DECIMAL(3,1),
  
  -- Streaming Info (India)
  streaming_platforms JSONB DEFAULT '[]',
  
  -- AI Enrichment (Optional)
  ai_primary_tone TEXT,
  ai_secondary_tone TEXT,
  ai_core_themes TEXT[] DEFAULT '{}',
  ai_emotional_intensity INTEGER CHECK (ai_emotional_intensity BETWEEN 0 AND 100),
  ai_pacing TEXT CHECK (ai_pacing IN ('slow', 'moderate', 'fast')),
  ai_darkness_level INTEGER CHECK (ai_darkness_level BETWEEN 0 AND 100),
  ai_intellectual_depth INTEGER CHECK (ai_intellectual_depth BETWEEN 0 AND 100),
  
  -- External IDs
  tmdb_id INTEGER,
  mal_id INTEGER,
  rawg_id INTEGER,
  google_books_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT unique_title_type UNIQUE (normalized_title, type),
  CONSTRAINT progress_non_negative CHECK (progress >= 0),
  CONSTRAINT total_units_non_negative CHECK (total_units >= 0),
  CONSTRAINT user_rating_range CHECK (user_rating IS NULL OR (user_rating >= 0 AND user_rating <= 10))
);

-- History/Audit Trail
CREATE TABLE history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  action_type history_action NOT NULL,
  value JSONB,
  previous_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Smart Collections
CREATE TABLE smart_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  media_ids UUID[] DEFAULT '{}',
  filter_criteria JSONB, -- Store filter configuration
  is_auto_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Cache (to reduce API calls)
CREATE TABLE ai_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key TEXT UNIQUE NOT NULL,
  response_type TEXT NOT NULL,
  response_data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- App Settings (Single row)
CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  user_id UUID,
  theme TEXT DEFAULT 'dark',
  grid_size INTEGER DEFAULT 3,
  default_view TEXT DEFAULT 'grid',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_media_status ON media(status);
CREATE INDEX idx_media_type ON media(type);
CREATE INDEX idx_media_favorite ON media(is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_media_archived ON media(is_archived) WHERE is_archived = TRUE;
CREATE INDEX idx_media_genres ON media USING GIN(genres);
CREATE INDEX idx_media_tags ON media USING GIN(tags);
CREATE INDEX idx_media_completion ON media(completion_percent);
CREATE INDEX idx_media_updated ON media(updated_at DESC);
CREATE INDEX idx_media_created ON media(created_at DESC);
CREATE INDEX idx_media_release_year ON media(release_year);

CREATE INDEX idx_history_media ON history(media_id);
CREATE INDEX idx_history_created ON history(created_at DESC);
CREATE INDEX idx_history_action ON history(action_type);

CREATE INDEX idx_ai_cache_key ON ai_cache(cache_key);
CREATE INDEX idx_ai_cache_expires ON ai_cache(expires_at);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER media_updated_at
  BEFORE UPDATE ON media
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER smart_collections_updated_at
  BEFORE UPDATE ON smart_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-calculate completion percent
CREATE OR REPLACE FUNCTION calculate_completion_percent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_units > 0 THEN
    NEW.completion_percent = LEAST(100, (NEW.progress::DECIMAL / NEW.total_units::DECIMAL) * 100);
  ELSIF NEW.type = 'game' AND NEW.total_units = 0 THEN
    NEW.completion_percent = NEW.progress;
  ELSE
    NEW.completion_percent = CASE WHEN NEW.status = 'completed' THEN 100 ELSE 0 END;
  END IF;
  
  -- Update completed_at
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status != 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER media_completion_calc
  BEFORE INSERT OR UPDATE ON media
  FOR EACH ROW
  EXECUTE FUNCTION calculate_completion_percent();

-- Log history
CREATE OR REPLACE FUNCTION log_media_history()
RETURNS TRIGGER AS $$
DECLARE
  action history_action;
  val JSONB;
  prev_val JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action := 'added';
    val := to_jsonb(NEW);
    prev_val := NULL;
    INSERT INTO history (media_id, action_type, value, previous_value)
    VALUES (NEW.id, action, val, prev_val);
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    action := 'deleted';
    val := NULL;
    prev_val := to_jsonb(OLD);
    INSERT INTO history (media_id, action_type, value, previous_value)
    VALUES (OLD.id, action, val, prev_val);
    RETURN OLD;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status != OLD.status THEN
      action := 'status_change';
      val := jsonb_build_object('status', NEW.status);
      prev_val := jsonb_build_object('status', OLD.status);
    ELSIF NEW.progress != OLD.progress THEN
      action := 'progress_update';
      val := jsonb_build_object('progress', NEW.progress, 'completion_percent', NEW.completion_percent);
      prev_val := jsonb_build_object('progress', OLD.progress, 'completion_percent', OLD.completion_percent);
    ELSIF NEW.is_favorite != OLD.is_favorite THEN
      action := CASE WHEN NEW.is_favorite THEN 'favorited' ELSE 'unfavorited' END;
      val := jsonb_build_object('is_favorite', NEW.is_favorite);
      prev_val := jsonb_build_object('is_favorite', OLD.is_favorite);
    ELSIF NEW.is_archived != OLD.is_archived THEN
      action := CASE WHEN NEW.is_archived THEN 'archived' ELSE 'unarchived' END;
      val := jsonb_build_object('is_archived', NEW.is_archived);
      prev_val := jsonb_build_object('is_archived', OLD.is_archived);
    ELSE
      action := 'updated';
      val := to_jsonb(NEW);
      prev_val := to_jsonb(OLD);
    END IF;
    
    INSERT INTO history (media_id, action_type, value, previous_value)
    VALUES (NEW.id, action, val, prev_val);
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER media_history_log
  AFTER INSERT OR UPDATE OR DELETE ON media
  FOR EACH ROW
  EXECUTE FUNCTION log_media_history();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for single-user setup)
CREATE POLICY "Allow all" ON media FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON smart_collections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON ai_cache FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON app_settings FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- INITIAL DATA
-- =====================================================

INSERT INTO app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
