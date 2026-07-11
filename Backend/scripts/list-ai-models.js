/**
 * Diagnostic: list the model IDs your AI keys can actually serve.
 *
 * NVIDIA (and other OpenAI-compatible providers) return 404 for model IDs that
 * aren't available to your key. Run this to see the real IDs, then set the
 * matching NVIDIA_MODEL_* / OPENAI_MODEL env vars in .env.
 *
 *   cd Backend && node scripts/list-ai-models.js
 *
 * Filters to likely chat models (llama / nemotron / gpt / mistral / mixtral) and
 * prints the full list too.
 */
require('dotenv').config();
const OpenAI = require('openai');

const NVIDIA_BASE = process.env.AI_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const NVIDIA_KEY  = process.env.AI_API_KEY || null;
const OPENAI_KEY  = process.env.OPENAI_API_KEY || null;

async function listFor(label, client) {
  if (!client) { console.log(`\n${label}: (no key configured — skipped)`); return; }
  try {
    const res = await client.models.list();
    const ids = (res.data || res.body?.data || []).map(m => m.id).filter(Boolean).sort();
    console.log(`\n${label}: ${ids.length} models`);
    const chatish = ids.filter(id => /llama|nemotron|gpt|mistral|mixtral|qwen|gemma|phi/i.test(id));
    if (chatish.length) {
      console.log('  Likely chat models:');
      chatish.forEach(id => console.log(`    ${id}`));
    }
    console.log('  All model IDs:');
    ids.forEach(id => console.log(`    ${id}`));
  } catch (err) {
    console.error(`\n${label}: FAILED — ${err.status || ''} ${err.message}`);
    if (err.status === 401 || err.status === 403) {
      console.error('  → The key is invalid or lacks access (auth error).');
    }
  }
}

(async () => {
  console.log('Checking which models your keys can serve…');
  console.log(`NVIDIA base URL: ${NVIDIA_BASE}`);

  await listFor(
    'NVIDIA (AI_API_KEY)',
    NVIDIA_KEY ? new OpenAI({ apiKey: NVIDIA_KEY, baseURL: NVIDIA_BASE }) : null
  );
  await listFor(
    'OpenAI (OPENAI_API_KEY)',
    OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null
  );

  console.log('\nNext: copy the exact IDs you want into .env, e.g.');
  console.log('  NVIDIA_MODEL_NEMOTRON=<id>');
  console.log('  NVIDIA_MODEL_LARGE=<id>');
  console.log('  NVIDIA_MODEL_SMALL=<id>');
  process.exit(0);
})();
