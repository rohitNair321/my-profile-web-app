-- Migration: add 'scheduled' to the posts status check constraint
-- Run this in the Supabase SQL editor (Database → SQL Editor).

-- 1. Drop the existing constraint
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_status_check;

-- 2. Re-add it with 'scheduled' included
ALTER TABLE public.posts
  ADD CONSTRAINT posts_status_check
  CHECK (status IN ('draft', 'published', 'archived', 'scheduled'));

-- 3. (Optional) backfill any rows that need it — none expected in this case
-- UPDATE public.posts SET status = 'draft' WHERE status NOT IN ('draft','published','archived','scheduled');
