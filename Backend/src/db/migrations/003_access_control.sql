-- Access Control & User Provisioning (Feature B) — run in the Supabase SQL editor.
-- Idempotent: safe to re-run.

create extension if not exists "pgcrypto";

-- ── users: role tiers + provisioning flags ──────────────────────────
alter table public.users
  add column if not exists role                 text    not null default 'user',
  add column if not exists is_active            boolean not null default true,
  add column if not exists must_change_password boolean not null default false,
  add column if not exists last_login           timestamptz,
  add column if not exists password_updated_at  timestamptz;

-- Widen role to the 4-tier model (superadmin | admin | user | guest).
alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check check (role in ('superadmin','admin','user','guest'));

-- Promote the portfolio owner to super admin (adjust the email as needed).
-- update public.users set role = 'superadmin' where email = 'OWNER_EMAIL_HERE';

-- ── page access grants ──────────────────────────────────────────────
create table if not exists public.user_page_access (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  page_key   text not null,
  granted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, page_key)
);

create index if not exists idx_user_page_access_user on public.user_page_access (user_id);

-- ── multi-tenant scaffolding (Phase B4 — per-tenant data isolation) ──
-- Forward-compatible owner columns so B4 can layer on without another
-- structural migration. Existing rows should backfill to the owner id.
-- Uncomment + backfill per table as B4 is implemented:
-- alter table public.tasks add column if not exists owner_id uuid references public.users(id);
-- alter table public.posts add column if not exists owner_id uuid references public.users(id);
-- update public.tasks set owner_id = 'OWNER_UUID_HERE' where owner_id is null;
