// services/chatService.js
const { supabase } = require('../config/database');
const { askAI } = require('./aiService');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { RATE_LIMIT, USER_ROLES } = require('../config/constants');
const { v4: uuidv4 } = require('uuid');

const PROFILE_OWNER_ID = process.env.PROFILE_OWNER_ID;

/**
 * Check guest chat limit (5 messages per 24 hours)
 * CRITICAL FIX: Now uses guestId instead of IP for better tracking
 */
async function checkGuestLimit(guestId) {
  try {
    const since = new Date();
    since.setHours(since.getHours() - RATE_LIMIT.GUEST_WINDOW_HOURS);

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('messages, role, guest_id, created_at')
      .eq('role', USER_ROLES.GUEST)
      .eq('guest_id', guestId)
      .gte('created_at', since.toISOString());

    if (error) {
      logger.error('Error checking guest limit:', error);
      return 0;
    }

    // Count user messages
    let count = 0;
    for (const session of data || []) {
      const msgs = session.messages || [];
      for (const msg of msgs) {
        if (msg.sender === 'user') {
          count++;
        }
      }
    }

    return count;
  } catch (error) {
    logger.error('checkGuestLimit error:', error);
    return 0;
  }
}

/**
 * Send chat message
 * CRITICAL FIX: Properly handles guest sessions with guestId
 */
async function sendChatMessage({ message, sessionId, userId, role, guestId, userIp }) {
  try {
    const isAdmin = role === USER_ROLES.ADMIN;

    // Check guest limit
    if (!isAdmin && guestId) {
      const count = await checkGuestLimit(guestId);
      if (count >= RATE_LIMIT.GUEST_CHAT_LIMIT) {
        return {
          limitReached: true,
          message: 'Limit reached. Please contact Rohit using contact section.',
          remainingQuestions: 0,
        };
      }
    }

    // Load existing session first so we can pass conversation history to AI
    let session = null;
    let conversationHistory = [];

    if (sessionId) {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (!error && data) {
        session = data;
        conversationHistory = data.messages || [];
      }
    }

    // Get AI response with full context
    const reply = await askAI(
      message,
      role,
      guestId,
      session?.id ?? sessionId ?? null,
      userId,
      !isAdmin,
      conversationHistory
    );

    // Create new session if needed
    if (!session) {
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          id: uuidv4(),
          title: message.slice(0, 50),
          model: 'gpt-4o-mini',
          role: isAdmin ? USER_ROLES.ADMIN : USER_ROLES.GUEST,
          is_guest: !isAdmin,
          user_id: userId || PROFILE_OWNER_ID,
          user_ip: userIp,
          guest_id: guestId || null,
          messages: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating session:', error);
        throw ApiError.internal('Failed to create chat session');
      }

      session = data;
      logger.info('New chat session created', {
        sessionId: session.id,
        role: isAdmin ? 'admin' : 'guest',
        guestId,
      });
    }

    // Append messages
    const messages = session.messages || [];
    messages.push({
      sender: 'user',
      text: message,
      time: new Date().toISOString(),
    });
    messages.push({
      sender: 'bot',
      text: reply,
      time: new Date().toISOString(),
    });

    // Update session
    const { error: updateError } = await supabase
      .from('chat_sessions')
      .update({
        messages,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    if (updateError) {
      logger.error('Error updating session:', updateError);
      throw ApiError.internal('Failed to update chat session');
    }

    // Calculate remaining questions for guests
    const remainingQuestions = isAdmin 
      ? -1 // Unlimited for admin
      : RATE_LIMIT.GUEST_CHAT_LIMIT - (await checkGuestLimit(guestId));

    logger.info('Chat message processed', {
      sessionId: session.id,
      role,
      remainingQuestions,
    });

    return {
      response: reply,
      sessionId: session.id,
      limitReached: false,
      remainingQuestions,
    };
  } catch (error) {
    logger.error('sendChatMessage error:', error);
    throw error;
  }
}

/**
 * Get chat sessions for user
 * Admin: See ALL sessions
 * Guest: See only their own sessions (by guestId)
 */
async function getChatSessions({ userId, role, guestId }) {
  try {
    let query = supabase
      .from('chat_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (role === USER_ROLES.ADMIN) {
      // Admin sees all sessions for this user_id
      query = query.eq('user_id', userId);
    } else {
      // Guest sees only their sessions
      query = query
        .eq('is_guest', true)
        .eq('guest_id', guestId)
        .eq('user_id', PROFILE_OWNER_ID);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching sessions:', error);
      return [];
    }

    logger.info('Chat sessions retrieved', {
      role,
      count: data?.length || 0,
    });

    return data || [];
  } catch (error) {
    logger.error('getChatSessions error:', error);
    return [];
  }
}

/**
 * Get single chat session
 */
async function getChatSession(sessionId, userId, role, guestId) {
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      throw ApiError.notFound('Chat session not found');
    }

    // Verify access
    if (role === USER_ROLES.GUEST) {
      if (data.guest_id !== guestId) {
        throw ApiError.forbidden('Access denied to this chat session');
      }
    }

    return data;
  } catch (error) {
    logger.error('getChatSession error:', error);
    throw error;
  }
}

/**
 * Delete chat session
 */
async function deleteChatSession(sessionId, userId, role, guestId) {
  try {
    // Verify access first
    const session = await getChatSession(sessionId, userId, role, guestId);

    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      logger.error('Error deleting session:', error);
      throw ApiError.internal('Failed to delete chat session');
    }

    logger.info('Chat session deleted', { sessionId });
    return { success: true };
  } catch (error) {
    logger.error('deleteChatSession error:', error);
    throw error;
  }
}

/**
 * Delete all sessions (Admin only)
 */
async function deleteAllSessions(userId) {
  try {
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('user_id', userId);

    if (error) {
      logger.error('Error deleting all sessions:', error);
      throw ApiError.internal('Failed to delete all sessions');
    }

    logger.info('All chat sessions deleted', { userId });
    return { success: true };
  } catch (error) {
    logger.error('deleteAllSessions error:', error);
    throw error;
  }
}

/**
 * Get admin chat statistics
 */
async function getAdminChatStats(userId) {
  try {
    // Get total sessions
    const { count: totalSessions } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get guest sessions
    const { count: guestSessions } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_guest', true);

    // Get admin sessions
    const { count: adminSessions } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_guest', false);

    // Get recent sessions
    const { data: recentSessions } = await supabase
      .from('chat_sessions')
      .select('id, title, role, created_at, messages')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate total messages
    let totalMessages = 0;
    if (recentSessions) {
      recentSessions.forEach(session => {
        totalMessages += (session.messages?.length || 0);
      });
    }

    return {
      totalSessions: totalSessions || 0,
      guestSessions: guestSessions || 0,
      adminSessions: adminSessions || 0,
      totalMessages,
      recentSessions: recentSessions || [],
    };
  } catch (error) {
    logger.error('getAdminChatStats error:', error);
    throw ApiError.internal('Failed to get chat statistics');
  }
}

module.exports = {
  checkGuestLimit,
  sendChatMessage,
  getChatSessions,
  getChatSession,
  deleteChatSession,
  deleteAllSessions,
  getAdminChatStats,
};
