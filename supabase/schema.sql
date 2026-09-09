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
  -- Scoped to (user_id, normalized_title, type), not just (normalized_title,
  -- type) - the latter was a leftover from before the Phase 2 multi-user
  -- migration and meant no two different accounts could ever track the same
  -- title (whoever added it first silently "won" it; every other account's
  -- insert 23505'd). Fixed live via the scope_media_uniqueness_to_user
  -- migration - this keeps a fresh deploy from reintroducing it.
  CONSTRAINT unique_user_title_type UNIQUE (user_id, normalized_title, type),
  CONSTRAINT progress_non_negative CHECK (progress >= 0),
  CONSTRAINT total_units_non_negative CHECK (total_units >= 0),
  CONSTRAINT user_rating_range CHECK (user_rating IS NULL OR (user_rating >= 0 AND user_rating <= 10))
);

-- History/Audit Trail
--
-- media_id intentionally has NO foreign key to media(id) (see the
-- fix_history_fk_blocking_deletes migration, applied 2026-09-08). It
-- originally did, which is a schema bug that silently broke every delete
-- ever attempted, for the entire lifetime of this app: media_history_log's
-- AFTER DELETE trigger inserts a 'deleted' row referencing the media_id
-- that was *just* removed, which a FK requiring that id to still exist
-- always rejected - rolling back the delete itself along with it. An
-- orphaned media_id on a 'deleted' history row is the correct, expected
-- shape for an audit log (that's the point of a deletion record), not an
-- integrity violation to prevent.
CREATE TABLE history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  media_id UUID,
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

-- Original single-user policies - superseded by the Phase 2 migration below
-- (kept here only as a historical record of the initial schema).
-- CREATE POLICY "Allow all" ON media FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all" ON history FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all" ON smart_collections FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all" ON ai_cache FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all" ON app_settings FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- INITIAL DATA
-- =====================================================

INSERT INTO app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- =====================================================
-- PHASE 2 MIGRATION: Clerk auth + per-user ownership
-- (applied live via Supabase MCP as migration "add_clerk_user_id_and_rls";
-- mirrored here so schema.sql reflects the actual live schema)
-- =====================================================

-- Clerk is a third-party auth provider for this project (see Supabase
-- dashboard -> Authentication -> Sign In / Providers). auth.jwt()->>'sub'
-- resolves to the signed-in Clerk user's id once that integration is
-- enabled; NOT a Postgres/Supabase Auth uid.

ALTER TABLE media ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT (auth.jwt()->>'sub');
CREATE INDEX IF NOT EXISTS idx_media_user_id ON media(user_id);

DROP POLICY IF EXISTS "Allow all" ON media;
CREATE POLICY "select own or unclaimed media" ON media FOR SELECT
  USING (auth.jwt()->>'sub' = user_id OR user_id IS NULL);
CREATE POLICY "insert own media" ON media FOR INSERT
  WITH CHECK (auth.jwt()->>'sub' = user_id);
-- The "OR user_id IS NULL" half of USING lets a signed-in user claim
-- pre-auth (orphaned) rows via `UPDATE ... SET user_id = ... WHERE user_id
-- IS NULL` - WITH CHECK still requires the new value to be their own id.
CREATE POLICY "update own or claim unclaimed media" ON media FOR UPDATE
  USING (auth.jwt()->>'sub' = user_id OR user_id IS NULL)
  WITH CHECK (auth.jwt()->>'sub' = user_id);
CREATE POLICY "delete own media" ON media FOR DELETE
  USING (auth.jwt()->>'sub' = user_id);

ALTER TABLE history ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT (auth.jwt()->>'sub');
CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id);

DROP POLICY IF EXISTS "Allow all" ON history;
CREATE POLICY "select own or unclaimed history" ON history FOR SELECT
  USING (auth.jwt()->>'sub' = user_id OR user_id IS NULL);
CREATE POLICY "insert own history" ON history FOR INSERT
  WITH CHECK (auth.jwt()->>'sub' = user_id);
CREATE POLICY "update own or claim unclaimed history" ON history FOR UPDATE
  USING (auth.jwt()->>'sub' = user_id OR user_id IS NULL)
  WITH CHECK (auth.jwt()->>'sub' = user_id);
CREATE POLICY "delete own history" ON history FOR DELETE
  USING (auth.jwt()->>'sub' = user_id);

ALTER TABLE smart_collections ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT (auth.jwt()->>'sub');
CREATE INDEX IF NOT EXISTS idx_smart_collections_user_id ON smart_collections(user_id);

DROP POLICY IF EXISTS "Allow all" ON smart_collections;
CREATE POLICY "select own or unclaimed collections" ON smart_collections FOR SELECT
  USING (auth.jwt()->>'sub' = user_id OR user_id IS NULL);
CREATE POLICY "insert own collections" ON smart_collections FOR INSERT
  WITH CHECK (auth.jwt()->>'sub' = user_id);
CREATE POLICY "update own or claim unclaimed collections" ON smart_collections FOR UPDATE
  USING (auth.jwt()->>'sub' = user_id OR user_id IS NULL)
  WITH CHECK (auth.jwt()->>'sub' = user_id);
CREATE POLICY "delete own collections" ON smart_collections FOR DELETE
  USING (auth.jwt()->>'sub' = user_id);

-- ai_cache stays a shared cache across all users (the point of it is to
-- avoid redundant AI calls for the same title regardless of who looks it
-- up) - just no longer open to fully anonymous/public access.
DROP POLICY IF EXISTS "Allow all" ON ai_cache;
CREATE POLICY "authenticated read/write ai_cache" ON ai_cache FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- app_settings is not currently read/written by any app code (it's a
-- leftover from before the app switched to a local-only Dexie settings
-- table), but locked down for consistency rather than left fully open.
-- Named clerk_user_id (not user_id) since the table already has an unused
-- `user_id UUID` column from the original single-user schema.
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
DROP POLICY IF EXISTS "Allow all" ON app_settings;
CREATE POLICY "own app_settings" ON app_settings FOR ALL
  TO authenticated
  USING (auth.jwt()->>'sub' = clerk_user_id OR clerk_user_id IS NULL)
  WITH CHECK (auth.jwt()->>'sub' = clerk_user_id);

-- ============================================================
-- PHASE 2 CHUNK C: Friends (request/accept)
-- ============================================================

CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id TEXT NOT NULL,
  addressee_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_friend CHECK (requester_id <> addressee_id),
  CONSTRAINT unique_friendship UNIQUE (requester_id, addressee_id)
);

CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX idx_friendships_status ON friendships(status);

CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Either party can see a friendship row (pending or accepted) involving them.
CREATE POLICY "select own friendships" ON friendships FOR SELECT
  USING (auth.jwt()->>'sub' = requester_id OR auth.jwt()->>'sub' = addressee_id);

-- Only the requester can create a request, and only as themselves.
CREATE POLICY "insert own friend request" ON friendships FOR INSERT
  WITH CHECK (auth.jwt()->>'sub' = requester_id);

-- Only the addressee can accept/decline (status transition); the requester
-- cannot unilaterally flip their own outgoing request to accepted.
CREATE POLICY "addressee updates status" ON friendships FOR UPDATE
  USING (auth.jwt()->>'sub' = addressee_id)
  WITH CHECK (auth.jwt()->>'sub' = addressee_id);

-- Either party can delete (cancel a pending request, or unfriend/remove
-- a declined one).
CREATE POLICY "either party deletes friendship" ON friendships FOR DELETE
  USING (auth.jwt()->>'sub' = requester_id OR auth.jwt()->>'sub' = addressee_id);

-- ============================================================
-- PHASE 2 CHUNK D: Shared visibility (read-only, accepted friends only)
-- ============================================================

-- Extend media/history SELECT so an accepted friend can read (never write)
-- each other's library. Kept as a separate additional policy (Postgres ORs
-- multiple permissive policies together) rather than editing the existing
-- "select own or unclaimed" policy, so the ownership/claim logic stays
-- untouched and this is easy to revert independently.

CREATE POLICY "select friends media" ON media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
        AND (
          (requester_id = auth.jwt()->>'sub' AND addressee_id = media.user_id)
          OR (addressee_id = auth.jwt()->>'sub' AND requester_id = media.user_id)
        )
    )
  );

CREATE POLICY "select friends history" ON history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
        AND (
          (requester_id = auth.jwt()->>'sub' AND addressee_id = history.user_id)
          OR (addressee_id = auth.jwt()->>'sub' AND requester_id = history.user_id)
        )
    )
  );

-- ============================================================
-- PHASE 2 CHUNK E: Shared collections (owner shares a specific collection
-- with a specific friend, rather than their whole library)
-- ============================================================

CREATE TABLE collection_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL REFERENCES smart_collections(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  shared_with_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_share CHECK (owner_id <> shared_with_id),
  CONSTRAINT unique_collection_share UNIQUE (collection_id, shared_with_id)
);

CREATE INDEX idx_collection_shares_owner ON collection_shares(owner_id);
CREATE INDEX idx_collection_shares_shared_with ON collection_shares(shared_with_id);
CREATE INDEX idx_collection_shares_collection ON collection_shares(collection_id);

ALTER TABLE collection_shares ENABLE ROW LEVEL SECURITY;

-- Either party can see the share row itself (owner needs it to manage
-- shares, recipient needs it to know what's been shared with them).
CREATE POLICY "select own collection shares" ON collection_shares FOR SELECT
  USING (auth.jwt()->>'sub' = owner_id OR auth.jwt()->>'sub' = shared_with_id);

-- Only the actual owner of the collection can share it, and only with an
-- accepted friend - both checked here rather than trusted from the client.
CREATE POLICY "owner shares own collection with a friend" ON collection_shares FOR INSERT
  WITH CHECK (
    auth.jwt()->>'sub' = owner_id
    AND EXISTS (
      SELECT 1 FROM smart_collections
      WHERE id = collection_id AND user_id = auth.jwt()->>'sub'
    )
    AND EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
        AND (
          (requester_id = auth.jwt()->>'sub' AND addressee_id = shared_with_id)
          OR (addressee_id = auth.jwt()->>'sub' AND requester_id = shared_with_id)
        )
    )
  );

-- Either the owner (revoke) or the recipient (leave/remove from their view)
-- can delete a share.
CREATE POLICY "owner or recipient deletes collection share" ON collection_shares FOR DELETE
  USING (auth.jwt()->>'sub' = owner_id OR auth.jwt()->>'sub' = shared_with_id);

-- Extend smart_collections SELECT so a share recipient can read the
-- collection row itself (title/description/media_ids) - kept as an
-- additional permissive policy, same pattern as Chunk D's friend-media
-- policy, so the existing owner/unclaimed logic is untouched.
CREATE POLICY "select shared collections" ON smart_collections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collection_shares
      WHERE collection_id = smart_collections.id
        AND shared_with_id = auth.jwt()->>'sub'
    )
  );

-- Shared collections are genuinely collaborative, not read-only: anyone
-- the collection is shared with can update it (in practice, the app only
-- ever uses this to add/remove media_ids entries, but RLS can't cheaply
-- restrict to just that one column, so this trusts collaborators the same
-- way being invited to edit a shared doc would - reasonable for a
-- personal friends app, not a public one).
CREATE POLICY "collaborators update shared collections" ON smart_collections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM collection_shares
      WHERE collection_id = smart_collections.id
        AND shared_with_id = auth.jwt()->>'sub'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collection_shares
      WHERE collection_id = smart_collections.id
        AND shared_with_id = auth.jwt()->>'sub'
    )
  );

-- =====================================================
-- Friend invite codes (codes / QR / shareable links)
-- =====================================================

-- One shareable code per user. No general "select any row" policy exists
-- on purpose - a code must never be readable by scanning the table, only
-- resolvable one at a time via preview_friend_code/redeem_friend_code
-- below (SECURITY DEFINER, authenticated-only), so a code can't be
-- enumerated even by an authenticated client.
CREATE TABLE friend_invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_friend_invite_codes_code ON friend_invite_codes(code);

CREATE TRIGGER update_friend_invite_codes_updated_at
  BEFORE UPDATE ON friend_invite_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE friend_invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own invite code" ON friend_invite_codes FOR SELECT
  USING (auth.jwt()->>'sub' = user_id);

CREATE POLICY "insert own invite code" ON friend_invite_codes FOR INSERT
  WITH CHECK (auth.jwt()->>'sub' = user_id);

CREATE POLICY "update own invite code" ON friend_invite_codes FOR UPDATE
  USING (auth.jwt()->>'sub' = user_id)
  WITH CHECK (auth.jwt()->>'sub' = user_id);

CREATE POLICY "delete own invite code" ON friend_invite_codes FOR DELETE
  USING (auth.jwt()->>'sub' = user_id);

-- Resolves a code to its owner's Clerk id, no side effects - used for the
-- invite landing page's "X invited you - Accept?" preview before the
-- friendship is actually created. Explicitly revoked from both PUBLIC and
-- `anon` below and granted only to `authenticated` - Supabase's default
-- privileges grant `anon` EXECUTE on every new function in the public
-- schema directly (not just via PUBLIC), so revoking from PUBLIC alone
-- does not actually close this off; confirmed live via
-- has_function_privilege('anon', ...) after a REVOKE ... FROM PUBLIC-only
-- attempt still returned true.
CREATE OR REPLACE FUNCTION preview_friend_code(target_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id TEXT := auth.jwt()->>'sub';
  found_owner TEXT;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO found_owner FROM friend_invite_codes WHERE code = target_code;

  IF found_owner IS NULL THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  RETURN found_owner;
END;
$$;

REVOKE EXECUTE ON FUNCTION preview_friend_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION preview_friend_code(TEXT) TO authenticated;

-- Resolves a code to its owner and creates (or upgrades to accepted) the
-- friendship row - idempotent, and handles both possible
-- (requester,addressee) orderings since unique_friendship only constrains
-- one direction. Possessing the code is treated as mutual consent (like
-- Discord/Snapchat add-by-code), so this goes straight to 'accepted'
-- rather than creating a separate pending request the code's owner would
-- have to additionally approve.
CREATE OR REPLACE FUNCTION redeem_friend_code(target_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id TEXT := auth.jwt()->>'sub';
  found_owner TEXT;
  existing_status TEXT;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO found_owner FROM friend_invite_codes WHERE code = target_code;

  IF found_owner IS NULL THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  IF found_owner = caller_id THEN
    RAISE EXCEPTION 'self_code';
  END IF;

  SELECT status INTO existing_status
  FROM friendships
  WHERE (requester_id = caller_id AND addressee_id = found_owner)
     OR (requester_id = found_owner AND addressee_id = caller_id)
  LIMIT 1;

  IF existing_status IS NOT NULL THEN
    IF existing_status <> 'accepted' THEN
      UPDATE friendships
      SET status = 'accepted', updated_at = NOW()
      WHERE (requester_id = caller_id AND addressee_id = found_owner)
         OR (requester_id = found_owner AND addressee_id = caller_id);
    END IF;
    RETURN found_owner;
  END IF;

  INSERT INTO friendships (requester_id, addressee_id, status)
  VALUES (caller_id, found_owner, 'accepted');

  RETURN found_owner;
END;
$$;

REVOKE EXECUTE ON FUNCTION redeem_friend_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION redeem_friend_code(TEXT) TO authenticated;

-- =====================================================
-- Collection invite codes (codes / QR / shareable links)
-- =====================================================

-- One shareable code per collection. Same no-general-read-policy pattern
-- as friend_invite_codes above.
CREATE TABLE collection_invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL UNIQUE REFERENCES smart_collections(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_collection_invite_codes_code ON collection_invite_codes(code);

CREATE TRIGGER update_collection_invite_codes_updated_at
  BEFORE UPDATE ON collection_invite_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE collection_invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own collection invite code" ON collection_invite_codes FOR SELECT
  USING (EXISTS (SELECT 1 FROM smart_collections WHERE id = collection_id AND user_id = auth.jwt()->>'sub'));

CREATE POLICY "insert own collection invite code" ON collection_invite_codes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM smart_collections WHERE id = collection_id AND user_id = auth.jwt()->>'sub'));

CREATE POLICY "update own collection invite code" ON collection_invite_codes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM smart_collections WHERE id = collection_id AND user_id = auth.jwt()->>'sub'))
  WITH CHECK (EXISTS (SELECT 1 FROM smart_collections WHERE id = collection_id AND user_id = auth.jwt()->>'sub'));

CREATE POLICY "delete own collection invite code" ON collection_invite_codes FOR DELETE
  USING (EXISTS (SELECT 1 FROM smart_collections WHERE id = collection_id AND user_id = auth.jwt()->>'sub'));

-- Resolves a code to the collection's own public-facing info, no side
-- effects - for the invite landing page's preview before joining.
CREATE OR REPLACE FUNCTION preview_collection_code(target_code TEXT)
RETURNS TABLE(collection_id UUID, title TEXT, description TEXT, owner_id TEXT, item_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id TEXT := auth.jwt()->>'sub';
  found_collection_id UUID;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT cic.collection_id INTO found_collection_id
  FROM collection_invite_codes cic
  WHERE cic.code = target_code;

  IF found_collection_id IS NULL THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  RETURN QUERY
  SELECT sc.id, sc.title, sc.description, sc.user_id, COALESCE(array_length(sc.media_ids, 1), 0)
  FROM smart_collections sc
  WHERE sc.id = found_collection_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION preview_collection_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION preview_collection_code(TEXT) TO authenticated;

-- Resolves a code and inserts the collaborator row directly - possessing
-- the code/link/QR is its own authorization, deliberately superseding the
-- "owner shares own collection with a friend" policy's friendship
-- requirement (a code-based invite works for anyone, not just existing
-- friends, same as a shared doc link doesn't require being a contact
-- first) - safe because this is the only path that can ever write a
-- collection_shares row without a pre-existing friendship, and it still
-- requires knowing the unguessable code.
CREATE OR REPLACE FUNCTION redeem_collection_code(target_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id TEXT := auth.jwt()->>'sub';
  found_collection_id UUID;
  found_owner_id TEXT;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT cic.collection_id INTO found_collection_id
  FROM collection_invite_codes cic
  WHERE cic.code = target_code;

  IF found_collection_id IS NULL THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  SELECT user_id INTO found_owner_id FROM smart_collections WHERE id = found_collection_id;

  IF found_owner_id IS NULL THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  IF found_owner_id = caller_id THEN
    RAISE EXCEPTION 'self_code';
  END IF;

  INSERT INTO collection_shares (collection_id, owner_id, shared_with_id)
  VALUES (found_collection_id, found_owner_id, caller_id)
  ON CONFLICT (collection_id, shared_with_id) DO NOTHING;

  RETURN found_collection_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION redeem_collection_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION redeem_collection_code(TEXT) TO authenticated;
