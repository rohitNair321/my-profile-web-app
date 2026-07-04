'use strict';

const { supabase } = require('../../../db/supabaseClient');
const ApiResponse  = require('../../../utils/ApiResponse');
const catchAsync   = require('../../../utils/catchAsync');
const logger       = require('../../../config/logger');

const BUCKET = process.env.ASSET_BUCKET || 'assets';

async function checkDatabase() {
  const start = Date.now();
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    return {
      name:     'Database',
      status:   error ? 'error' : 'ok',
      latencyMs: Date.now() - start,
      detail:   error ? error.message : 'Connected',
    };
  } catch (e) {
    return { name: 'Database', status: 'error', latencyMs: Date.now() - start, detail: String(e) };
  }
}

async function checkStorage() {
  const start = Date.now();
  try {
    const { error } = await supabase.storage.from(BUCKET).list('', { limit: 1 });
    return {
      name:      'Storage',
      status:    error ? 'error' : 'ok',
      latencyMs: Date.now() - start,
      detail:    error ? error.message : `Bucket: ${BUCKET}`,
    };
  } catch (e) {
    return { name: 'Storage', status: 'error', latencyMs: Date.now() - start, detail: String(e) };
  }
}

async function checkOpenAI() {
  const start = Date.now();
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return { name: 'AI (OpenAI)', status: 'warning', latencyMs: 0, detail: 'API key not configured' };
  }
  return {
    name:      'AI (OpenAI)',
    status:    'ok',
    latencyMs: Date.now() - start,
    detail:    'Key present',
  };
}

function checkAPI() {
  return {
    name:      'API',
    status:    'ok',
    latencyMs: 0,
    detail:    `Uptime: ${Math.floor(process.uptime())}s`,
  };
}

/**
 * @route   GET /api/v1/health/status
 * @desc    Return system health for all critical services
 * @access  Admin
 */
const getHealthStatus = catchAsync(async (req, res) => {
  const [db, storage, ai] = await Promise.all([
    checkDatabase(),
    checkStorage(),
    checkOpenAI(),
  ]);
  const api = checkAPI();

  const checks = [db, storage, ai, api];
  const overallOk = checks.every(c => c.status === 'ok' || c.status === 'warning');

  const response = ApiResponse.success(
    {
      overall: overallOk ? 'healthy' : 'degraded',
      uptime:  process.uptime(),
      checks,
    },
    'Health status retrieved'
  );
  res.status(response.statusCode).json(response);
});

module.exports = { getHealthStatus };
