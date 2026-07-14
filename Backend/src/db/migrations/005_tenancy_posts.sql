-- B4: per-tenant posts. The posts.owner_id column + backfill were already run;
-- this adds the lookup index used by owner-scoped reads.
--
-- IMPORTANT: public reads default to the primary owner (PROFILE_OWNER_ID env).
-- Confirm that value equals the owner's users.id (== posts.owner_id), otherwise
-- the public site would filter to the wrong owner. Verify with:
--   select id, email, role from public.users where role = 'superadmin';
--   -- compare that id to your PROFILE_OWNER_ID env and to:
--   select distinct owner_id from public.posts;

create index if not exists idx_posts_owner on public.posts (owner_id);
