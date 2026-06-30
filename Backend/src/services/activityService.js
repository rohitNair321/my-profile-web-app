// services/activityService.js
const { supabase } = require('../config/database');
const logger = require('../config/logger');

/**
 * Fire-and-forget activity log insert.
 * Never throws — safe to call from any controller without try/catch.
 *
 * @param {object} opts
 * @param {string}  opts.userId
 * @param {string}  opts.eventType   - 'login' | 'field_update' | 'resume_uploaded' | 'resume_deleted' | etc.
 * @param {string}  [opts.entity]    - 'profile' | 'auth' | 'post' | etc.
 * @param {string}  [opts.fieldName] - DB column name that changed
 * @param {*}       [opts.oldValue]  - previous value (will be stringified)
 * @param {*}       [opts.newValue]  - new value (will be stringified)
 * @param {object}  [opts.meta]      - free-form JSONB (browser, ip, post_id, …)
 */
function logActivity({ userId, eventType, entity = null, fieldName = null, oldValue = null, newValue = null, meta = null }) {
  const stringify = (v) => {
    if (v == null) return null;
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  supabase
    .from('activity_log')
    .insert({
      user_id: userId ?? null,
      event_type: eventType,
      entity,
      field_name: fieldName,
      old_value: stringify(oldValue),
      new_value: stringify(newValue),
      meta,
    })
    .then(({ error }) => {
      if (error) logger.warn('activity_log insert failed', { error: error.message, eventType, entity, fieldName });
    });
}

module.exports = { logActivity };
