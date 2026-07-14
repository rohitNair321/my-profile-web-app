const OpenAI = require('openai');
const { supabase } = require('../db/supabaseClient');
const logger = require('../config/logger');

// ── Multi-provider AI registry ───────────────────────────────────────────────
// Three NVIDIA NIM models (all OpenAI-compatible, one shared key) plus OpenAI as
// the LAST-resort fallback. Each request tries its feature's preferred model, then
// cascades through the rest, then OpenAI — so load is spread across the NVIDIA
// models ("balance") and any provider/model outage transparently fails over.
//
// Env:
//   AI_API_KEY   — NVIDIA NIM key (build.nvidia.com)          [required for NVIDIA]
//   AI_BASE_URL  — default https://integrate.api.nvidia.com/v1
//   OPENAI_API_KEY — OpenAI key                                [optional fallback]
const NVIDIA_BASE = process.env.AI_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const NVIDIA_KEY  = process.env.AI_API_KEY || null;
const OPENAI_KEY  = process.env.OPENAI_API_KEY || null;

const _nvidiaClient = NVIDIA_KEY ? new OpenAI({ apiKey: NVIDIA_KEY, baseURL: NVIDIA_BASE }) : null;
const _openaiClient = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

// key → { provider, model, client }
// Model IDs are env-overridable because NVIDIA renames/retires catalog IDs and
// not every *listed* model is actually hosted for inference on a given key (an
// unhosted one 404s even though `models.list()` shows it). Defaults below are the
// two NVIDIA models verified to serve completions. To add a third NVIDIA model,
// verify a hosted id with `node scripts/list-ai-models.js`, then set NVIDIA_MODEL_EXTRA.
const MODELS = {
  'deepseek-v4-flash': { provider: 'nvidia', model: process.env.NVIDIA_MODEL_LARGE || 'deepseek-ai/deepseek-v4-flash', client: _nvidiaClient },
  'gpt-oss-120b':  { provider: 'nvidia', model: process.env.NVIDIA_MODEL_SMALL || 'openai/gpt-oss-120b',  client: _nvidiaClient },
  'openai':    { provider: 'openai', model: process.env.OPENAI_MODEL       || 'gpt-4o-mini',                 client: _openaiClient },
};
// Optional third NVIDIA model — only added when NVIDIA_MODEL_EXTRA is set to a
// hosted id (e.g. meta/llama-3.1-70b-instruct). Kept off by default so we never
// lead with a model that 404s.
if (process.env.NVIDIA_MODEL_EXTRA && _nvidiaClient) {
  MODELS['nvidia-extra'] = { provider: 'nvidia', model: process.env.NVIDIA_MODEL_EXTRA, client: _nvidiaClient };
}

// Per-feature preference order → sections lead with different models (balance),
// every chain ends in OpenAI (final failover). Unconfigured keys (e.g.
// 'nvidia-extra' when unset) are simply skipped by runCompletion().
const FEATURE_ORDER = {
  chat:           ['gpt-oss-120b', 'deepseek-v4-flash', 'nvidia-extra', 'openai'], // lead with the FAST 8B — snappier replies; 70B is the fallback
  post:           ['deepseek-v4-flash', 'nvidia-extra', 'gpt-oss-120b', 'openai'], // long-form writing — quality first
  'contact-reply':['gpt-oss-120b', 'deepseek-v4-flash', 'nvidia-extra', 'openai'], // short/fast drafts
  default:        ['deepseek-v4-flash', 'gpt-oss-120b', 'openai'],
};

/**
 * Run a chat completion for a feature, cascading through its model chain until
 * one succeeds. Returns the completion plus which model/provider actually served
 * it (so callers can log accurate usage). Throws only if EVERY configured model
 * fails or none are configured.
 */
async function runCompletion(feature, { messages, max_tokens = 600, temperature = 0.4 }) {
  const order = FEATURE_ORDER[feature] || FEATURE_ORDER.default;
  let lastErr = null;
  let anyConfigured = false;

  for (const key of order) {
    const entry = MODELS[key];
    if (!entry || !entry.client) continue; // provider not configured (e.g. no OpenAI key)
    anyConfigured = true;
    try {
      logger.info(`Used Model "${key}" (${entry.model})`)
      const completion = await entry.client.chat.completions.create({
        model: entry.model,
        messages,
        max_tokens,
        temperature,
      });
      
      return { completion, modelKey: key, provider: entry.provider, model: entry.model };
    } catch (err) {
      lastErr = err;
      logger.warn(`AI model "${key}" (${entry.model}) failed for feature "${feature}", trying next`, {
        error: err.message,
      });
    }
  }

  if (!anyConfigured) {
    throw new Error('No AI provider configured. Set AI_API_KEY (NVIDIA) and/or OPENAI_API_KEY.');
  }
  throw lastErr || new Error('All AI providers failed');
}

/** Fire-and-forget ai_usage row. `feature`/`provider` are stored in request_id
 *  suffix-free columns we already have; provider is inferable from `model`. */
function logUsage({ completion, model, feature, role, isGuest, sessionId, userId, guestId }) {
  const usage = completion.usage;
  supabase
    .from('ai_usage')
    .insert({
      session_id:    sessionId ?? null,
      user_id:       userId    ?? null,
      role:          role      ?? 'guest',
      is_guest:      isGuest   ?? true,
      guest_id:      guestId   ?? null,
      model:         model || completion.model,
      input_tokens:  usage?.prompt_tokens     ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
      total_tokens:  usage?.total_tokens      ?? 0,
      request_id:    completion.id,
    })
    .then(({ error }) => { if (error) logger.warn('ai_usage insert failed', { error: error.message }); });
}

// ── Per-owner caches (10-min TTL to avoid a DB hit per request) ──────────────
// Multi-tenant: the AI persona is the OWNER whose portfolio the chat is about,
// so profile + grounding posts are cached PER owner id.
const PROFILE_OWNER_ID = process.env.PROFILE_OWNER_ID;
const CACHE_TTL_MS = 10 * 60 * 1000;
const _profileCache = new Map(); // ownerId -> { data, at }
const _postsCache   = new Map(); // ownerId -> { data, at }

// Safe fallback so buildSystemPrompt never dereferences a null profile (e.g. a
// freshly-provisioned owner who hasn't saved a profile yet).
const EMPTY_PROFILE = { full_name: 'the portfolio owner', experiences: [], skills: [], open_to_work: false, email: '' };

async function getProfile(ownerId) {
  const id = ownerId || PROFILE_OWNER_ID;
  const now = Date.now();
  const hit = _profileCache.get(id);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.data;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;

  const profile = data || EMPTY_PROFILE;
  _profileCache.set(id, { data: profile, at: now });
  return profile;
}

/** Recent published posts for one owner, used to GROUND the chat (RAG-lite) so
 *  it can answer about articles/topics from real content instead of guessing.
 *  Title + excerpt + tags only, capped small to keep token cost low. Never
 *  throws — grounding is best-effort, so a posts failure must not break the chat. */
async function getRecentPosts(ownerId) {
  const id = ownerId || PROFILE_OWNER_ID;
  const now = Date.now();
  const hit = _postsCache.get(id);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.data;

  try {
    const { data, error } = await supabase
      .from('posts')
      .select('title, excerpt, tags, slug, published_at')
      .eq('owner_id', id)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(6);
    if (error) { logger.warn('getRecentPosts failed', { error: error.message }); return hit?.data || []; }
    const posts = data || [];
    _postsCache.set(id, { data: posts, at: now });
    return posts;
  } catch (e) {
    logger.warn('getRecentPosts threw', { error: e.message });
    return hit?.data || [];
  }
}

/** Force-expire caches (call after profile/post updates). Pass an ownerId to
 *  clear just that owner; omit to clear everyone. */
function invalidateProfileCache(ownerId) {
  if (ownerId) _profileCache.delete(ownerId); else _profileCache.clear();
}
function invalidatePostsCache(ownerId) {
  if (ownerId) _postsCache.delete(ownerId); else _postsCache.clear();
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
  // Persona = the OWNER whose portfolio this chat is about (userId).
  const [profile, posts] = await Promise.all([getProfile(userId), getRecentPosts(userId)]);
  const systemPrompt = buildSystemPrompt(profile, role, posts);

  // Map stored messages to OpenAI roles; cap at last 8 messages (4 turns)
  const priorMessages = conversationHistory
    .slice(-8)
    .map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));

  const { completion, model } = await runCompletion('chat', {
    messages: [
      { role: 'system', content: systemPrompt },
      ...priorMessages,
      { role: 'user', content: message },
    ],
    max_tokens: 400, // shorter cap → faster replies (portfolio Q&A answers are brief)
    temperature: 0.4,
  });

  const reply = completion.choices[0].message.content;

  // Fire-and-forget — do not block the reply on DB write
  logUsage({ completion, model, feature: 'chat', role, isGuest, sessionId, userId, guestId });

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

  const { completion, model } = await runCompletion('post', {
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

  logUsage({ completion, model, feature: 'post', role: 'admin', isGuest: false });

  return { action, result };
}

// ── Contact reply drafter (admin messages inbox) ─────────────────────────────
/**
 * Draft a professional reply to a contact-form message. The admin can edit the
 * result before sending. Uses the fast 'contact-reply' model chain.
 * @param {{ name?:string, email?:string, subject?:string, message:string, tone?:string }} input
 * @returns {Promise<{ result:string }>}
 */
async function generateContactReply({ name = '', email = '', subject = '', message = '', tone = 'professional', ownerId } = {}) {
  if (!message || !String(message).trim()) {
    const err = new Error('The original message is empty — nothing to reply to.');
    err.statusCode = 400;
    throw err;
  }

  const profile = await getProfile(ownerId).catch(() => ({}));
  const senderName = name || 'there';
  const signOff = profile.full_name || 'Rohit';

  const system =
    `You draft ${tone} email replies on behalf of ${signOff} (a software engineer) to messages received via his portfolio contact form. ` +
    `Write a concise, warm, ${tone} reply (2–5 short sentences). Address the sender by first name if given. ` +
    `Acknowledge their message, respond helpfully, and end with a friendly sign-off as "${signOff}". ` +
    `Return ONLY the reply text — no subject line, no quotes, no markdown, no placeholders like [name].`;

  const user =
    `Sender: ${senderName}${email ? ` <${email}>` : ''}\n` +
    `${subject ? `Subject: ${subject}\n` : ''}` +
    `Their message:\n${String(message).slice(0, 3000)}`;

  const { completion, model } = await runCompletion('contact-reply', {
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user },
    ],
    max_tokens: 400,
    temperature: 0.6,
  });

  const result = (completion.choices?.[0]?.message?.content ?? '').trim();
  logUsage({ completion, model, feature: 'contact-reply', role: 'admin', isGuest: false });
  return { result };
}

// ── Contact message composer (public contact form "help me write") ───────────
/**
 * Draft a short, professional inquiry message a visitor can edit before sending
 * via the public contact form. Written in first person AS the visitor. Uses the
 * fast 'contact-reply' model chain.
 * @param {{ name?:string, subject?:string }} input
 * @returns {Promise<{ result:string }>}
 */
async function composeContactMessage({ name = '', subject = '', ownerId } = {}) {
  const profile = await getProfile(ownerId).catch(() => ({}));
  const owner = profile.full_name || 'Rohit';

  const system =
    `You help a website visitor draft a short, professional message to ${owner} via his ` +
    `portfolio contact form. Write a friendly, concise inquiry (2–4 sentences) in FIRST PERSON ` +
    `as the visitor. Do NOT invent specific details, dates, budgets, or company names. Return ` +
    `ONLY the message body — no "Dear"/greeting line, no subject, no sign-off, no placeholders like [name].`;

  const user =
    `Visitor name: ${name || '(unknown)'}\n` +
    `Topic / subject: ${subject || 'general inquiry or potential collaboration'}\n` +
    `Draft the message.`;

  const { completion, model } = await runCompletion('contact-reply', {
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user },
    ],
    max_tokens: 250,
    temperature: 0.7,
  });

  const result = (completion.choices?.[0]?.message?.content ?? '').trim();
  logUsage({ completion, model, feature: 'contact-reply', role: 'guest', isGuest: true });
  return { result };
}

module.exports = {
  askAI,
  buildSystemPrompt,
  invalidateProfileCache,
  invalidatePostsCache,
  assistWithPost,
  generateContactReply,
  composeContactMessage,
};
