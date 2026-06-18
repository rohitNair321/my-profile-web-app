const express = require("express");
const router = express.Router();
const { supabase } = require('../db/supabaseClient');
const { askAI } = require("../services/aiService");
const { checkGuestLimit } = require("../helper/limite");
const e = require("express");
const { v4: uuid } = require("uuid");
const PROFILE_OWNER_ID = process.env.PROFILE_OWNER_ID;

const PRICING = {
  'o4-mini':          { input: 0.003,  output: 0.012  },
  'gpt-4o':           { input: 0.005,  output: 0.015  },
  'gpt-4o-mini':      { input: 0.00015,output: 0.0006 },
  'gpt-4-turbo':      { input: 0.01,   output: 0.03   },
  'gpt-3.5-turbo':    { input: 0.0005, output: 0.0015 },
};
 
const DEFAULT_PRICING = { input: 0.003, output: 0.012 };

async function chat(req, res) {
  try {

    const { message, sessionId, userId, role } = req.body;

    const ip =
      req.headers["x-forwarded-for"] ||
      req.socket.remoteAddress;

    const guestId = req.cookies?.guestId || ip;

    if (!guestId) {

      guestId = uuid();

      res.cookie("guestId", guestId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000
      });

    }

    const isAdmin = role === "ADMIN";
    const isGuest = isAdmin ? false : true;

    if (!isAdmin) {

      const count = await checkGuestLimit(guestId);

      if (count >= 5) {

        return res.json({
          limitReached: true,
          message:
            "Limit reached. Please contact Rohit using contact section."
        });

      }

    }

    const reply = await askAI(message, role, guestId, sessionId, userId, isGuest);

    let session = null;

    // -------------------------
    // 1. If session exists
    // -------------------------

    if (sessionId) {

      const { data } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      session = data;

    }

    // -------------------------
    // 2. If no session → create
    // -------------------------

    if (!session) {

      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({
          title: message.slice(0, 30),
          model: "o4-mini",
          role: isAdmin ? "admin" : "guest",
          is_guest: isAdmin ? false : true,
          user_id: userId,
          user_ip: ip,
          guest_id: guestId,
          messages: []
        })
        .select()
        .single();

      if (error) throw error;

      session = data;

    }

    // -------------------------
    // 3. append messages
    // -------------------------

    const messages = session.messages || [];

    messages.push({
      sender: "user",
      text: message,
      time: new Date()
    });

    messages.push({
      sender: "bot",
      text: reply,
      time: new Date()
    });

    // -------------------------
    // 4. update session
    // -------------------------

    await supabase
      .from("chat_sessions")
      .update({
        messages,
        updated_at: new Date()
      })
      .eq("id", session.id);

    res.json({
      response: reply,
      sessionId: session.id
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "AI error"
    });

  }

}

async function createSession(req, res) {
  try {

    const { title, model, userId } = req.body;

    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        title,
        model,
        user_id: userId
      })
      .select()
      .single();

    if (error) throw error;

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json(err.message);
  }
}

async function saveMessage(req, res) {
  try {

    const { sessionId, sender, message, userId } = req.body;

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        sender,
        message,
        user_id: userId
      })
      .select();

    if (error) throw error;

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json(err.message);
  }
}

async function aiUsage(req, res) {
  try {
    const range = req.query.range || '7d';
    const startDate = getStartDate(range);

    // ── 1. Pull raw rows from Supabase ────────────────────────
    let query = supabase
      .from('ai_usage')
      .select('created_at, model, input_tokens, output_tokens, total_tokens, session_id, role, is_guest')
      .order('created_at', { ascending: true });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch usage data' });
    }

    if (!rows || rows.length === 0) {
      return res.json({
        summary: { totalTokens: 0, inputTokens: 0, outputTokens: 0, totalCost: 0 },
        trend: [],
        byModel: [],
        byRole: { admin: zeroBlock(), guest: zeroBlock() },
        sessions: [],
        allTime: zeroBlock(),
      });
    }

    // ── 2. Aggregate summary ──────────────────────────────────
    let totalInput = 0, totalOutput = 0, totalAll = 0, totalCost = 0;

    rows.forEach(r => {
      totalInput += r.input_tokens ?? 0;
      totalOutput += r.output_tokens ?? 0;
      totalAll += r.total_tokens ?? 0;
      totalCost += calcCost(r.input_tokens, r.output_tokens, r.model);
    });

    const summary = {
      totalTokens: totalAll,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      totalCost: parseFloat(totalCost.toFixed(6)),
    };

    // ── 3. Trend — group by calendar date ────────────────────
    const dateMap = {};
    rows.forEach(r => {
      const day = r.created_at.slice(0, 10);   // 'YYYY-MM-DD'
      if (!dateMap[day]) {
        dateMap[day] = { date: day, tokens: 0, inputTokens: 0, outputTokens: 0, cost: 0, requests: 0 };
      }
      dateMap[day].tokens += r.total_tokens ?? 0;
      dateMap[day].inputTokens += r.input_tokens ?? 0;
      dateMap[day].outputTokens += r.output_tokens ?? 0;
      dateMap[day].cost += calcCost(r.input_tokens, r.output_tokens, r.model);
      dateMap[day].requests += 1;
    });

    const trend = Object.values(dateMap).map(d => ({
      ...d,
      cost: parseFloat(d.cost.toFixed(6)),
    }));

    // ── 4. By model breakdown ─────────────────────────────────
    const modelMap = {};
    rows.forEach(r => {
      const m = r.model ?? 'unknown';
      if (!modelMap[m]) {
        modelMap[m] = { model: m, totalTokens: 0, inputTokens: 0, outputTokens: 0, cost: 0, requests: 0 };
      }
      modelMap[m].totalTokens += r.total_tokens ?? 0;
      modelMap[m].inputTokens += r.input_tokens ?? 0;
      modelMap[m].outputTokens += r.output_tokens ?? 0;
      modelMap[m].cost += calcCost(r.input_tokens, r.output_tokens, r.model);
      modelMap[m].requests += 1;
    });

    const byModel = Object.values(modelMap)
      .map(m => ({ ...m, cost: parseFloat(m.cost.toFixed(6)) }))
      .sort((a, b) => b.totalTokens - a.totalTokens);

    // ── 5. By role (admin vs guest) ───────────────────────────
    const byRole = { admin: zeroBlock(), guest: zeroBlock() };
    rows.forEach(r => {
      const key = r.is_guest ? 'guest' : 'admin';
      byRole[key].totalTokens += r.total_tokens ?? 0;
      byRole[key].inputTokens += r.input_tokens ?? 0;
      byRole[key].outputTokens += r.output_tokens ?? 0;
      byRole[key].cost += calcCost(r.input_tokens, r.output_tokens, r.model);
      byRole[key].requests += 1;
    });
    byRole.admin.cost = parseFloat(byRole.admin.cost.toFixed(6));
    byRole.guest.cost = parseFloat(byRole.guest.cost.toFixed(6));

    // ── 6. Per-session summary (top 20 most expensive) ────────
    const sessionMap = {};
    rows.forEach(r => {
      const sid = r.session_id ?? 'no-session';
      if (!sessionMap[sid]) {
        sessionMap[sid] = {
          sessionId: sid,
          date: r.created_at.slice(0, 10),
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          requests: 0,
          model: r.model,
        };
      }
      sessionMap[sid].totalTokens += r.total_tokens ?? 0;
      sessionMap[sid].inputTokens += r.input_tokens ?? 0;
      sessionMap[sid].outputTokens += r.output_tokens ?? 0;
      sessionMap[sid].cost += calcCost(r.input_tokens, r.output_tokens, r.model);
      sessionMap[sid].requests += 1;
    });

    const sessions = Object.values(sessionMap)
      .map(s => ({ ...s, cost: parseFloat(s.cost.toFixed(6)) }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 20);

    // ── 7. All-time totals (always full table, ignores range) ─
    const { data: allRows } = await supabase
      .from('ai_usage')
      .select('input_tokens, output_tokens, total_tokens, model');

    let atInput = 0, atOutput = 0, atAll = 0, atCost = 0, atReqs = 0;
    (allRows ?? []).forEach(r => {
      atInput += r.input_tokens ?? 0;
      atOutput += r.output_tokens ?? 0;
      atAll += r.total_tokens ?? 0;
      atCost += calcCost(r.input_tokens, r.output_tokens, r.model);
      atReqs += 1;
    });

    const allTime = {
      totalTokens: atAll,
      inputTokens: atInput,
      outputTokens: atOutput,
      totalRequests: atReqs,
      totalCost: parseFloat(atCost.toFixed(6)),
    };

    return res.json({ summary, trend, byModel, byRole, sessions, allTime });

  } catch (err) {
    console.error('Usage route error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function balance(req, res) {
  try {
    // OpenAI exposes subscription/credit info at this endpoint.
    // Requires the same API key with org-level read permissions.
    const response = await fetch(
      'https://api.openai.com/v1/organization/usage/costs',
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      // Fallback: calculate total cost from our own Supabase data
      // so the frontend always gets something useful.
      const { data: allRows } = await supabase
        .from('ai_usage')
        .select('input_tokens, output_tokens, model');

      let totalSpent = 0;
      (allRows ?? []).forEach(r => {
        totalSpent += calcCost(r.input_tokens, r.output_tokens, r.model);
      });

      return res.json({
        source: 'supabase',   // tells frontend the data is estimated
        totalUsedUSD: parseFloat(totalSpent.toFixed(6)),
        hardLimitUSD: null,
        remainingUSD: null,
        remainingPct: null,
      });
    }

    const data = await response.json();

    // OpenAI cost API response shape (as of 2025):
    // { object: 'list', data: [{ amount: { value, currency }, ... }] }
    const totalUsed = (data.data ?? []).reduce(
      (sum, item) => sum + (item.amount?.value ?? 0), 0
    );

    return res.json({
      source: 'openai',
      totalUsedUSD: parseFloat(totalUsed.toFixed(6)),
      hardLimitUSD: null,    // OpenAI removed hard limits in 2024; use spend limits instead
      remainingUSD: null,
      remainingPct: null,
    });

  } catch (err) {
    console.error('Balance route error:', err);
    return res.status(500).json({ error: 'Failed to fetch balance' });
  }
}

// ── Zero block helper ─────────────────────────────────────────
function zeroBlock() {
  return { totalTokens: 0, inputTokens: 0, outputTokens: 0, cost: 0, requests: 0 };
}

function calcCost(inputTokens = 0, outputTokens = 0, model = 'o4-mini') {
  const rate = PRICING[model] ?? DEFAULT_PRICING;
  return (inputTokens / 1000) * rate.input
    + (outputTokens / 1000) * rate.output;
}

// ── Helper: date range filter ─────────────────────────────────
function getStartDate(range) {
  if (range === 'all') { return null; }
  const days = range === '90d' ? 90 : range === '30d' ? 30 : 7;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}


async function getSession(req, res) {
  try {

    const id = req.params.id;

    if (!id) {
      return res.json([]);
    }

    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return res.json(null);

    res.json(data);

  } catch (err) {
    console.error(err);
    return res.json([]);
  }

}

async function getSessions(req, res) {
  try {
    const userId = PROFILE_OWNER_ID;

    const role = req.user?.role || "guest";

    const ip =
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "unknown";

    const guestId = req.cookies?.guestId || ip;
    let query = supabase
      .from("chat_sessions")
      .select("*")
      .order("created_at", { ascending: false });

    if (role === "admin") {
      query = query.eq("user_id", userId);
      // no filter
    } else if (role === "guest") {
      query = query
        .eq("is_guest", true)
        .eq("guest_id", guestId)
        .eq("user_id", userId);
    }

    const { data, error } = await query;


    if (error) return res.json([]);

    res.json(data || []);

  } catch (err) {

    console.error(err);

    return res.json([]);

  }
}

async function deleteSession(req, res) {

  const id = req.params.id;

  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json(error);

  res.json({ success: true });
}

async function deleteAllSessions(req, res) {
  const isAdmin = req.user?.role === "admin";

  if (!isAdmin) {
    return res.status(403).json({
      message: "Admin only"
    });
  }

  await supabase
    .from("chat_sessions")
    .delete()
    .not("id", "is", null);

  res.json({ success: true });
}

module.exports = { chat, createSession, saveMessage, getSession, getSessions, deleteSession, deleteAllSessions, aiUsage, balance };