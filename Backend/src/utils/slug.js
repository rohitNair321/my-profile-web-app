// utils/slug.js

/**
 * Generate a URL-friendly slug from a title.
 * Strips special chars, lowercases, collapses spaces/hyphens, max 80 chars.
 */
const generateSlug = (title = '') =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    .replace(/-$/, ''); // trim trailing hyphen

module.exports = { generateSlug };
