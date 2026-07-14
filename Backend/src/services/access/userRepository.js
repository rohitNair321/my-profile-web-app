'use strict';

const ApiError = require('../../utils/ApiError');

/**
 * User & page-access data access.
 *
 * The ONLY place that knows table/column names for this domain. The Supabase
 * client is injected via the factory (Dependency Inversion) so the service
 * layer stays persistence-agnostic and unit tests pass a fake client.
 *
 * @param {object} supabase a Supabase client (or a compatible fake in tests)
 */
function createUserRepository(supabase) {
  const USERS  = 'users';
  const ACCESS = 'user_page_access';

  return {
    async findByEmail(email) {
      const { data, error } = await supabase
        .from(USERS)
        .select('id, email, role, is_active')
        .eq('email', email)
        .maybeSingle();
      if (error) throw ApiError.internal('Failed to look up user');
      return data || null;
    },

    async getById(userId) {
      const { data, error } = await supabase
        .from(USERS)
        .select('id, email, role, is_active')
        .eq('id', userId)
        .single();
      if (error || !data) throw ApiError.notFound('User not found');
      return data;
    },

    async createUser({ email, name, passwordHash, role }) {
      const { data, error } = await supabase
        .from(USERS)
        .insert({
          email,
          name: name ?? email,
          password_hash: passwordHash,
          role,
          is_active: true,
          must_change_password: true,
        })
        .select('id, email, role, is_active, created_at')
        .single();
      if (error) throw ApiError.internal('Failed to create user: ' + error.message);
      return data;
    },

    async listUsers() {
      const { data, error } = await supabase
        .from(USERS)
        .select('id, email, role, is_active, last_login, created_at, app_config')
        .order('created_at', { ascending: true });
      if (error) throw ApiError.internal('Failed to list users');
      return data ?? [];
    },

    async setAppConfig(userId, appConfig) {
      const { data, error } = await supabase
        .from(USERS)
        .update({ app_config: appConfig })
        .eq('id', userId)
        .select('id, app_config')
        .single();
      if (error || !data) throw ApiError.notFound('User not found');
      return data;
    },

    async getGrantedKeys(userId) {
      const { data, error } = await supabase
        .from(ACCESS)
        .select('page_key')
        .eq('user_id', userId);
      if (error) throw ApiError.internal('Failed to load page access');
      return (data ?? []).map((r) => r.page_key);
    },

    async getGrantedKeysForUsers(userIds) {
      if (userIds.length === 0) return {};
      const { data, error } = await supabase
        .from(ACCESS)
        .select('user_id, page_key')
        .in('user_id', userIds);
      if (error) throw ApiError.internal('Failed to load page access');
      const byUser = {};
      for (const r of data ?? []) (byUser[r.user_id] ??= []).push(r.page_key);
      return byUser;
    },

    /** Replace the full grant set for a user (delete-then-insert). */
    async replaceGrants(userId, pageKeys, grantedBy) {
      const { error: delErr } = await supabase.from(ACCESS).delete().eq('user_id', userId);
      if (delErr) throw ApiError.internal('Failed to reset page access');
      if (pageKeys.length === 0) return [];

      const rows = pageKeys.map((page_key) => ({
        user_id: userId,
        page_key,
        granted_by: grantedBy ?? null,
      }));
      const { data, error } = await supabase.from(ACCESS).insert(rows).select('page_key');
      if (error) throw ApiError.internal('Failed to set page access');
      return (data ?? []).map((r) => r.page_key);
    },

    async setActive(userId, isActive) {
      const { data, error } = await supabase
        .from(USERS)
        .update({ is_active: isActive })
        .eq('id', userId)
        .select('id, email, role, is_active')
        .single();
      if (error || !data) throw ApiError.notFound('User not found');
      return data;
    },
  };
}

module.exports = { createUserRepository };
