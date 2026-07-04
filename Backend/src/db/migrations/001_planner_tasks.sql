-- Planner (Tasks) — run this in the Supabase SQL editor
-- See Backend/.claude/planner-backend-agent.md for the full plan.

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) <= 200),
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'med' CHECK (priority IN ('low','med','high')),
  due_date DATE,
  tags JSONB NOT NULL DEFAULT '[]',
  "column" TEXT NOT NULL DEFAULT 'todo' CHECK ("column" IN ('todo','prog','done')),
  position INTEGER NOT NULL DEFAULT 0,
  estimate_min INTEGER CHECK (estimate_min BETWEEN 1 AND 100000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stopped_at TIMESTAMPTZ
);

-- Invariant: at most ONE running log (stopped_at IS NULL) across the whole table
CREATE UNIQUE INDEX IF NOT EXISTS one_running_timer
  ON task_time_logs ((stopped_at IS NULL))
  WHERE stopped_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_logs_task ON task_time_logs (task_id);
