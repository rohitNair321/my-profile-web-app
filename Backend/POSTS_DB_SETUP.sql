-- ============================================================
-- POSTS FEATURE — Supabase SQL Setup
-- Run this entire file in the Supabase SQL Editor once.
-- ============================================================

-- ── 1. POSTS TABLE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  excerpt         TEXT,
  content         TEXT NOT NULL,
  content_raw     TEXT,
  cover_image_url TEXT,
  linkedin_url    TEXT,
  status          TEXT DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'archived')),
  is_featured     BOOLEAN DEFAULT false,
  week_number     INTEGER,
  tags            TEXT[] DEFAULT '{}',
  seo_title       TEXT,
  seo_description TEXT,
  og_image_url    TEXT,
  read_time       INTEGER,
  impressions     INTEGER DEFAULT 0,
  views           INTEGER DEFAULT 0,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. POST VIEWS TABLE ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_views (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  guest_id   TEXT,
  ip_hash    TEXT,
  viewed_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. INDEXES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_posts_status    ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_slug      ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_featured  ON posts(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_posts_tags      ON posts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_post_views_post_id  ON post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_viewed_at ON post_views(viewed_at DESC);

-- ── 4. AUTO-UPDATE updated_at ───────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_updated_at ON posts;
CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 5. ROW LEVEL SECURITY ───────────────────────────────────
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;

-- Public can read published posts only
DROP POLICY IF EXISTS "Public read published posts" ON posts;
CREATE POLICY "Public read published posts"
  ON posts FOR SELECT
  USING (status = 'published');

-- Service role has full access (backend uses service role key)
DROP POLICY IF EXISTS "Service role full access posts" ON posts;
CREATE POLICY "Service role full access posts"
  ON posts FOR ALL
  USING (auth.role() = 'service_role');

-- Service role can insert/update post_views
DROP POLICY IF EXISTS "Service role full access post_views" ON post_views;
CREATE POLICY "Service role full access post_views"
  ON post_views FOR ALL
  USING (auth.role() = 'service_role');

-- ── 6. INCREMENT VIEWS RPC ──────────────────────────────────
CREATE OR REPLACE FUNCTION increment_post_views(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE posts SET views = views + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── DONE ────────────────────────────────────────────────────
-- After running this SQL:
-- 1. Start your backend: npm run dev
-- 2. Test: GET http://localhost:3000/api/v1/posts  → []
-- 3. Create a post via the admin editor at /#/admin/posts/new
