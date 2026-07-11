const OpenAI = require('openai');
const { supabase } = require('../db/supabaseClient');
const logger = require('../config/logger');

// AI provider is env-driven so we can switch OpenAI ↔ NVIDIA NIM (or Groq/
// OpenRouter — all OpenAI-compatible) without touching code:
//   AI_BASE_URL=https://integrate.api.nvidia.com/v1
//   AI_API_KEY=<provider key>
//   AI_MODEL=meta/llama-3.3-70b-instruct
// Falls back to the original OpenAI gpt-4o-mini config when unset.
const client = new OpenAI({
  apiKey:  process.env.AI_API_KEY || process.env.OPENAI_API_KEY,
  ...(process.env.AI_BASE_URL ? { baseURL: process.env.AI_BASE_URL } : {}),
});
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

// ── Caches (10-min TTL to avoid a DB hit per request) ────────────────────────
let _profileCache = null;
let _profileCachedAt = 0;
let _postsCache = null;
let _postsCachedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

async function getProfile() {
  const now = Date.now();
  if (_profileCache && now - _profileCachedAt < CACHE_TTL_MS) {
    return _profileCache;
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1)
    .single();
  if (error) throw error;
  _profileCache = data;
  _profileCachedAt = now;
  return data;
}

/** Recent published posts, used to GROUND the chat (RAG-lite) so it can answer
 *  about articles/topics from real content instead of guessing. Title + excerpt
 *  + tags only, capped small to keep token cost low. Never throws — grounding is
 *  best-effort, so a posts failure must not break the chat. */
async function getRecentPosts() {
  const now = Date.now();
  if (_postsCache && now - _postsCachedAt < CACHE_TTL_MS) {
    return _postsCache;
  }
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('title, excerpt, tags, slug, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(6);
    if (error) { logger.warn('getRecentPosts failed', { error: error.message }); return _postsCache || []; }
    _postsCache = data || [];
    _postsCachedAt = now;
    return _postsCache;
  } catch (e) {
    logger.warn('getRecentPosts threw', { error: e.message });
    return _postsCache || [];
  }
}

/** Force-expire the caches (call after admin profile/post updates) */
function invalidateProfileCache() {
  _profileCache = null;
  _profileCachedAt = 0;
}
function invalidatePostsCache() {
  _postsCache = null;
  _postsCachedAt = 0;
}

// ── Main AI call ──────────────────────────────────────────────────────────────
/**
 * @param {string}   message             - Current user message
 * @param {string}   role                - 'admin' | 'guest'
 * @param {string}   [guestId]
 * @param {string}   [sessionId]
 * @param {string}   [userId]
 * @param {boolean}  [isGuest]
 * @param {Array}    [conversationHistory] - Prior {sender,text} messages from session
 */
async function askAI(
  message,
  role,
  guestId,
  sessionId,
  userId,
  isGuest,
  conversationHistory = []
) {
  const [profile, posts] = await Promise.all([getProfile(), getRecentPosts()]);
  const systemPrompt = buildSystemPrompt(profile, role, posts);

  // Map stored messages to OpenAI roles; cap at last 8 messages (4 turns)
  const priorMessages = conversationHistory
    .slice(-8)
    .map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));

  const completion = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...priorMessages,
      { role: 'user', content: message },
    ],
    max_tokens: 600,
    temperature: 0.4,
  });

  const reply = completion.choices[0].message.content;
  const usage = completion.usage;

  // Fire-and-forget — do not block the reply on DB write
  supabase
    .from('ai_usage')
    .insert({
      session_id:    sessionId   ?? null,
      user_id:       userId      ?? null,
      role:          role        ?? 'guest',
      is_guest:      isGuest     ?? true,
      guest_id:      guestId     ?? null,
      model:         completion.model,
      input_tokens:  usage?.prompt_tokens     ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
      total_tokens:  usage?.total_tokens      ?? 0,
      request_id:    completion.id,
    })
    .then(({ error }) => {
      if (error) logger.warn('ai_usage insert failed', { error: error.message });
    });

  return reply;
}

// ── System prompt (compact — keeps token cost low) ───────────────────────────
function buildSystemPrompt(profile, role, posts = []) {
  const currentExp = (profile.experiences ?? []).find(e => e.present);
  const currentRole = currentExp
    ? `${currentExp.role} at ${currentExp.company}`
    : (profile.currentCompany ?? 'N/A');

  const skillsList = (profile.skills ?? []).join(', ');

  const openToWork = profile.open_to_work
    ? `Yes — open to new opportunities.`
    : `Not actively looking but open to the right fit. Reach out at ${profile.email}.`;

  // Compact experience block: role · company · period | key projects (title + tech only)
  const expBlock = (profile.experiences ?? [])
    .map(exp => {
      const period = exp.present
        ? `${exp.startDate} – Present`
        : `${exp.startDate} – ${exp.endDate}`;
      const projects = (exp.projects ?? [])
        .map(p => `${p.title} (${(p.technologies ?? []).join(', ')})`)
        .join('; ');
      return `• ${exp.role} — ${exp.company} | ${period}${projects ? `\n  Projects: ${projects}` : ''}`;
    })
    .join('\n');

  // Recent writing block (RAG-lite grounding). Title + tags + short excerpt so
  // the AI can accurately answer "has he written about X?" and point to /posts.
  const postsBlock = (posts ?? [])
    .map(p => {
      const tags = (p.tags ?? []).slice(0, 3).join(', ');
      const ex = p.excerpt ? ` — ${String(p.excerpt).slice(0, 140)}` : '';
      return `• ${p.title}${tags ? ` [${tags}]` : ''}${ex}`;
    })
    .join('\n');

  const greeting = role === 'admin'
    ? `Welcome back, ${profile.full_name}! How can I assist you today?`
    : `Hi! I'm FolioAI, ${profile.full_name}'s personal AI assistant. Ask me anything about his work, skills, or projects.`;

  return `You are FolioAI, the AI representative for ${profile.full_name}. Professional, concise, finance/wealth-tech savvy. Help visitors explore skills, projects, and value; nudge toward contact when natural.

Greeting (use only on first message): "${greeting}"

## Key Facts
Name: ${profile.full_name} | Current: ${currentRole} | Location: ${profile.location}
Contact: ${profile.email} | Phone: ${profile.primary_phone} | LinkedIn: ${profile.linkedin} | Site: ${profile.website}
Companies: ${profile.companyCount} | Projects: ${profile.projectCount}
Open to work: ${openToWork}

## Skills
${skillsList}

## Summary
${profile.description}

## Experience
${expBlock}
${postsBlock ? `\n## Recent Writing (published articles — reference when relevant and point to the /posts page)\n${postsBlock}` : ''}

## This App
Stack: Angular 20, Node.js, Express, Supabase, AI chat. Built by ${profile.full_name}.
Guest limit: 5 FolioAI questions, then email/form.

## Format Rules
- Simple fact (email, count, location): one line, no extras.
- List request (skills, companies, projects): bullet names only, no blurbs.
- Describe/explain: short intro + bullets with tech/outcomes.
- Greeting / "who are you": brief + one line on what you help with.
- Hiring/collab: 3–4 strength bullets + one CTA (${profile.email} or LinkedIn).
- Tone: enterprise polish. Verbs: Engineered, Delivered, Implemented. No filler phrases. Markdown OK.
- Guardrails: only facts from this prompt. Missing detail → "I don't have that. Reach ${profile.full_name} at ${profile.email}." No raw HTML.`;
}

// ── Post-writing assistant (admin editor) ────────────────────────────────────
/** Strip HTML → plain text for feeding the model. */
function htmlToText(html = '') {
  return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

const ASSIST_TASKS = {
  excerpt: {
    max_tokens: 120,
    temperature: 0.5,
    system:
      'You write concise blog excerpts. Return ONE plain-text sentence (max 40 words), no quotes, no markdown, no preamble — just the excerpt.',
    user: ({ title, body }) =>
      `Write a compelling excerpt for this post.\n\nTitle: ${title}\n\nContent:\n${body}`,
  },
  titles: {
    max_tokens: 200,
    temperature: 0.8,
    system:
      'You suggest blog post titles. Return exactly 5 titles, one per line, no numbering, no quotes, no extra text. Each ≤ 70 characters, specific and engaging.',
    user: ({ title, body }) =>
      `Suggest 5 alternative titles for this post.\n\nCurrent title: ${title || '(none)'}\n\nContent:\n${body}`,
  },
  improve: {
    max_tokens: 1500,
    temperature: 0.5,
    system:
      'You are an editor. Improve the given post content for clarity, grammar, flow, and impact while preserving the author\'s meaning, facts, and voice. Keep a similar length. Return simple HTML using only <p>, <ul>, <li>, <strong>, <em>, <h2>, <h3>, <blockquote>. No markdown, no commentary, no code fences — return only the HTML body.',
    user: ({ title, body }) =>
      `Improve this post's writing.\n\nTitle: ${title}\n\nContent:\n${body}`,
  },
  seo: {
    max_tokens: 300,
    temperature: 0.4,
    json: true,
    system:
      'You are an SEO assistant. Return ONLY a JSON object (no code fences, no prose) with keys: "seo_title" (≤60 chars), "seo_description" (150–160 chars), and "tags" (array of 3–6 short lowercase topic tags). Nothing else.',
    user: ({ title, body }) =>
      `Generate SEO metadata for this post.\n\nTitle: ${title}\n\nContent:\n${body}`,
  },
};

/**
 * Generate a writing-assist result for the post editor.
 * @param {'excerpt'|'titles'|'improve'|'seo'} action
 * @param {{title?:string, content?:string}} post
 * @returns {Promise<{action:string, result:string}>} raw model text (frontend parses per action)
 */
async function assistWithPost({ action, title = '', content = '' } = {}) {
  const task = ASSIST_TASKS[action];
  if (!task) {
    const err = new Error(`Unknown AI assist action: ${action}`);
    err.statusCode = 400;
    throw err;
  }

  const body = htmlToText(content).slice(0, 6000); // cap tokens
  if (!body && !title) {
    const err = new Error('Add a title or some content before using AI assist.');
    err.statusCode = 400;
    throw err;
  }

  const completion = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: task.system },
      { role: 'user',   content: task.user({ title, body }) },
    ],
    max_tokens: task.max_tokens,
    temperature: task.temperature,
  });

  let result = (completion.choices?.[0]?.message?.content ?? '').trim();
  // Strip accidental ``` fences some models add
  result = result.replace(/^```(?:json|html)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Fire-and-forget usage log (mirrors askAI)
  const usage = completion.usage;
  supabase
    .from('ai_usage')
    .insert({
      role: 'admin', is_guest: false, model: completion.model,
      input_tokens:  usage?.prompt_tokens     ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
      total_tokens:  usage?.total_tokens      ?? 0,
      request_id: completion.id,
    })
    .then(({ error }) => { if (error) logger.warn('ai_usage insert failed', { error: error.message }); });

  return { action, result };
}

module.exports = {
  askAI,
  buildSystemPrompt,
  invalidateProfileCache,
  invalidatePostsCache,
  assistWithPost,
};
