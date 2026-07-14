-- Contact messages: align existing rows to the owner's users.id.
--
-- WHY: messages are read back with `profile_id = <logged-in user's users.id>`
-- (owner-scoped inbox). Historically they were INSERTED with
-- `profile_id = PROFILE_OWNER_ID` (an env value). If that env value is not the
-- super admin's users.id — or was unset — existing messages become invisible.
--
-- ── 1. DIAGNOSE (run these first and compare) ────────────────────────────────
--   select id, email, role from public.users where role = 'superadmin';
--   select distinct profile_id, count(*) from public.contact_messages group by profile_id;
--   -- Also compare with your Backend/.env PROFILE_OWNER_ID.
--
--   • If profile_id already equals the superadmin id → the backfill is a no-op.
--   • If it is NULL or some other value → the backfill below repairs it.
--
-- ── 2. BACKFILL: re-home orphaned messages to the super admin ────────────────
-- Only touches rows that are NULL or point at an id that is NOT a real user,
-- so messages legitimately owned by another user are never stolen.

update public.contact_messages
   set profile_id = (select id from public.users where role = 'superadmin' order by created_at limit 1)
 where profile_id is null
    or profile_id not in (select id from public.users);

-- ── 3. Lookup index for owner-scoped inbox reads ─────────────────────────────
create index if not exists idx_contact_messages_profile on public.contact_messages (profile_id);

-- ── 4. IMPORTANT for NEW messages ────────────────────────────────────────────
-- Public submissions default to PROFILE_OWNER_ID when no ?owner= is supplied.
-- So PROFILE_OWNER_ID in Backend/.env MUST equal the super admin's users.id,
-- otherwise new contact messages will be filed under an id you can't read back.
-- (The same env value also drives public posts/profile reads.)
