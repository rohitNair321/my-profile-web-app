const OpenAI = require('openai');
const { supabase } = require('../db/supabaseClient');
const logger = require('../config/logger');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Profile cache (10-min TTL to avoid DB hit per request) ───────────────────
let _profileCache = null;
let _profileCachedAt = 0;
const PROFILE_TTL_MS = 10 * 60 * 1000;

async function getProfile() {
  const now = Date.now();
  if (_profileCache && now - _profileCachedAt < PROFILE_TTL_MS) {
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

/** Force-expire the cache (call after admin profile update) */
function invalidateProfileCache() {
  _profileCache = null;
  _profileCachedAt = 0;
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
  const profile = await getProfile();
  const systemPrompt = buildSystemPrompt(profile, role);

  // Map stored messages to OpenAI roles; cap at last 8 messages (4 turns)
  const priorMessages = conversationHistory
    .slice(-8)
    .map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
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
function buildSystemPrompt(profile, role) {
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

## This App
Stack: Angular 19, Node.js, Express, Supabase, OpenAI. Built by ${profile.full_name}.
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

module.exports = { askAI, buildSystemPrompt, invalidateProfileCache };
