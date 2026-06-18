#!/usr/bin/env node
/**
 * update-analysis.js
 *
 * Analysis agent runner — scans changed source files and asks Claude to
 * update code-analysis.md and PROJECT_OVERVIEW.md accordingly.
 *
 * Usage:
 *   node scripts/update-analysis.js              # analyse git-changed files
 *   node scripts/update-analysis.js --full       # full rescan of entire src/
 *   node scripts/update-analysis.js --file <f>   # analyse a specific file
 *
 * Called automatically by Claude Code's PostToolUse hook after each Edit/Write.
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const ANALYSIS_FILE = path.join(ROOT, 'code-analysis.md');
const OVERVIEW_FILE = path.join(ROOT, 'PROJECT_OVERVIEW.md');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', ...opts }).trim();
  } catch {
    return '';
  }
}

function claudeAvailable() {
  const r = spawnSync('claude', ['--version'], { shell: true });
  return r.status === 0;
}

function log(msg) {
  process.stdout.write(`[update-analysis] ${msg}\n`);
}

// ─── Collect changed files ─────────────────────────────────────────────────

function getChangedFiles(specificFile) {
  if (specificFile) return [specificFile];

  // Files changed but not yet committed (staged + unstaged)
  const staged = run('git diff --cached --name-only -- src/').split('\n').filter(Boolean);
  const unstaged = run('git diff --name-only -- src/').split('\n').filter(Boolean);
  const untracked = run('git ls-files --others --exclude-standard -- src/').split('\n').filter(Boolean);

  const all = [...new Set([...staged, ...unstaged, ...untracked])].filter(f =>
    /\.(ts|html|scss|css|json)$/.test(f) && !f.includes('spec.ts')
  );

  return all;
}

function getAllSrcFiles() {
  const out = run('git ls-files src/ -- "*.ts" "*.html" "*.scss"');
  return out.split('\n').filter(Boolean);
}

// ─── Build prompt ─────────────────────────────────────────────────────────────

function buildPrompt(files, mode) {
  const fileList = files.map(f => `- ${f}`).join('\n');
  const analysisContent = fs.existsSync(ANALYSIS_FILE)
    ? fs.readFileSync(ANALYSIS_FILE, 'utf8').slice(0, 8000) // first 8k chars as context
    : '(not yet created)';

  const overviewContent = fs.existsSync(OVERVIEW_FILE)
    ? fs.readFileSync(OVERVIEW_FILE, 'utf8').slice(0, 4000)
    : '(not yet created)';

  return `You are an automated code-analysis agent for this Angular 19 portfolio project.

## Task
${mode === 'full'
    ? 'Perform a FULL rescan of the codebase and completely rewrite both documentation files.'
    : `The following source files were recently changed:\n${fileList}\n\nAnalyse ONLY these changed files and produce targeted PATCH INSTRUCTIONS for the documentation files below.`
  }

## Current code-analysis.md (excerpt)
\`\`\`markdown
${analysisContent}
\`\`\`

## Current PROJECT_OVERVIEW.md (excerpt)
\`\`\`markdown
${overviewContent}
\`\`\`

## Instructions
1. Read the changed files listed above.
2. Identify what changed: new components, new services, new endpoints, renamed symbols, deleted code, config changes, etc.
3. Output ONLY the sections that need updating — prefix each section with the target file name and section heading.
4. Use this exact format for each change:

---FILE: code-analysis.md---
### <Section Heading>
<updated section content>

---FILE: PROJECT_OVERVIEW.md---
### <Section Heading>
<updated section content>

5. If nothing in the docs needs updating for these file changes, output: NO_CHANGES_NEEDED
6. Do NOT output anything else — no explanations, no preamble.
`;
}

// ─── Apply patches returned by Claude ────────────────────────────────────────

function applyPatches(claudeOutput) {
  if (claudeOutput.includes('NO_CHANGES_NEEDED')) {
    log('No documentation changes needed.');
    return;
  }

  const fileBlocks = claudeOutput.split(/^---FILE:\s*/m).filter(Boolean);

  for (const block of fileBlocks) {
    const firstNewline = block.indexOf('\n');
    const fileName = block.slice(0, firstNewline).replace(/---$/, '').trim();
    const content = block.slice(firstNewline + 1).trim();

    const targetFile = fileName.includes('code-analysis') ? ANALYSIS_FILE : OVERVIEW_FILE;

    if (!fs.existsSync(targetFile)) {
      log(`Target file not found: ${targetFile}`);
      continue;
    }

    // Extract section heading from patch content
    const headingMatch = content.match(/^#{1,4}\s+(.+)/m);
    if (!headingMatch) {
      log(`Could not find heading in patch for ${fileName}`);
      continue;
    }

    const heading = headingMatch[0]; // e.g. "## 5. Component Inventory"
    const existing = fs.readFileSync(targetFile, 'utf8');

    // Find the section in the existing file and replace it
    // Strategy: find the heading, then replace until the next same-level heading or EOF
    const level = heading.match(/^(#{1,4})/)[1].length;
    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sectionRegex = new RegExp(
      `(${escapedHeading}[\\s\\S]*?)(?=\\n#{1,${level}}\\s|$)`,
      'm'
    );

    if (sectionRegex.test(existing)) {
      const updated = existing.replace(sectionRegex, content + '\n');
      fs.writeFileSync(targetFile, updated, 'utf8');
      log(`Updated section "${heading}" in ${fileName}`);
    } else {
      // Section doesn't exist yet — append before the last horizontal rule or at end
      const insertionPoint = existing.lastIndexOf('\n---\n');
      if (insertionPoint !== -1) {
        const updated = existing.slice(0, insertionPoint) + '\n\n' + content + '\n' + existing.slice(insertionPoint);
        fs.writeFileSync(targetFile, updated, 'utf8');
      } else {
        fs.appendFileSync(targetFile, '\n\n' + content + '\n');
      }
      log(`Appended new section "${heading}" to ${fileName}`);
    }
  }
}

// ─── Update the "Last full scan" timestamp ────────────────────────────────────

function updateTimestamp(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  const updated = content.replace(
    /Last full scan: \d{4}-\d{2}-\d{2}/,
    `Last full scan: ${today}`
  );
  if (updated !== content) fs.writeFileSync(file, updated, 'utf8');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isFull = args.includes('--full');
  const fileIdx = args.indexOf('--file');
  const specificFile = fileIdx !== -1 ? args[fileIdx + 1] : null;

  log(`Mode: ${isFull ? 'full rescan' : specificFile ? `single file (${specificFile})` : 'changed files'}`);

  if (!claudeAvailable()) {
    log('ERROR: `claude` CLI not found. Install Claude Code to enable auto-updates.');
    log('       Skipping documentation update.');
    process.exit(0); // Don't fail the hook
  }

  const files = isFull ? getAllSrcFiles() : getChangedFiles(specificFile);

  if (files.length === 0 && !isFull) {
    log('No relevant source files changed. Skipping.');
    process.exit(0);
  }

  log(`Analysing ${files.length} file(s)...`);

  const prompt = buildPrompt(files, isFull ? 'full' : 'incremental');

  // Write prompt to a temp file to avoid shell quoting issues
  const tmpPrompt = path.join(ROOT, '.analysis-prompt.tmp');
  fs.writeFileSync(tmpPrompt, prompt, 'utf8');

  try {
    log('Calling Claude...');
    const result = run(`claude --print < "${tmpPrompt}"`, { timeout: 120000 });

    if (result) {
      applyPatches(result);
      updateTimestamp(ANALYSIS_FILE);
      updateTimestamp(OVERVIEW_FILE);
      log('Documentation updated successfully.');
    } else {
      log('Claude returned empty response. No changes applied.');
    }
  } catch (err) {
    log(`Claude invocation failed: ${err.message}`);
    log('Documentation update skipped.');
  } finally {
    if (fs.existsSync(tmpPrompt)) fs.unlinkSync(tmpPrompt);
  }
}

main().catch(err => {
  console.error('[update-analysis] Fatal error:', err);
  process.exit(0); // Never fail the hook — docs update is best-effort
});
