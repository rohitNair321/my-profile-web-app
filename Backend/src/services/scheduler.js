'use strict';

const cron = require('node-cron');
const { supabase } = require('../db/supabaseClient');
const logger = require('../config/logger');
const sseManager = require('../api/v1/posts/sse-manager');

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
        .select('id, title, slug');

      if (error) {
        logger.warn('Scheduler: failed to promote scheduled posts:', error.message);
        // Log failure event so admin dashboard can surface it
        await supabase.from('activity_log').insert({
          event_type: 'scheduled_post_failed',
          entity:     'post',
          meta:       { error: error.message, timestamp: nowIso },
        });
        return;
      }

      if (data && data.length > 0) {
        logger.info(`Scheduler: promoted ${data.length} post(s) to published:`, data.map(p => p.title));
        // Log success event per published post
        const events = data.map(p => ({
          event_type: 'scheduled_post_published',
          entity:     'post',
          meta:       { post_id: p.id, title: p.title, slug: p.slug, timestamp: nowIso },
        }));
        await supabase.from('activity_log').insert(events);

        // Push real-time notification to connected admin clients
        for (const p of data) {
          sseManager.broadcast('post_published', {
            post_id:   p.id,
            title:     p.title,
            slug:      p.slug,
            timestamp: nowIso,
          });
        }
      }
    } catch (err) {
      logger.warn('Scheduler: unexpected error during post promotion:', err.message);
    }
  });

  logger.info('⏰ Post scheduler started — checking every minute for due posts');
}

// Runs at midnight on the 1st of every ~25th day (day 1 and 26 of each month).
// Purges ALL activity logs to keep the table lean.
function startActivityLogPurge() {
  // "0 0 1,26 * *" = midnight on the 1st and 26th of each month (≈25-day cycle)
  cron.schedule('0 0 1,26 * *', async () => {
    try {
      const { error } = await supabase
        .from('activity_log')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        logger.warn('Activity purge: failed to clear logs:', error.message);
      } else {
        logger.info('Activity purge: all activity logs cleared (25-day cycle)');
      }
    } catch (err) {
      logger.warn('Activity purge: unexpected error:', err.message);
    }
  });

  logger.info('🧹 Activity log purge scheduled — runs on the 1st and 26th of each month');
}

module.exports = { startScheduler, startActivityLogPurge };
