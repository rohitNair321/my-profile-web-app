'use strict';

const nodemailer = require('nodemailer');
const logger = require('../config/logger');

/**
 * Transactional email service.
 *
 * The transporter is injected (Dependency Inversion): production builds one
 * from SMTP_* env, tests pass a fake. When SMTP is not configured we fall back
 * to a no-op transport that logs metadata — dev stays unblocked and we never
 * hard-fail a request just because mail is unconfigured.
 */
function buildEnvTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    logger.warn('SMTP not configured — emails will be logged, not sent.');
    return {
      sendMail: async (msg) => {
        logger.warn('[MAIL:NOOP] would send', { to: msg.to, subject: msg.subject });
        return { messageId: 'noop' };
      },
    };
  }

  const port = Number(SMTP_PORT) || 587;
  // Gmail shows App Passwords grouped as "abcd efgh ijkl mnop" — strip whitespace
  // so a pasted-with-spaces app password still authenticates.
  const pass = String(SMTP_PASS).replace(/\s+/g, '');

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    // Port 465 uses implicit TLS; 587 uses STARTTLS. Allow an explicit override.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: { user: SMTP_USER.trim(), pass },
  });
}

/**
 * @param {object} [deps]
 * @param {{ sendMail: Function }} [deps.transporter] injectable transport
 * @param {string} [deps.from] From header
 */
function createMailService({ transporter, from } = {}) {
  const tx = transporter || buildEnvTransport();
  const sender = from || process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@localhost';

  return {
    /**
     * Email a newly-provisioned user their temporary password.
     * SECURITY: the temp password is emailed but NEVER logged.
     */
    async sendNewUserCredentials({ to, tempPassword, loginUrl }) {
      const url = loginUrl
        || (process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/#/auth/login` : '');

      const subject = 'Your account access';
      const text = [
        'An account has been created for you.',
        '',
        `Email: ${to}`,
        `Temporary password: ${tempPassword}`,
        '',
        url ? `Sign in: ${url}` : '',
        'You will be asked to set a new password on first sign-in.',
      ].filter(Boolean).join('\n');

      await tx.sendMail({ from: sender, to, subject, text });
    },
  };
}

module.exports = { createMailService, buildEnvTransport };
