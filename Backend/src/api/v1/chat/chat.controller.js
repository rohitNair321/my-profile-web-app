// api/v1/chat/chat.controller.js
const chatService = require('../../../services/chatService');
const ApiResponse = require('../../../utils/ApiResponse');
const ApiError = require('../../../utils/ApiError');
const catchAsync = require('../../../utils/catchAsync');
const { USER_ROLES } = require('../../../config/constants');
const { supabase } = require('../../../config/database');
const logger = require('../../../config/logger');

// Pricing constants for cost estimation fallback
const PRICING = {
  'o4-mini':     { input: 0.00000015, output: 0.0000006 },
  'gpt-4o':      { input: 0.000005,   output: 0.000015  },
  'gpt-4o-mini': { input: 0.00000015, output: 0.0000006 },
};

function calcCost(inputTokens = 0, outputTokens = 0, model = 'gpt-4o-mini') {
  const p = PRICING[model] ?? PRICING['gpt-4o-mini'];
  return inputTokens * p.input + outputTokens * p.output;
}

/**
 * @route   POST /api/v1/chat/send
 * @desc    Send chat message to AI
 * @access  Public (with optional auth)
 */
const sendMessage = catchAsync(async (req, res) => {
  const { message, sessionId, userId } = req.body;
  const user = req.user;
  const guestId = req.guestId || user?.guestId;

  const userIp =
    req.headers['x-forwarded-for'] ||
    req.socket.remoteAddress ||
    'unknown';

  const result = await chatService.sendChatMessage({
    message,
    sessionId,
    userId: userId || user?.id,
    role: user?.role || USER_ROLES.GUEST,
    guestId,
    userIp,
  });

  // Check if limit reached
  if (result.limitReached) {
    const response = ApiResponse.success(
      {
        limitReached: true,
        remainingQuestions: 0,
      },
      result.message
    );
    return res.status(response.statusCode).json(response);
  }

  const response = ApiResponse.success(
    {
      response: result.response,
      sessionId: result.sessionId,
      limitReached: false,
      remainingQuestions: result.remainingQuestions,
    },
    'Message sent successfully'
  );

  res.status(response.statusCode).json(response);
});

/**
 * @route   GET /api/v1/chat/sessions
 * @desc    Get all chat sessions for user
 * @access  Public (with optional auth)
 */
const getSessions = catchAsync(async (req, res) => {
  const user = req.user;
  const guestId = req.guestId || user?.guestId;

  const sessions = await chatService.getChatSessions({
    userId: user?.id,
    role: user?.role || USER_ROLES.GUEST,
    guestId,
  });

  const response = ApiResponse.success(
    sessions,
    'Sessions retrieved successfully'
  );

  res.status(response.statusCode).json(response);
});

/**
 * @route   GET /api/v1/chat/sessions/:id
 * @desc    Get single chat session
 * @access  Public (with optional auth)
 */
const getSession = catchAsync(async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const guestId = req.guestId || user?.guestId;

  if (!id) {
    throw ApiError.badRequest('Session ID is required');
  }

  const session = await chatService.getChatSession(
    id,
    user?.id,
    user?.role || USER_ROLES.GUEST,
    guestId
  );

  const response = ApiResponse.success(
    session,
    'Session retrieved successfully'
  );

  res.status(response.statusCode).json(response);
});

/**
 * @route   DELETE /api/v1/chat/sessions/:id
 * @desc    Delete chat session
 * @access  Public (with optional auth)
 */
const deleteSession = catchAsync(async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const guestId = req.guestId || user?.guestId;

  if (!id) {
    throw ApiError.badRequest('Session ID is required');
  }

  await chatService.deleteChatSession(
    id,
    user?.id,
    user?.role || USER_ROLES.GUEST,
    guestId
  );

  const response = ApiResponse.success(
    { success: true },
    'Session deleted successfully'
  );

  res.status(response.statusCode).json(response);
});

/**
 * @route   DELETE /api/v1/chat/sessions
 * @desc    Delete all chat sessions (Admin only)
 * @access  Private (Admin)
 */
const deleteAllSessions = catchAsync(async (req, res) => {
  const user = req.user;

  if (user.role !== USER_ROLES.ADMIN) {
    throw ApiError.forbidden('Admin access required');
  }

  await chatService.deleteAllSessions(user.id);

  const response = ApiResponse.success(
    { success: true },
    'All sessions deleted successfully'
  );

  res.status(response.statusCode).json(response);
});

function getStartDate(range) {
  if (range === 'all') return null;
  const days = range === '90d' ? 90 : range === '30d' ? 30 : 7;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function zeroBlock() {
  return { totalTokens: 0, inputTokens: 0, outputTokens: 0, cost: 0, requests: 0 };
}

/**
 * @route   GET /api/v1/chat/stats
 * @desc    Get AI usage analytics from ai_usage table (Admin only)
 * @access  Private (Admin)
 */
const getChatStats = catchAsync(async (req, res) => {
  const user = req.user;

  if (user.role !== USER_ROLES.ADMIN) {
    throw ApiError.forbidden('Admin access required');
  }

  const range = req.query.range || '7d';
  const startDate = getStartDate(range);

  let query = supabase
    .from('ai_usage')
    .select('created_at, model, input_tokens, output_tokens, total_tokens, session_id, role, is_guest')
    .order('created_at', { ascending: true });

  if (startDate) {
    query = query.gte('created_at', startDate);
  }

  const { data: rows, error } = await query;

  if (error) {
    logger.error('ai_usage fetch error', error);
    throw ApiError.internal('Failed to fetch usage data');
  }

  if (!rows || rows.length === 0) {
    const empty = ApiResponse.success({
      summary: { totalTokens: 0, inputTokens: 0, outputTokens: 0, totalCost: 0 },
      trend: [],
      byModel: [],
      byRole: { admin: zeroBlock(), guest: zeroBlock() },
      sessions: [],
      allTime: { ...zeroBlock(), totalRequests: 0, totalCost: 0 },
    }, 'No usage data for the selected range');
    return res.status(empty.statusCode).json(empty);
  }

  // Summary for selected range
  let totalInput = 0, totalOutput = 0, totalAll = 0, totalCost = 0;
  rows.forEach(r => {
    totalInput += r.input_tokens ?? 0;
    totalOutput += r.output_tokens ?? 0;
    totalAll += r.total_tokens ?? 0;
    totalCost += calcCost(r.input_tokens, r.output_tokens, r.model);
  });

  const summary = {
    totalTokens: totalAll,
    inputTokens: totalInput,
    outputTokens: totalOutput,
    totalCost: parseFloat(totalCost.toFixed(6)),
  };

  // Daily trend
  const dateMap = {};
  rows.forEach(r => {
    const day = r.created_at.slice(0, 10);
    if (!dateMap[day]) {
      dateMap[day] = { date: day, tokens: 0, inputTokens: 0, outputTokens: 0, cost: 0, requests: 0 };
    }
    dateMap[day].tokens    += r.total_tokens  ?? 0;
    dateMap[day].inputTokens  += r.input_tokens  ?? 0;
    dateMap[day].outputTokens += r.output_tokens ?? 0;
    dateMap[day].cost      += calcCost(r.input_tokens, r.output_tokens, r.model);
    dateMap[day].requests  += 1;
  });
  const trend = Object.values(dateMap).map(d => ({ ...d, cost: parseFloat(d.cost.toFixed(6)) }));

  // By model
  const modelMap = {};
  rows.forEach(r => {
    const m = r.model ?? 'unknown';
    if (!modelMap[m]) {
      modelMap[m] = { model: m, totalTokens: 0, inputTokens: 0, outputTokens: 0, cost: 0, requests: 0 };
    }
    modelMap[m].totalTokens   += r.total_tokens  ?? 0;
    modelMap[m].inputTokens   += r.input_tokens  ?? 0;
    modelMap[m].outputTokens  += r.output_tokens ?? 0;
    modelMap[m].cost          += calcCost(r.input_tokens, r.output_tokens, r.model);
    modelMap[m].requests      += 1;
  });
  const byModel = Object.values(modelMap)
    .map(m => ({ ...m, cost: parseFloat(m.cost.toFixed(6)) }))
    .sort((a, b) => b.totalTokens - a.totalTokens);

  // By role
  const byRole = { admin: zeroBlock(), guest: zeroBlock() };
  rows.forEach(r => {
    const key = r.is_guest ? 'guest' : 'admin';
    byRole[key].totalTokens  += r.total_tokens  ?? 0;
    byRole[key].inputTokens  += r.input_tokens  ?? 0;
    byRole[key].outputTokens += r.output_tokens ?? 0;
    byRole[key].cost         += calcCost(r.input_tokens, r.output_tokens, r.model);
    byRole[key].requests     += 1;
  });
  byRole.admin.cost = parseFloat(byRole.admin.cost.toFixed(6));
  byRole.guest.cost = parseFloat(byRole.guest.cost.toFixed(6));

  // Per-session summary (top 20 most expensive)
  const sessionMap = {};
  rows.forEach(r => {
    const sid = r.session_id ?? 'no-session';
    if (!sessionMap[sid]) {
      sessionMap[sid] = { sessionId: sid, date: r.created_at.slice(0, 10), totalTokens: 0, inputTokens: 0, outputTokens: 0, cost: 0, requests: 0, model: r.model };
    }
    sessionMap[sid].totalTokens  += r.total_tokens  ?? 0;
    sessionMap[sid].inputTokens  += r.input_tokens  ?? 0;
    sessionMap[sid].outputTokens += r.output_tokens ?? 0;
    sessionMap[sid].cost         += calcCost(r.input_tokens, r.output_tokens, r.model);
    sessionMap[sid].requests     += 1;
  });
  const sessions = Object.values(sessionMap)
    .map(s => ({ ...s, cost: parseFloat(s.cost.toFixed(6)) }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 20);

  // All-time totals (ignores range filter)
  const { data: allRows } = await supabase
    .from('ai_usage')
    .select('input_tokens, output_tokens, total_tokens, model');

  let atInput = 0, atOutput = 0, atAll = 0, atCost = 0, atReqs = 0;
  (allRows ?? []).forEach(r => {
    atInput  += r.input_tokens  ?? 0;
    atOutput += r.output_tokens ?? 0;
    atAll    += r.total_tokens  ?? 0;
    atCost   += calcCost(r.input_tokens, r.output_tokens, r.model);
    atReqs   += 1;
  });

  const allTime = {
    totalTokens:   atAll,
    inputTokens:   atInput,
    outputTokens:  atOutput,
    totalRequests: atReqs,
    totalCost:     parseFloat(atCost.toFixed(6)),
  };

  const response = ApiResponse.success(
    { summary, trend, byModel, byRole, sessions, allTime },
    'AI usage statistics retrieved successfully'
  );

  res.status(response.statusCode).json(response);
});

/**
 * @route   GET /api/v1/chat/balance
 * @desc    Get account cost balance (admin only)
 * @access  Private (Admin)
 */
const getBalance = catchAsync(async (req, res) => {
  const user = req.user;

  if (user.role !== USER_ROLES.ADMIN) {
    throw ApiError.forbidden('Admin access required');
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/organization/usage/costs', {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (openaiRes.ok) {
      const data = await openaiRes.json();
      const totalUsed = (data.data ?? []).reduce(
        (sum, item) => sum + (item.amount?.value ?? 0), 0
      );
      const response = ApiResponse.success({
        source: 'openai',
        totalUsedUSD: parseFloat(totalUsed.toFixed(6)),
        hardLimitUSD: null,
        remainingUSD: null,
        remainingPct: null,
      }, 'Balance retrieved from OpenAI');
      return res.status(response.statusCode).json(response);
    }
  } catch (err) {
    logger.warn('OpenAI balance API unavailable, falling back to Supabase calculation', err.message);
  }

  // Fallback: calculate from our own usage data
  const { data: rows } = await supabase
    .from('ai_usage')
    .select('input_tokens, output_tokens, model');

  const totalSpent = (rows ?? []).reduce(
    (sum, r) => sum + calcCost(r.input_tokens, r.output_tokens, r.model), 0
  );

  const response = ApiResponse.success({
    source: 'supabase',
    totalUsedUSD: parseFloat(totalSpent.toFixed(6)),
    hardLimitUSD: null,
    remainingUSD: null,
    remainingPct: null,
  }, 'Balance estimated from usage data');

  res.status(response.statusCode).json(response);
});

module.exports = {
  sendMessage,
  getSessions,
  getSession,
  deleteSession,
  deleteAllSessions,
  getChatStats,
  getBalance,
};
