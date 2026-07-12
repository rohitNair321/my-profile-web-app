// api/v1/posts/post.controller.js
'use strict';

const postService  = require('../../../services/post.service');
const aiService    = require('../../../services/aiService');
const { resolveOwnerId } = require('../../../services/tenancy/ownerContext');
const ApiResponse  = require('../../../utils/ApiResponse');
const ApiError     = require('../../../utils/ApiError');
const catchAsync   = require('../../../utils/catchAsync');
const crypto       = require('crypto');
const sseManager   = require('./sse-manager');

const AI_ASSIST_ACTIONS = ['excerpt', 'titles', 'improve', 'seo'];

// Public reads target a portfolio owner (?owner=, else the primary owner);
// admin reads/writes are scoped to the authenticated user's own portfolio.
const publicOwner = (req) => resolveOwnerId({ user: req.user, requestedOwner: req.query.owner });
const adminOwner  = (req) => resolveOwnerId({ user: req.user });

// ── PUBLIC CONTROLLERS ────────────────────────────────────────

/**
 * GET /api/v1/posts
 * Returns all published posts with pagination + optional tag/search filter.
 */
const getAllPublished = catchAsync(async (req, res) => {
  const { page = 1, limit = 12, tag, search } = req.query;
  const result = await postService.getAllPublished({
    page:    Number(page),
    limit:   Number(limit),
    tag:     tag    || null,
    search:  search || null,
    ownerId: publicOwner(req),
  });
  res.json(new ApiResponse(200, result, 'Posts retrieved'));
});

/**
 * GET /api/v1/posts/featured
 * Returns up to 3 featured published posts for the homepage.
 */
const getFeatured = catchAsync(async (req, res) => {
  const limit  = Number(req.query.limit) || 3;
  const posts  = await postService.getFeatured(limit, publicOwner(req));
  res.json(new ApiResponse(200, { posts }, 'Featured posts retrieved'));
});

/**
 * GET /api/v1/posts/slug/:slug
 * Returns a single published post by its URL slug.
 */
const getBySlug = catchAsync(async (req, res) => {
  const post = await postService.getBySlug(req.params.slug, publicOwner(req));
  res.json(new ApiResponse(200, { post }, 'Post retrieved'));
});

/**
 * POST /api/v1/posts/:id/view
 * Tracks a page view — deduped per guest per day.
 */
const trackView = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Derive a stable guest identifier from the cookie set by ensureGuestId middleware
  // or fall back to a hash of IP + user-agent
  const guestId = req.cookies?.guestId || req.body?.guestId || 'anonymous';
  const rawIp   = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const ipHash  = crypto.createHash('sha256').update(rawIp).digest('hex').slice(0, 16);

  await postService.trackView(id, guestId, ipHash);
  res.json(new ApiResponse(200, {}, 'View tracked'));
});

// ── ADMIN CONTROLLERS ─────────────────────────────────────────

/**
 * GET /api/v1/posts/admin/all
 * Returns all posts including drafts and archived (admin only).
 */
const getAllAdmin = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const result = await postService.getAllAdmin({
    page:    Number(page),
    limit:   Number(limit),
    status:  status || null,
    ownerId: adminOwner(req),
  });
  res.json(new ApiResponse(200, result, 'All posts retrieved'));
});

/**
 * POST /api/v1/posts
 * Create a new post. Supports draft or published immediately.
 */
const create = catchAsync(async (req, res) => {
  const post = await postService.create(req.body, adminOwner(req));
  res.status(201).json(new ApiResponse(201, { post }, 'Post created'));
});

/**
 * PUT /api/v1/posts/:id
 * Full or partial update of an existing post.
 */
const update = catchAsync(async (req, res) => {
  const post = await postService.update(req.params.id, req.body, adminOwner(req));
  res.json(new ApiResponse(200, { post }, 'Post updated'));
});

/**
 * PATCH /api/v1/posts/:id/impressions
 * Quick update — LinkedIn impression count only.
 */
const updateImpressions = catchAsync(async (req, res) => {
  const { impressions } = req.body;
  const result = await postService.updateImpressions(req.params.id, impressions, adminOwner(req));
  res.json(new ApiResponse(200, result, 'Impressions updated'));
});

/**
 * DELETE /api/v1/posts/:id
 * Permanently delete a post.
 */
const deletePost = catchAsync(async (req, res) => {
  await postService.delete(req.params.id, adminOwner(req));
  res.json(new ApiResponse(200, {}, 'Post deleted'));
});

/**
 * POST /api/v1/posts/upload/cover
 * Upload a cover image to Supabase Storage, returns a public URL.
 * Expects multipart/form-data with field "cover".
 */
const uploadCover = catchAsync(async (req, res) => {
  if (!req.file) {
    return res.status(400).json(new ApiResponse(400, {}, 'No file provided'));
  }
  const result = await postService.uploadCover(
    req.file.buffer,
    req.file.mimetype,
    req.file.originalname
  );
  res.json(new ApiResponse(200, result, 'Cover image uploaded'));
});

/**
 * GET /api/v1/posts/admin/:id
 * Returns a single post (any status) — avoids fetching the whole admin list to edit one post.
 */
const getByIdAdmin = catchAsync(async (req, res) => {
  const post = await postService.getById(req.params.id, adminOwner(req));
  res.json(new ApiResponse(200, { post }, 'Post retrieved'));
});

/**
 * POST /api/v1/posts/ai-assist
 * AI writing assistant for the post editor (admin only).
 * Body: { action: 'excerpt'|'titles'|'improve'|'seo', title, content }
 */
const aiAssist = catchAsync(async (req, res) => {
  const { action, title, content } = req.body;
  if (!AI_ASSIST_ACTIONS.includes(action)) {
    throw ApiError.badRequest(`action must be one of: ${AI_ASSIST_ACTIONS.join(', ')}`);
  }
  const data = await aiService.assistWithPost({ action, title, content });
  res.json(new ApiResponse(200, data, 'AI assist generated'));
});

// ── SSE — real-time scheduler notifications ────────────────────
const streamSchedulerEvents = (req, res) => {
  res.setHeader('Content-Type',       'text/event-stream');
  res.setHeader('Cache-Control',      'no-cache');
  res.setHeader('Connection',         'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // prevent nginx buffering
  res.flushHeaders();

  res.write('event: connected\ndata: {}\n\n');
  sseManager.addClient(res);

  req.on('close', () => sseManager.removeClient(res));
};

module.exports = {
  getAllPublished,
  getFeatured,
  getBySlug,
  trackView,
  getAllAdmin,
  getByIdAdmin,
  create,
  update,
  updateImpressions,
  deletePost,
  uploadCover,
  aiAssist,
  streamSchedulerEvents,
};
