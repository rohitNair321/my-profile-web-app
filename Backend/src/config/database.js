// config/database.js
const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  logger.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

// Create Supabase client with enhanced configuration
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'X-Client-Info': 'portfolio-backend',
    },
  },
});

/**
 * Test database connection
 */
async function testConnection() {
  try {
    logger.info('🔍 Testing Supabase connection...');
    
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error) {
      logger.error('❌ Supabase connection error:', error.message);
      return false;
    }

    logger.info('✅ Supabase connected successfully');
    return true;
  } catch (err) {
    logger.error('🔥 Supabase network failure:', err.message);
    return false;
  }
}

module.exports = {
  supabase,
  testConnection,
};
