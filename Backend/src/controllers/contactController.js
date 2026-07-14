const { supabase } = require('../db/supabaseClient');
const axios = require('axios');
const validator = require('validator');
const aiService = require('../services/aiService');
const { resolveOwnerId } = require('../services/tenancy/ownerContext');

//#region Submit Contact Form
async function submitContactForm(req, res) {

  let { firstName, lastName, email, message } = req.body;
  try {

    // Validate and Sanitize specifically
    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: 'Invalid email address.' });
    }

    // Escape special characters (< becomes &lt;)
    firstName = validator.escape(firstName);
    lastName = validator.escape(lastName);
    email = validator.escape(email);
    message = validator.escape(message);

    if (!firstName || !email || !message) {
      return res.status(400).json({ message: 'Missing fields.' });
    }

    // Route the message to the portfolio owner it was submitted from
    // (?owner=/body.owner for a /u/:id form), else the primary owner.
    const ownerId = resolveOwnerId({ user: req.user, requestedOwner: req.body?.owner || req.query?.owner });

    const { error: dbError } = await supabase
      .from('contact_messages')
      .insert([{
        profile_id: ownerId,
        first_name: firstName, last_name: lastName, email, message,
        ip_address: req.headers['x-forwarded-for']?.split(',')[0] || req.ip,
        user_agent: req.headers['user-agent']
      }]);

    if (dbError) {
      console.error('Email sent but DB insert failed:', dbError);
    }

    // 3. Fast2SMS Integration (Indian SMS Service)
    if (process.env.ENABLE_SMS === 'true') {
      const smsText = `New Message from ${firstName}: ${message.substring(0, 50)}`;

      const options = {
        method: 'POST',
        url: 'https://www.fast2sms.com/dev/bulkV2',
        headers: {
          'authorization': process.env.FAST2SMS_API_KEY,
          'Content-Type': 'application/json'
        },
        data: {
          "route": "q", // 'q' for Quick SMS
          "message": smsText,
          "language": "english",
          "flash": 0,
          "numbers": process.env.MY_MOBILE_NUMBER,
        }
      };

      await axios(options);
    }

    return res.status(200).json({ message: 'Message sent successfully.' });

  } catch (error) {
    console.error('Contact Error:', error.response?.data || error);
    return res.status(500).json({ message: 'Error processing contact request.' });
  }
}
//#endregion

//#region Get Notifications 
async function getNotifications(req, res) {
  try {
    const ownerId = resolveOwnerId({ user: req.user });
    const response = await fetchFormattedNotifications(ownerId);
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
// #endregion

//#region Mark Notification as Read
async function markAsRead(req, res) {
  const { id } = req.params;
  const ownerId = resolveOwnerId({ user: req.user });

  try {
    // Update the message — scoped to this admin's own inbox
    const { error: updateError } = await supabase
      .from('contact_messages')
      .update({ is_read: true })
      .eq('id', id)
      .eq('profile_id', ownerId);

    if (updateError) throw updateError;

    const updatedData = await fetchFormattedNotifications(ownerId);
    return res.status(200).json(updatedData);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
// #endregion

//#region Helper to fetch and format notifications (scoped to one owner)
async function fetchFormattedNotifications(ownerId) {
  const { data, error } = await supabase
    .from('contact_messages')
    .select('*')
    .eq('profile_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return {
    success: true,
    notificationList: data,
    unreadCount: data.filter(m => !m.is_read).length
  };
}
// #endregion

// #region Delete Contact Message
async function deleteContactMessage(req, res) {
  const { id } = req.params;
  const ownerId = resolveOwnerId({ user: req.user });

  try {
    const { error } = await supabase
      .from('contact_messages')
      .delete()
      .eq('id', id)
      .eq('profile_id', ownerId);

    if (error) throw error;

    const updatedData = await fetchFormattedNotifications(ownerId);
    return res.status(200).json(updatedData);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
// #endregion

//#region AI reply draft (admin)
async function aiReplyDraft(req, res) {
  try {
    const { name, email, subject, message, tone } = req.body || {};
    const ownerId = resolveOwnerId({ user: req.user }); // admin's own persona
    const { result } = await aiService.generateContactReply({ name, email, subject, message, tone, ownerId });
    return res.status(200).json({ success: true, reply: result });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || 'Failed to draft reply' });
  }
}
// #endregion

//#region AI compose message (public contact form "help me write")
async function aiComposeMessage(req, res) {
  try {
    const { name, subject } = req.body || {};
    // The visitor is contacting a specific portfolio owner (?owner= on /u/:id).
    const ownerId = resolveOwnerId({ user: req.user, requestedOwner: req.body?.owner || req.query?.owner });
    const { result } = await aiService.composeContactMessage({ name, subject, ownerId });
    return res.status(200).json({ success: true, message: result });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || 'Failed to draft message' });
  }
}
// #endregion

module.exports = { submitContactForm, getNotifications, markAsRead, deleteContactMessage, aiReplyDraft, aiComposeMessage };