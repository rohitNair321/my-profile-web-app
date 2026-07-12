-- B4 defence-in-depth: Row Level Security (RLS) lockdown.
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- ── WHY THIS IS SAFE ────────────────────────────────────────────────────────
-- This backend connects with the Supabase SERVICE ROLE key, which BYPASSES RLS.
-- Enabling RLS therefore does NOT change how the app behaves — every API call
-- still succeeds through the service role. What it DOES do is deny all access to
-- anyone using the anon / authenticated keys: a leaked anon key, the Supabase
-- auto-generated data API, the dashboard's anon queries, or a future
-- direct-from-browser feature. Per-request tenant isolation is enforced at the
-- app layer (owner_id scoping); this is the belt-and-braces database guard.
--
-- ── WHY NO auth.uid() POLICIES ──────────────────────────────────────────────
-- This app authenticates with its OWN JWT (jsonwebtoken + custom secret), NOT
-- Supabase Auth. So auth.uid() is NULL for backend calls and there are no client
-- sessions to key policies on. Per-row auth.uid() policies would be non-functional
-- here. If you ever migrate to Supabase Auth, see the commented examples at the
-- bottom for the per-owner policy set to add.
--
-- PRE-FLIGHT: confirm nothing uses the Supabase ANON key against these tables
-- (this repo's frontend does not — it calls the Express backend for all data).
-- ────────────────────────────────────────────────────────────────────────────

-- Core tenant + sensitive tables (must exist).
do $$
declare t text;
begin
  foreach t in array array[
    'users','user_page_access','profiles',
    'tasks','task_time_logs',
    'posts','post_views'
  ]
  loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security;', t);
    end if;
  end loop;
end $$;

-- Additional sensitive tables — locked only if they exist in your project.
do $$
declare t text;
begin
  foreach t in array array[
    'activity_log','ai_usage',
    'chat_sessions','chat_messages',
    'contact_messages','notifications'
  ]
  loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security;', t);
    end if;
  end loop;
end $$;

-- No policies are created. With RLS enabled and no permissive policy, the anon
-- and authenticated roles receive ZERO rows; the service_role (backend) is
-- unaffected because it bypasses RLS.

-- VERIFY (optional):
--   select relname, relrowsecurity from pg_class
--   where relname in ('users','profiles','tasks','task_time_logs','posts','post_views','user_page_access');
--   -- relrowsecurity should be true for each.

-- ────────────────────────────────────────────────────────────────────────────
-- FUTURE ONLY — if you adopt Supabase Auth (so auth.uid() is populated), replace
-- the deny-all posture with per-owner policies. Commented out on purpose today.
--
-- alter table public.tasks force row level security;
-- create policy tasks_owner_rw on public.tasks
--   using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- create policy logs_owner_rw on public.task_time_logs
--   using (owner_id = auth.uid()) with check (owner_id = auth.uid());
--
-- create policy posts_public_read on public.posts
--   for select using (status = 'published'
--     or (status = 'scheduled' and scheduled_at <= now()));
-- create policy posts_owner_rw on public.posts
--   using (owner_id = auth.uid()) with check (owner_id = auth.uid());
--
-- create policy profiles_public_read on public.profiles for select using (true);
-- create policy profiles_owner_write on public.profiles
--   using (id = auth.uid()) with check (id = auth.uid());
-- ────────────────────────────────────────────────────────────────────────────
