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

/**
 * @route   GET /api/v1/chat/stats
 * @desc    Get chat statistics (Admin only)
 * @access  Private (Admin)
 */
const getChatStats = catchAsync(async (req, res) => {
  const user = req.user;

  if (user.role !== USER_ROLES.ADMIN) {
    throw ApiError.forbidden('Admin access required');
  }

  const stats = await chatService.getAdminChatStats(user.id);

  const response = ApiResponse.success(
    stats,
    'Chat statistics retrieved successfully'
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
