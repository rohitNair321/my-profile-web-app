const { supabase } = require('../db/supabaseClient');
const axios = require('axios');
const validator = require('validator');

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

    const { error: dbError } = await supabase
      .from('contact_messages')
      .insert([{
        profile_id: process.env.PROFILE_OWNER_ID,
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
    const response = await fetchFormattedNotifications();
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
// #endregion

//#region Mark Notification as Read
async function markAsRead(req, res) {
  const { id } = req.params;

  try {
    // 1. Update the specific message
    const { error: updateError } = await supabase
      .from('contact_messages')
      .update({ is_read: true })
      .eq('id', id);

    if (updateError) throw updateError;

    // 2. Fetch the updated list using the helper
    const updatedData = await fetchFormattedNotifications();

    // 3. Return the full updated state
    return res.status(200).json(updatedData);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
// #endregion

//#region Helper to fetch and format notifications
async function fetchFormattedNotifications() {
  const { data, error } = await supabase
    .from('contact_messages')
    .select('*')
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

  try {
    const { error } = await supabase
      .from('contact_messages')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // 2. Fetch the updated list using the helper
    const updatedData = await fetchFormattedNotifications();

    // 3. Return the full updated state
    return res.status(200).json(updatedData);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
// #endregion

module.exports = { submitContactForm, getNotifications, markAsRead, deleteContactMessage };