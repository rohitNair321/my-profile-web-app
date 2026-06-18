const { supabase } = require('../db/supabaseClient');

async function checkGuestLimit(ip) {

  const since = new Date();
  since.setHours(since.getHours() - 24);

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("messages, role, user_ip, created_at")
    .eq("role", "guest")
    .eq("user_ip", ip)
    .gte("created_at", since.toISOString());

  if (error) {
    console.error(error);
    return 0;
  }

  let count = 0;

  for (const s of data) {

    const msgs = s.messages || [];

    for (const m of msgs) {
      if (m.sender === "user") {
        count++;
      }
    }

  }

  return count;
}


module.exports = {checkGuestLimit};