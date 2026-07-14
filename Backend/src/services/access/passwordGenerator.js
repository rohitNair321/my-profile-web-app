'use strict';

const crypto = require('crypto');

/**
 * Cryptographically-strong temporary-password generator.
 *
 * Single responsibility: produce a random password. Randomness comes from
 * `crypto` (never `Math.random`). Guarantees at least one character from each
 * class (lower / upper / digit / symbol) so it satisfies common policies, and
 * omits visually ambiguous characters (0/O, 1/l/I).
 */

const LOWER  = 'abcdefghijkmnpqrstuvwxyz'; // no l
const UPPER  = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O
const DIGIT  = '23456789';                 // no 0, 1
const SYMBOL = '!@#$%^&*-_=+';
const ALL    = LOWER + UPPER + DIGIT + SYMBOL;

const MIN_LENGTH = 12;

function pick(alphabet) {
  return alphabet[crypto.randomInt(alphabet.length)];
}

/** Fisher–Yates shuffle using crypto-strong randomness. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * @param {number} [length=16] desired length (clamped to a safe minimum).
 * @returns {string} a random password containing at least one of each class.
 */
function generatePassword(length = 16) {
  const len = Math.max(MIN_LENGTH, Number(length) || 16);
  const chars = [pick(LOWER), pick(UPPER), pick(DIGIT), pick(SYMBOL)];
  while (chars.length < len) chars.push(pick(ALL));
  return shuffle(chars).join('');
}

module.exports = { generatePassword, MIN_LENGTH };
