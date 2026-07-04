// api/v1/activity/activity.controller.js
const { supabase } = require('../../../config/database');
const ApiResponse = require('../../../utils/ApiResponse');
const ApiError = require('../../../utils/ApiError');
const catchAsync = require('../../../utils/catchAsync');

/**
 * @route   GET /api/v1/activity/feed
 * @desc    Paginated activity log — filterable by event_type, entity, date range
 * @access  Admin
 */
const getFeed = catchAsync(async (req, res) => {
  const page       = Math.max(1, parseInt(req.query.page)  || 1);
  const limit      = Math.min(100, parseInt(req.query.limit) || 30);
  const offset     = (page - 1) * limit;
  const { event_type, entity, from, to } = req.query;

  let query = supabase
    .from('activity_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (event_type) {
    const types = event_type.split(',').map(t => t.trim()).filter(Boolean);
    query = types.length === 1 ? query.eq('event_type', types[0]) : query.in('event_type', types);
  }
  if (entity)     query = query.eq('entity', entity);
  if (from)       query = query.gte('created_at', from);
  if (to)         query = query.lte('created_at', to);

  const { data, count, error } = await query;

  if (error) throw ApiError.internal('Failed to fetch activity log');

  const response = ApiResponse.success(
    { items: data ?? [], total: count ?? 0, page, limit },
    'Activity feed retrieved'
  );
  res.status(response.statusCode).json(response);
});

/**
 * @route   GET /api/v1/activity/logins
 * @desc    Admin login history — timestamp, browser, IP
 * @access  Admin
 */
const getLogins = catchAsync(async (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit) || 50);

  const { data, error } = await supabase
    .from('activity_log')
    .select('id, created_at, meta')
    .eq('event_type', 'login')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw ApiError.internal('Failed to fetch login history');

  const logins = (data ?? []).map(row => ({
    id:        row.id,
    timestamp: row.created_at,
    browser:   row.meta?.browser ?? null,
    ip:        row.meta?.ip      ?? null,
  }));

  const response = ApiResponse.success(
    { logins, total: logins.length },
    'Login history retrieved'
  );
  res.status(response.statusCode).json(response);
});

/**
 * @route   GET /api/v1/activity/field-changes
 * @desc    Profile field edit history grouped by entity
 * @access  Admin
 */
const getFieldChanges = catchAsync(async (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit) || 50);
  const { entity } = req.query;

  let query = supabase
    .from('activity_log')
    .select('id, event_type, entity, field_name, old_value, new_value, meta, created_at')
    .in('event_type', ['field_update', 'password_update', 'storage_delete'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (entity) query = query.eq('entity', entity);

  const { data, error } = await query;

  if (error) throw ApiError.internal('Failed to fetch field changes');

  const response = ApiResponse.success(
    { changes: data ?? [] },
    'Field change history retrieved'
  );
  res.status(response.statusCode).json(response);
});

/**
 * @route   GET /api/v1/activity/summary
 * @desc    Sanitised public stats — no PII, no old/new values
 * @access  Public
 */
const getSummary = catchAsync(async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [loginRes, updatesRes, lastActiveRes] = await Promise.all([
    // total login count
    supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'login'),

    // field updates in last 30 days
    supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'field_update')
      .gte('created_at', thirtyDaysAgo),

    // most recent activity timestamp
    supabase
      .from('activity_log')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  const summary = {
    totalLogins:           loginRes.count    ?? 0,
    profileUpdatesLast30d: updatesRes.count  ?? 0,
    lastActiveAt:          lastActiveRes.data?.[0]?.created_at ?? null,
  };

  const response = ApiResponse.success(summary, 'Activity summary retrieved');
  res.status(response.statusCode).json(response);
});

/**
 * @route   DELETE /api/v1/activity/logs/:id
 * @desc    Delete a single activity log entry
 * @access  Admin
 */
const deleteLog = catchAsync(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('activity_log')
    .delete()
    .eq('id', id);

  if (error) throw ApiError.internal('Failed to delete activity log entry');

  const response = ApiResponse.success(null, 'Log entry deleted');
  res.status(response.statusCode).json(response);
});

/**
 * @route   DELETE /api/v1/activity/logs
 * @desc    Delete ALL activity log entries
 * @access  Admin
 */
const deleteAllLogs = catchAsync(async (req, res) => {
  // Supabase requires a filter to allow mass-delete; neq on a nullable column covers all rows
  const { error } = await supabase
    .from('activity_log')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) throw ApiError.internal('Failed to clear activity logs');

  const response = ApiResponse.success(null, 'All activity logs cleared');
  res.status(response.statusCode).json(response);
});

module.exports = { getFeed, getLogins, getFieldChanges, getSummary, deleteLog, deleteAllLogs };
