'use strict';

const cron = require('node-cron');
const { supabase } = require('../db/supabaseClient');
const logger = require('../config/logger');

// Runs every minute — promotes past-due scheduled posts to published.
function startScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      const nowIso = new Date().toISOString();

      const { data, error } = await supabase
        .from('posts')
        .update({
          status:       'published',
          published_at: nowIso,
          scheduled_at: null,
        })
        .eq('status', 'scheduled')
        .lte('scheduled_at', nowIso)
        .select('id, title');

      if (error) {
        logger.warn('Scheduler: failed to promote scheduled posts:', error.message);
        return;
      }

      if (data && data.length > 0) {
        logger.info(`Scheduler: promoted ${data.length} post(s) to published:`, data.map(p => p.title));
      }
    } catch (err) {
      logger.warn('Scheduler: unexpected error during post promotion:', err.message);
    }
  });

  logger.info('⏰ Post scheduler started — checking every minute for due posts');
}

module.exports = { startScheduler };
