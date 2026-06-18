// services/post.service.js
'use strict';

const { supabase } = require('../db/supabaseClient');
const { generateSlug } = require('../utils/slug');
const { calculateReadTime } = require('../utils/readTime');
const { sanitizeHtml } = require('../utils/sanitize');
const ApiError = require('../utils/ApiError');

class PostService {

  // ── GET ALL PUBLISHED ────────────────────────────────────────
  async getAllPublished({ page = 1, limit = 12, tag = null, search = null } = {}) {
    const from = (page - 1) * limit;
    const to   = from + limit - 1;

    let query = supabase
      .from('posts')
      .select(
        'id, title, slug, excerpt, cover_image_url, tags, week_number, read_time, impressions, views, published_at, is_featured',
        { count: 'exact' }
      )
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .range(from, to);

    if (tag)    query = query.contains('tags', [tag]);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error, count } = await query;
    if (error) throw ApiError.internal(error.message);

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
  async getBySlug(slug) {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    if (error) throw ApiError.internal(error.message);
    if (!data)  throw ApiError.notFound('Post not found');
    return data;
  }

  // ── GET FEATURED ─────────────────────────────────────────────
  async getFeatured(limit = 3) {
    const { data, error } = await supabase
      .from('posts')
      .select('id, title, slug, excerpt, cover_image_url, tags, read_time, published_at')
      .eq('status', 'published')
      .eq('is_featured', true)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) throw ApiError.internal(error.message);
    return data ?? [];
  }

  // ── GET ALL (ADMIN) ──────────────────────────────────────────
  async getAllAdmin({ page = 1, limit = 20, status = null } = {}) {
    const from = (page - 1) * limit;
    const to   = from + limit - 1;

    let query = supabase
      .from('posts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw ApiError.internal(error.message);

    return { posts: data ?? [], total: count ?? 0 };
  }

  // ── CREATE ───────────────────────────────────────────────────
  async create(body) {
    if (!body.title) throw ApiError.badRequest('title is required');
    if (!body.content) throw ApiError.badRequest('content is required');

    const slug             = await this._generateUniqueSlug(body.title);
    const sanitizedContent = sanitizeHtml(body.content);
    const readTime         = calculateReadTime(body.content_raw || body.content);

    const postData = {
      title:           body.title,
      slug,
      excerpt:         body.excerpt || this._generateExcerpt(body.content_raw || body.content),
      content:         sanitizedContent,
      content_raw:     body.content_raw || '',
      cover_image_url: body.cover_image_url  || null,
      linkedin_url:    body.linkedin_url     || null,
      status:          body.status           || 'draft',
      is_featured:     body.is_featured      || false,
      week_number:     body.week_number      || null,
      tags:            Array.isArray(body.tags) ? body.tags : [],
      seo_title:       body.seo_title        || body.title,
      seo_description: body.seo_description  || body.excerpt || '',
      og_image_url:    body.og_image_url     || body.cover_image_url || null,
      read_time:       readTime,
      impressions:     body.impressions      || 0,
      published_at:    body.status === 'published' ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from('posts')
      .insert(postData)
      .select()
      .single();

    if (error) throw ApiError.internal(error.message);
    return data;
  }

  // ── UPDATE ───────────────────────────────────────────────────
  async update(id, body) {
    const existing = await this._findById(id);
    const updates  = { ...body };

    // Re-sanitize and recalculate read time if content changed
    if (body.content) {
      updates.content   = sanitizeHtml(body.content);
      updates.read_time = calculateReadTime(body.content_raw || body.content);
    }

    // Auto-generate excerpt if content changed but excerpt not provided
    if (body.content && !body.excerpt) {
      updates.excerpt = this._generateExcerpt(body.content_raw || body.content);
    }

    // Set published_at only the first time the post goes live
    if (body.status === 'published' && existing.status !== 'published') {
      updates.published_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw ApiError.internal(error.message);
    return data;
  }

  // ── UPDATE IMPRESSIONS ───────────────────────────────────────
  async updateImpressions(id, impressions) {
    const imp = Number(impressions);
    if (isNaN(imp) || imp < 0) throw ApiError.badRequest('impressions must be a non-negative number');

    const { data, error } = await supabase
      .from('posts')
      .update({ impressions: imp })
      .eq('id', id)
      .select('id, impressions')
      .single();

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
  async delete(id) {
    await this._findById(id); // throws 404 if not found
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) throw ApiError.internal(error.message);
    return { success: true };
  }

  // ── UPLOAD COVER IMAGE ───────────────────────────────────────
  async uploadCover(buffer, mimeType, originalName) {
    const BUCKET = process.env.ASSET_BUCKET || 'assets';
    const ext    = originalName.split('.').pop() || 'jpg';
    const path   = `posts/covers/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: mimeType, upsert: false });

    if (error) throw ApiError.internal('Cover image upload failed: ' + error.message);

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { url: urlData.publicUrl, path };
  }

  // ── PRIVATE HELPERS ──────────────────────────────────────────
  async _findById(id) {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

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
