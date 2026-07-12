-- B4: per-tenant task ownership + per-owner running-timer invariant.
-- Run in the Supabase SQL editor AFTER 003_access_control.sql and after the
-- tasks/posts owner_id columns have been added + backfilled.

-- Time logs need their own owner_id so the "one running timer" rule can be
-- enforced PER OWNER (not globally) and timer queries can filter cheaply.
alter table public.task_time_logs
  add column if not exists owner_id uuid references public.users(id);

-- Backfill each log's owner from its parent task.
update public.task_time_logs l
   set owner_id = t.owner_id
  from public.tasks t
 where l.task_id = t.id
   and l.owner_id is null;

-- Replace the GLOBAL one-running-timer index with a PER-OWNER one so two
-- different owners can each have a running timer simultaneously.
drop index if exists one_running_timer;
create unique index if not exists one_running_timer_per_owner
  on public.task_time_logs (owner_id)
  where stopped_at is null;

-- Helpful lookup indexes for owner-scoped reads.
create index if not exists idx_tasks_owner on public.tasks (owner_id);
create index if not exists idx_logs_owner  on public.task_time_logs (owner_id);
