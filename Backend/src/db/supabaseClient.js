// Re-exports the single Supabase client from config/database.js.
// All code should import from here or from config/database directly — never create a second client.
const { supabase } = require('../config/database');

module.exports = { supabase };
