// services/post.service.js
'use strict';

const { supabase } = require('../db/supabaseClient');
const { generateSlug } = require('../utils/slug');
const { calculateReadTime } = require('../utils/readTime');
const { sanitizeHtml } = require('../utils/sanitize');
const ApiError = require('../utils/ApiError');

// Map PostgreSQL/Supabase error codes to user-facing API errors.
function mapDbError(error) {
  switch (error.code) {
    case '23514': // check_violation — value rejected by a CHECK constraint
      return ApiError.badRequest(
        'Invalid field value: ' + (error.message.includes('status')
          ? "status must be one of: draft, published, archived, scheduled"
          : error.message)
      );
    case '23505': // unique_violation
      return ApiError.badRequest('A record with that value already exists.');
    case '23503': // foreign_key_violation
      return ApiError.badRequest('Referenced record does not exist.');
    default:
      return ApiError.internal(error.message);
  }
}

// Field size caps — keep posts small/medium; DB CHECK constraints mirror these
// (see src/db/migrations/002_post_size_limits.sql)
const LIMITS = {
  TITLE_MAX:        120,
  CONTENT_MAX:      60000,  // sanitized HTML chars (~15k words of plain text)
  EXCERPT_MAX:      300,
  SEO_TITLE_MAX:    120,
  SEO_DESC_MAX:     300,
  URL_MAX:          500,
  TAGS_MAX:         8,
  TAG_LEN_MAX:      30,
};

function validatePostSizes(body) {
  const check = (val, max, field) => {
    if (val != null && String(val).length > max) {
      throw ApiError.badRequest(`${field} must be ${max} characters or fewer`);
    }
  };

  check(body.title,           LIMITS.TITLE_MAX,     'title');
  check(body.excerpt,         LIMITS.EXCERPT_MAX,   'excerpt');
  check(body.seo_title,       LIMITS.SEO_TITLE_MAX, 'seo_title');
  check(body.seo_description, LIMITS.SEO_DESC_MAX,  'seo_description');
  check(body.cover_image_url, LIMITS.URL_MAX,       'cover_image_url');
  check(body.linkedin_url,    LIMITS.URL_MAX,       'linkedin_url');
  check(body.og_image_url,    LIMITS.URL_MAX,       'og_image_url');

  if (body.content != null && String(body.content).length > LIMITS.CONTENT_MAX) {
    throw ApiError.badRequest(
      `Post content is too large (max ${LIMITS.CONTENT_MAX.toLocaleString()} characters of HTML). ` +
      'Keep posts small/medium — move images to storage, split very long write-ups.'
    );
  }

  if (body.tags != null) {
    if (!Array.isArray(body.tags) || body.tags.length > LIMITS.TAGS_MAX ||
        body.tags.some(t => typeof t !== 'string' || t.length > LIMITS.TAG_LEN_MAX)) {
      throw ApiError.badRequest(
        `tags must be an array of at most ${LIMITS.TAGS_MAX} strings, each ≤ ${LIMITS.TAG_LEN_MAX} characters`
      );
    }
  }
}

/** Plain text derived from sanitized HTML — replaces stored content_raw */
function htmlToPlainText(html = '') {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

class PostService {

  // ── GET ALL PUBLISHED ────────────────────────────────────────
  async getAllPublished({ page = 1, limit = 12, tag = null, search = null, ownerId = null } = {}) {
    const from   = (page - 1) * limit;
    const to     = from + limit - 1;
    const nowIso = new Date().toISOString();

    let query = supabase
      .from('posts')
      .select(
        'id, title, slug, excerpt, cover_image_url, tags, week_number, read_time, impressions, views, published_at, scheduled_at, is_featured',
        { count: 'exact' }
      )
      .or(`status.eq.published,and(status.eq.scheduled,scheduled_at.lte.${nowIso})`)
      .order('published_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (ownerId) query = query.eq('owner_id', ownerId);
    if (tag)     query = query.contains('tags', [tag]);
    if (search)  query = query.ilike('title', `%${search}%`);

    const { data, error, count } = await query;
    if (error) throw ApiError.internal(error.message);

    // Fire-and-forget: promote any past-due scheduled posts to published
    supabase.from('posts')
      .update({ status: 'published', published_at: nowIso, scheduled_at: null })
      .eq('status', 'scheduled')
      .lte('scheduled_at', nowIso)
      .then(({ error: e }) => { if (e) console.warn('schedule promotion failed:', e.message); });

    return {
      posts: data ?? [],
      pagination: {
        total:      count ?? 0,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    };
  }

  // ── GET BY SLUG ──────────────────────────────────────────────
  async getBySlug(slug, ownerId = null) {
    const nowIso = new Date().toISOString();
    let query = supabase
      .from('posts')
      .select('*')
      .eq('slug', slug)
      .or(`status.eq.published,and(status.eq.scheduled,scheduled_at.lte.${nowIso})`);

    if (ownerId) query = query.eq('owner_id', ownerId);

    const { data, error } = await query.maybeSingle();

    if (error) throw ApiError.internal(error.message);
    if (!data)  throw ApiError.notFound('Post not found');

    // Lazy-promote if this post was still in 'scheduled' state
    if (data.status === 'scheduled') {
      supabase.from('posts')
        .update({ status: 'published', published_at: nowIso, scheduled_at: null })
        .eq('id', data.id)
        .then(({ error: e }) => { if (e) console.warn('schedule promotion failed:', e.message); });
    }

    return data;
  }

  // ── GET FEATURED ─────────────────────────────────────────────
  async getFeatured(limit = 3, ownerId = null) {
    const nowIso = new Date().toISOString();
    let query = supabase
      .from('posts')
      .select('id, title, slug, excerpt, cover_image_url, tags, read_time, published_at, scheduled_at')
      .or(`status.eq.published,and(status.eq.scheduled,scheduled_at.lte.${nowIso})`)
      .eq('is_featured', true)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (ownerId) query = query.eq('owner_id', ownerId);

    const { data, error } = await query;
    if (error) throw ApiError.internal(error.message);
    return data ?? [];
  }

  // ── GET ALL (ADMIN) ──────────────────────────────────────────
  async getAllAdmin({ page = 1, limit = 20, status = null, ownerId = null } = {}) {
    const from = (page - 1) * limit;
    const to   = from + limit - 1;

    let query = supabase
      .from('posts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (ownerId) query = query.eq('owner_id', ownerId);
    if (status)  query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw ApiError.internal(error.message);

    return { posts: data ?? [], total: count ?? 0 };
  }

  // ── CREATE ───────────────────────────────────────────────────
  async create(body, ownerId = null) {
    if (!body.title) throw ApiError.badRequest('title is required');
    if (!body.content) throw ApiError.badRequest('content is required');
    validatePostSizes(body);

    const slug             = await this._generateUniqueSlug(body.title);
    const sanitizedContent = sanitizeHtml(body.content);
    // Derive plain text server-side — content_raw is no longer stored (≈50% row size saving)
    const plainText        = htmlToPlainText(sanitizedContent);
    const readTime         = calculateReadTime(plainText);

    const now            = new Date();
    const schedDate      = body.scheduled_at ? new Date(body.scheduled_at) : null;
    const isScheduledFuture = !!(schedDate && schedDate > now);

    const postData = {
      title:           body.title,
      slug,
      excerpt:         body.excerpt || this._generateExcerpt(plainText),
      content:         sanitizedContent,
      content_raw:     '',
      cover_image_url: body.cover_image_url  || null,
      linkedin_url:    body.linkedin_url     || null,
      status:          isScheduledFuture ? 'scheduled' : (body.status || 'draft'),
      is_featured:     body.is_featured      || false,
      week_number:     body.week_number      || null,
      tags:            Array.isArray(body.tags) ? body.tags : [],
      seo_title:       body.seo_title        || body.title,
      seo_description: body.seo_description  || body.excerpt || '',
      og_image_url:    body.og_image_url     || body.cover_image_url || null,
      read_time:       readTime,
      impressions:     body.impressions      || 0,
      scheduled_at:    isScheduledFuture ? body.scheduled_at : null,
      published_at:    (!isScheduledFuture && body.status === 'published') ? now.toISOString() : null,
      ...(ownerId ? { owner_id: ownerId } : {}),
    };

    const { data, error } = await supabase
      .from('posts')
      .insert(postData)
      .select()
      .single();

    if (error) throw mapDbError(error);
    return data;
  }

  // ── UPDATE ───────────────────────────────────────────────────
  async update(id, body, ownerId = null) {
    const existing = await this._findById(id, ownerId);
    validatePostSizes(body);
    const updates  = { ...body };

    // Re-sanitize and recalculate read time if content changed
    if (body.content) {
      updates.content     = sanitizeHtml(body.content);
      const plainText     = htmlToPlainText(updates.content);
      updates.read_time   = calculateReadTime(plainText);
      updates.content_raw = ''; // no longer stored — derived server-side

      // Auto-generate excerpt if content changed but excerpt not provided
      if (!body.excerpt) {
        updates.excerpt = this._generateExcerpt(plainText);
      }
    }

    // Scheduling logic takes priority over plain status updates
    if ('scheduled_at' in body) {
      const schedDate = body.scheduled_at ? new Date(body.scheduled_at) : null;
      if (schedDate && schedDate > new Date()) {
        // Future schedule — override status to 'scheduled'
        updates.scheduled_at = body.scheduled_at;
        updates.status       = 'scheduled';
        updates.published_at = null;
      } else {
        // Clearing or past-date schedule → unschedule
        updates.scheduled_at = null;
        if (existing.status === 'scheduled') {
          updates.status = body.status || 'draft';
        }
      }
    } else if (body.status === 'published' && existing.status !== 'published') {
      // Normal publish (includes manual override: scheduled → published)
      updates.published_at = new Date().toISOString();
      if (existing.status === 'scheduled') updates.scheduled_at = null;
    }

    let uq = supabase.from('posts').update(updates).eq('id', id);
    if (ownerId) uq = uq.eq('owner_id', ownerId);
    const { data, error } = await uq.select().single();

    if (error) throw mapDbError(error);
    return data;
  }

  // ── UPDATE IMPRESSIONS ───────────────────────────────────────
  async updateImpressions(id, impressions, ownerId = null) {
    const imp = Number(impressions);
    if (isNaN(imp) || imp < 0) throw ApiError.badRequest('impressions must be a non-negative number');

    let uq = supabase.from('posts').update({ impressions: imp }).eq('id', id);
    if (ownerId) uq = uq.eq('owner_id', ownerId);
    const { data, error } = await uq.select('id, impressions').single();

    if (error) throw ApiError.internal(error.message);
    if (!data)  throw ApiError.notFound('Post not found');
    return data;
  }

  // ── TRACK VIEW ───────────────────────────────────────────────
  async trackView(postId, guestId, ipHash) {
    // Dedup: one view per guest per post per day
    const today = new Date().toISOString().split('T')[0];

    const { data: existing } = await supabase
      .from('post_views')
      .select('id')
      .eq('post_id', postId)
      .eq('guest_id', guestId)
      .gte('viewed_at', `${today}T00:00:00Z`)
      .maybeSingle();

    if (existing) return; // Already counted today

    // Insert view record
    await supabase
      .from('post_views')
      .insert({ post_id: postId, guest_id: guestId, ip_hash: ipHash });

    // Increment view counter via RPC (defined in Supabase SQL)
    await supabase.rpc('increment_post_views', { post_id: postId });
  }

  // ── DELETE ───────────────────────────────────────────────────
  async delete(id, ownerId = null) {
    await this._findById(id, ownerId); // throws 404 if not found / not owned
    let dq = supabase.from('posts').delete().eq('id', id);
    if (ownerId) dq = dq.eq('owner_id', ownerId);
    const { error } = await dq;
    if (error) throw ApiError.internal(error.message);

    // Fire-and-forget: purge this post's scheduler activity events so a deleted
    // post can never surface a "published" notification in the admin dashboard.
    supabase
      .from('activity_log')
      .delete()
      .in('event_type', ['scheduled_post_published', 'scheduled_post_failed'])
      .eq('meta->>post_id', id)
      .then(({ error: e }) => { if (e) console.warn('scheduler activity cleanup failed:', e.message); });

    return { success: true };
  }

  // ── UPLOAD COVER IMAGE ───────────────────────────────────────
  async uploadCover(buffer, mimeType, originalName) {
    const BUCKET = process.env.ASSET_BUCKET || 'assets';
    // Extension derived from the validated mime type — never from the client filename
    const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
    const ext = EXT_BY_MIME[mimeType];
    if (!ext) throw ApiError.badRequest('Unsupported image type');
    const path = `posts/covers/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: mimeType, upsert: false });

    if (error) throw ApiError.internal('Cover image upload failed: ' + error.message);

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { url: urlData.publicUrl, path };
  }

  // ── GET BY ID (ADMIN) ────────────────────────────────────────
  async getById(id, ownerId = null) {
    return this._findById(id, ownerId);
  }

  // ── PRIVATE HELPERS ──────────────────────────────────────────
  async _findById(id, ownerId = null) {
    let query = supabase.from('posts').select('*').eq('id', id);
    if (ownerId) query = query.eq('owner_id', ownerId);
    const { data, error } = await query.maybeSingle();

    if (error) throw ApiError.internal(error.message);
    if (!data)  throw ApiError.notFound('Post not found');
    return data;
  }

  async _generateUniqueSlug(title) {
    let base    = generateSlug(title);
    let counter = 0;

    while (true) {
      const candidate = counter === 0 ? base : `${base}-${counter}`;
      const { data }  = await supabase
        .from('posts')
        .select('id')
        .eq('slug', candidate)
        .maybeSingle();
      if (!data) return candidate;
      counter++;
    }
  }

  _generateExcerpt(text = '', maxLength = 160) {
    const clean = text.replace(/<[^>]*>/g, '').trim();
    return clean.length <= maxLength
      ? clean
      : clean.slice(0, maxLength).trim() + '…';
  }
}

module.exports = new PostService();
