// utils/sanitize.js
// Install: npm install sanitize-html  (already done)

const sanitizeHtmlLib = require('sanitize-html');

/**
 * Sanitise untrusted HTML from the rich text editor.
 * Strips script tags, event handlers, and dangerous attributes.
 * Preserves colours, bold, italic, code blocks, and links.
 */
const sanitize = (dirty = '') =>
  sanitizeHtmlLib(dirty, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'u', 's',
      'h1', 'h2', 'h3', 'h4',
      'ul', 'ol', 'li',
      'blockquote', 'code', 'pre',
      'a', 'img', 'span', 'div',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'hr',
    ],
    allowedAttributes: {
      'a':    ['href', 'target', 'rel'],
      'img':  ['src', 'alt', 'width', 'height'],
      'span': ['style', 'class'],
      'div':  ['style', 'class'],
      'p':    ['style', 'class'],
      'td':   ['style'],
      'th':   ['style'],
      'code': ['class'],
      'pre':  ['class'],
    },
    allowedStyles: {
      '*': {
        'color':           [/.*/],
        'background-color': [/.*/],
        'font-weight':     [/.*/],
        'font-style':      [/.*/],
        'text-decoration': [/.*/],
        'text-align':      [/.*/],
      },
    },
    // Explicit scheme whitelist — keeps data: URIs (base64 images) out of the DB
    // and javascript: out of links, even if library defaults ever change.
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
  });

module.exports = { sanitizeHtml: sanitize };
