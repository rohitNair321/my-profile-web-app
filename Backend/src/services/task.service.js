// services/task.service.js
'use strict';

const { supabase } = require('../db/supabaseClient');
const ApiError = require('../utils/ApiError');

const COLUMNS    = ['todo', 'prog', 'done'];
const PRIORITIES = ['low', 'med', 'high'];

// ── Serialization — snake_case rows → frontend Task shape (epoch ms) ──

const ms = (iso) => (iso ? new Date(iso).getTime() : null);

function serializeLog(row) {
  return {
    id:        row.id,
    startedAt: ms(row.started_at),
    stoppedAt: row.stopped_at ? ms(row.stopped_at) : null,
  };
}

function serializeTask(row, logRows = []) {
  const timeLogs = logRows.map(serializeLog);
  const now = Date.now();
  const totalWorkedMs = timeLogs.reduce(
    (sum, l) => sum + ((l.stoppedAt ?? now) - l.startedAt), 0);

  return {
    id:          row.id,
    title:       row.title,
    description: row.description ?? '',
    priority:    row.priority,
    dueDate:     row.due_date ?? null,
    tags:        row.tags ?? [],
    column:      row.column,
    position:    row.position ?? 0,
    estimateMin: row.estimate_min ?? null,
    timeLogs,
    totalWorkedMs,
    createdAt:   ms(row.created_at),
    updatedAt:   ms(row.updated_at),
  };
}

// ── Validation ────────────────────────────────────────────────────

function validatePatch(patch) {
  if ('title' in patch) {
    const t = String(patch.title ?? '').trim();
    if (!t || t.length > 200) throw ApiError.badRequest('title must be 1–200 characters');
    patch.title = t;
  }
  if ('description' in patch && String(patch.description ?? '').length > 5000) {
    throw ApiError.badRequest('description must be ≤ 5000 characters');
  }
  if ('priority' in patch && !PRIORITIES.includes(patch.priority)) {
    throw ApiError.badRequest(`priority must be one of: ${PRIORITIES.join(', ')}`);
  }
  if ('column' in patch && !COLUMNS.includes(patch.column)) {
    throw ApiError.badRequest(`column must be one of: ${COLUMNS.join(', ')}`);
  }
  if ('dueDate' in patch && patch.dueDate !== null && isNaN(Date.parse(patch.dueDate))) {
    throw ApiError.badRequest('dueDate must be a valid ISO date or null');
  }
  if ('tags' in patch) {
    if (!Array.isArray(patch.tags) || patch.tags.length > 10 ||
        patch.tags.some(t => typeof t !== 'string' || t.length > 30)) {
      throw ApiError.badRequest('tags must be ≤ 10 strings of ≤ 30 chars each');
    }
  }
  if ('estimateMin' in patch && patch.estimateMin !== null) {
    const n = Number(patch.estimateMin);
    if (!Number.isInteger(n) || n < 1 || n > 100000) {
      throw ApiError.badRequest('estimateMin must be an integer 1–100000 or null');
    }
  }
  if ('position' in patch) {
    const n = Number(patch.position);
    if (!Number.isInteger(n) || n < 0) throw ApiError.badRequest('position must be an integer ≥ 0');
  }
  return patch;
}

/** camelCase patch → snake_case DB row (only mutable fields) */
function toDbRow(patch) {
  const row = {};
  if ('title'       in patch) row.title        = patch.title;
  if ('description' in patch) row.description  = patch.description ?? '';
  if ('priority'    in patch) row.priority     = patch.priority;
  if ('dueDate'     in patch) row.due_date     = patch.dueDate;
  if ('tags'        in patch) row.tags         = patch.tags;
  if ('column'      in patch) row.column       = patch.column;
  if ('position'    in patch) row.position     = patch.position;
  if ('estimateMin' in patch) row.estimate_min = patch.estimateMin;
  return row;
}

// ── Reads ─────────────────────────────────────────────────────────

async function fetchLogsByTask(taskIds) {
  if (taskIds.length === 0) return {};
  const { data, error } = await supabase
    .from('task_time_logs')
    .select('*')
    .in('task_id', taskIds)
    .order('started_at', { ascending: true });
  if (error) throw ApiError.internal('Failed to fetch time logs');

  const byTask = {};
  for (const log of data ?? []) {
    (byTask[log.task_id] ??= []).push(log);
  }
  return byTask;
}

async function listTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw ApiError.internal('Failed to fetch tasks');

  const rows = data ?? [];
  const logsByTask = await fetchLogsByTask(rows.map(r => r.id));
  return rows.map(r => serializeTask(r, logsByTask[r.id] ?? []));
}

async function getTask(id) {
  const { data, error } = await supabase
    .from('tasks').select('*').eq('id', id).single();
  if (error || !data) throw ApiError.notFound('Task not found');

  const logsByTask = await fetchLogsByTask([id]);
  return serializeTask(data, logsByTask[id] ?? []);
}

// ── Writes ────────────────────────────────────────────────────────

async function createTask(payload) {
  const patch = validatePatch({
    title:       payload.title,
    description: payload.description ?? '',
    priority:    payload.priority ?? 'med',
    dueDate:     payload.dueDate ?? null,
    tags:        payload.tags ?? [],
    column:      payload.column ?? 'todo',
    estimateMin: payload.estimateMin ?? null,
  });

  const { data, error } = await supabase
    .from('tasks').insert(toDbRow(patch)).select('*').single();
  if (error) throw ApiError.internal('Failed to create task: ' + error.message);
  return serializeTask(data, []);
}

async function updateTask(id, payload) {
  const patch = validatePatch({ ...payload });
  const row = toDbRow(patch);
  if (Object.keys(row).length === 0) throw ApiError.badRequest('No valid fields to update');
  row.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('tasks').update(row).eq('id', id).select('*').single();
  if (error || !data) throw ApiError.notFound('Task not found');

  const logsByTask = await fetchLogsByTask([id]);
  return serializeTask(data, logsByTask[id] ?? []);
}

async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw ApiError.internal('Failed to delete task');
}

async function moveTask(id, column, position) {
  validatePatch({ column, ...(position !== undefined ? { position } : {}) });

  // Moving a running task to Done stops its timer
  if (column === 'done') {
    await supabase
      .from('task_time_logs')
      .update({ stopped_at: new Date().toISOString() })
      .eq('task_id', id)
      .is('stopped_at', null);
  }

  const row = { column, updated_at: new Date().toISOString() };
  if (position !== undefined) row.position = position;

  const { data, error } = await supabase
    .from('tasks').update(row).eq('id', id).select('*').single();
  if (error || !data) throw ApiError.notFound('Task not found');

  const logsByTask = await fetchLogsByTask([id]);
  return serializeTask(data, logsByTask[id] ?? []);
}

// ── Timer — server owns time, one running log across ALL tasks ────

async function startTimer(id) {
  // Ensure task exists first
  const { data: task, error: taskErr } = await supabase
    .from('tasks').select('id, column').eq('id', id).single();
  if (taskErr || !task) throw ApiError.notFound('Task not found');

  // Find any running log
  const { data: runningLogs, error: runErr } = await supabase
    .from('task_time_logs')
    .select('id, task_id')
    .is('stopped_at', null);
  if (runErr) throw ApiError.internal('Failed to check running timers');

  if ((runningLogs ?? []).some(l => l.task_id === id)) {
    throw ApiError.conflict('ALREADY_RUNNING');
  }

  // Auto-stop the other running task (at most one exists via unique index)
  let autoStopped = null;
  for (const log of runningLogs ?? []) {
    await supabase
      .from('task_time_logs')
      .update({ stopped_at: new Date().toISOString() })
      .eq('id', log.id);
    autoStopped = log.task_id;
  }

  const { error: insErr } = await supabase
    .from('task_time_logs')
    .insert({ task_id: id, started_at: new Date().toISOString(), stopped_at: null });
  if (insErr) throw ApiError.internal('Failed to start timer: ' + insErr.message);

  // Auto-move To Do → In Progress (mirrors frontend rule)
  if (task.column === 'todo') {
    await supabase
      .from('tasks')
      .update({ column: 'prog', updated_at: new Date().toISOString() })
      .eq('id', id);
  }

  return { task: await getTask(id), autoStopped };
}

async function stopTimer(id) {
  const { data: running, error } = await supabase
    .from('task_time_logs')
    .select('id')
    .eq('task_id', id)
    .is('stopped_at', null);
  if (error) throw ApiError.internal('Failed to check running timer');
  if (!running || running.length === 0) throw ApiError.conflict('NOT_RUNNING');

  const { error: updErr } = await supabase
    .from('task_time_logs')
    .update({ stopped_at: new Date().toISOString() })
    .eq('id', running[0].id);
  if (updErr) throw ApiError.internal('Failed to stop timer');

  return getTask(id);
}

async function getActiveTimer() {
  const { data, error } = await supabase
    .from('task_time_logs')
    .select('task_id, started_at')
    .is('stopped_at', null)
    .limit(1);
  if (error) throw ApiError.internal('Failed to fetch active timer');

  const log = data?.[0];
  return log ? { taskId: log.task_id, startedAt: ms(log.started_at) } : null;
}

async function deleteLog(taskId, logId) {
  const { error } = await supabase
    .from('task_time_logs')
    .delete()
    .eq('id', logId)
    .eq('task_id', taskId);
  if (error) throw ApiError.internal('Failed to delete time log');
  return getTask(taskId);
}

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  moveTask,
  startTimer,
  stopTimer,
  getActiveTimer,
  deleteLog,
};
