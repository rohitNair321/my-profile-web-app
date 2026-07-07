/**
 * Split a single entry OR a pasted bundle ("Angular, TypeScript; RxJS") into
 * individual trimmed tokens. Splits on commas, semicolons, and newlines.
 * Used for skills and tag inputs so pasting a list adds each item separately.
 */
export function splitTokens(input: string): string[] {
  return (input || '')
    .split(/[,;\n]/)
    .map(t => t.trim())
    .filter(Boolean);
}

/**
 * Merge new tokens into an existing list — case-insensitive de-dupe,
 * optional max count and per-token length cap. Returns { list, skipped }.
 */
export function mergeTokens(
  existing: string[],
  incoming: string[],
  opts: { max?: number; maxLen?: number } = {},
): { list: string[]; skipped: number } {
  const { max = Infinity, maxLen = Infinity } = opts;
  const list = [...existing];
  const seen = new Set(list.map(t => t.toLowerCase()));
  let skipped = 0;

  for (const tok of incoming) {
    if (seen.has(tok.toLowerCase())) continue;
    if (tok.length > maxLen || list.length >= max) { skipped++; continue; }
    list.push(tok);
    seen.add(tok.toLowerCase());
  }
  return { list, skipped };
}
