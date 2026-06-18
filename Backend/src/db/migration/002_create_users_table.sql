-- Enable UUID generation if not already enabled - > Supabase DB
create extension if not exists "pgcrypto";

-- Main users table
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),

  -- From your controller
  name text not null,
  email text not null unique,
  password_hash text not null,

  -- Auditing
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional but nice: explicit unique index on email (in addition to constraint)
create unique index if not exists users_email_key on public.users (email);

-- Optional: trigger to auto-update updated_at on update
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_users_updated_at on public.users;

create trigger set_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();
