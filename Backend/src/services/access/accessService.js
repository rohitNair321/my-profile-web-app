'use strict';

const bcrypt = require('bcryptjs');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const { supabase } = require('../../db/supabaseClient');
const { createUserRepository } = require('./userRepository');
const { createMailService } = require('../mailService');
const { generatePassword } = require('./passwordGenerator');
const policy = require('./accessPolicy');
const { getPages, getGrantablePages } = require('./pageRegistry');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ASSIGNABLE_ROLES = [policy.ROLES.ADMIN, policy.ROLES.USER];
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

/**
 * Access & User-Provisioning service (orchestration / business logic).
 *
 * All collaborators are injected through the factory (Dependency Inversion),
 * so unit tests supply fakes and never touch a DB or SMTP. The default export
 * wires the real Supabase-backed repository and env-configured mailer.
 *
 * @param {object} deps
 * @param {object} deps.repository        user + access repository
 * @param {object} deps.mailService       transactional mailer
 * @param {Function} [deps.passwordGenerator] () => string
 * @param {Function} [deps.hashPassword]      (pw) => Promise<string>
 */
function createAccessService({
  repository,
  mailService,
  passwordGenerator = generatePassword,
  hashPassword = (pw) => bcrypt.hash(pw, BCRYPT_ROUNDS),
} = {}) {
  if (!repository) throw new Error('accessService requires a repository');
  if (!mailService) throw new Error('accessService requires a mailService');

  /** Keys the actor is allowed to delegate (super admin ⇒ everything). */
  async function actorGrantableKeys(actor) {
    if (actor.role === policy.ROLES.SUPER_ADMIN) return getPages().map((p) => p.key);
    return repository.getGrantedKeys(actor.id);
  }

  function assertGrantAllowed(actorRole, actorKeys, requestedKeys) {
    const { ok, invalidKeys } = policy.validateGrant(actorRole, actorKeys, requestedKeys);
    if (!ok) throw ApiError.badRequest(`Cannot grant page(s): ${invalidKeys.join(', ')}`);
  }

  return {
    /** Grantable pages for building the Access console grid. */
    listGrantablePages() {
      return getGrantablePages();
    },

    /** All users with their granted page keys (super-admin console). */
    async listUsers() {
      const users = await repository.listUsers();
      const access = await repository.getGrantedKeysForUsers(users.map((u) => u.id));
      return users.map((u) => ({ ...u, pages: access[u.id] ?? [] }));
    },

    /** The signed-in user's effective accessible page keys (drives the sidebar/guard). */
    async myAccess(user) {
      const grantedKeys = user.role === policy.ROLES.SUPER_ADMIN
        ? []
        : await repository.getGrantedKeys(user.id);
      return { role: user.role, pages: policy.accessibleKeys(user.role, grantedKeys) };
    },

    /**
     * Provision a new user: generate a temp password, persist, grant pages,
     * email the credentials, and return the temp password ONCE to the caller.
     * @returns {{ user: object, tempPassword: string }}
     */
    async provisionUser({ email, role = policy.ROLES.USER, pages = [], actor, loginUrl }) {
      const normEmail = String(email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(normEmail)) throw ApiError.badRequest('A valid email is required');
      if (!ASSIGNABLE_ROLES.includes(role)) {
        throw ApiError.badRequest(`role must be one of: ${ASSIGNABLE_ROLES.join(', ')}`);
      }

      const actorKeys = await actorGrantableKeys(actor);
      assertGrantAllowed(actor.role, actorKeys, pages);

      if (await repository.findByEmail(normEmail)) {
        throw ApiError.conflict('A user with this email already exists');
      }

      const tempPassword = passwordGenerator(16);
      const passwordHash = await hashPassword(tempPassword);
      const user = await repository.createUser({ email: normEmail, passwordHash, role });

      await repository.replaceGrants(user.id, pages, actor.id);

      try {
        await mailService.sendNewUserCredentials({ to: normEmail, tempPassword, loginUrl });
      } catch (err) {
        // The account already exists; surface the temp password to the super
        // admin regardless so provisioning isn't lost to a transient mail error.
        logger.error('Failed to email new-user credentials', { userId: user.id, error: err.message });
      }

      logger.info('User provisioned', { userId: user.id, role, by: actor.id }); // never logs tempPassword
      return { user: { ...user, pages }, tempPassword };
    },

    /** Replace a user's page grants (super-admin console). */
    async updateAccess({ userId, pages = [], actor }) {
      const actorKeys = await actorGrantableKeys(actor);
      assertGrantAllowed(actor.role, actorKeys, pages);
      await repository.getById(userId); // 404 if the user doesn't exist
      const granted = await repository.replaceGrants(userId, pages, actor.id);
      return { userId, pages: granted };
    },

    /** Enable / disable a user account. */
    async setUserActive({ userId, isActive }) {
      return repository.setActive(userId, !!isActive);
    },
  };
}

// Default singleton wired with real collaborators.
const defaultAccessService = createAccessService({
  repository: createUserRepository(supabase),
  mailService: createMailService(),
});

module.exports = { createAccessService, defaultAccessService };
