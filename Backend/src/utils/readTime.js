// utils/readTime.js

/**
 * Estimate read time in minutes (200 wpm).
 * Strips HTML tags before counting words.
 * @param {string} content - HTML or plain text content
 * @returns {number} - minimum 1 minute
 */
const calculateReadTime = (content = '') => {
  const text = content.replace(/<[^>]*>/g, '');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
};

module.exports = { calculateReadTime };
