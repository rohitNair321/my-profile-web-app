-- Per-owner layout config: which admin sections are shown/hidden.
-- Run in the Supabase SQL editor. Idempotent.

alter table public.users
  add column if not exists app_config jsonb;

-- Shape (only these boolean flags are honoured by the API):
--   { "showSidebarToggle": bool, "showAgentChat": bool,
--     "showUserProfileView": bool, "showNotifications": bool }
