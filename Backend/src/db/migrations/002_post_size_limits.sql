-- Post size limits — run in the Supabase SQL editor.
-- Mirrors the backend validation in src/services/post.service.js (LIMITS).
-- NOT VALID: constraints apply to new/updated rows without failing on any
-- existing oversized row. Run the VALIDATE lines afterwards once existing
-- rows are confirmed (or trimmed) to conform.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_title_len') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_title_len
      CHECK (char_length(title) <= 120) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_content_len') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_content_len
      CHECK (char_length(content) <= 60000) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_excerpt_len') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_excerpt_len
      CHECK (excerpt IS NULL OR char_length(excerpt) <= 300) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_seo_desc_len') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_seo_desc_len
      CHECK (seo_description IS NULL OR char_length(seo_description) <= 300) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_tags_count') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_tags_count
      CHECK (tags IS NULL OR array_length(tags, 1) IS NULL OR array_length(tags, 1) <= 8) NOT VALID;
  END IF;
END $$;

-- One-time cleanup: content_raw is no longer stored (plain text is derived
-- server-side from the sanitized HTML). Reclaim the duplicated bytes:
UPDATE posts SET content_raw = '' WHERE content_raw IS NOT NULL AND content_raw <> '';

-- After confirming existing rows conform, validate the constraints:
-- ALTER TABLE posts VALIDATE CONSTRAINT posts_title_len;
-- ALTER TABLE posts VALIDATE CONSTRAINT posts_content_len;
-- ALTER TABLE posts VALIDATE CONSTRAINT posts_excerpt_len;
-- ALTER TABLE posts VALIDATE CONSTRAINT posts_seo_desc_len;
-- ALTER TABLE posts VALIDATE CONSTRAINT posts_tags_count;
