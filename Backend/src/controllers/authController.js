// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../db/supabaseClient');
const authService = require('../services/authService');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '1d';
const PROFILE_OWNER_ID = process.env.PROFILE_OWNER_ID;
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Create JWT for admin
 */
function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

async function initAppData(req, res) {
  try {
    const user = req.user;
    const id = user?.id || PROFILE_OWNER_ID;
    const role = user?.role || 'guest';
    const email = user?.email || null;

    if (user && user.role !== 'guest') {
      const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
      if (token) {
        res.cookie('token', token, {
          httpOnly: true,
          sameSite: isProduction ? 'none' : 'lax',
          secure: isProduction,
          maxAge: 24 * 60 * 60 * 1000,
          path: '/'
        });
      }
    }

    await supabase
      .from('profiles')
      .select('themes, currenttheme')
      .eq('id', id)
      .maybeSingle();

    return res.status(200).json({ id, role, email });
  } catch (err) {
    console.error('initAppData error:', err);
    return res.status(500).json({ message: 'Unexpected error.' });
  }
}

/**
 * =========================
 * POST /api/auth/login
 * =========================
 * ADMIN ONLY
 */
async function loginUser(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password_hash, role, is_active')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: 'Account is disabled.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    const token = createToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    });

    return res.status(200).json({
      message: 'Admin login successful.',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Unexpected error during login.' });
  }
}

/**
 * =========================
 * POST /api/auth/forgot-password
 * =========================
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const result = await authService.forgotPassword(email);
    return res.status(200).json({ message: result.message });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(err.statusCode || 500).json({
      message: err.message || 'Unexpected error.'
    });
  }
}

/**
 * =========================
 * POST /api/auth/reset-password
 * =========================
 */
async function resetPassword(req, res) {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required.' });
    }

    const result = await authService.resetPassword(email, otp, newPassword);
    return res.status(200).json({ message: result.message });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(err.statusCode || 500).json({
      message: err.message || 'Unexpected error.'
    });
  }
}

async function updatePassword(req, res) {
  try {
    const { email, currentPassword, newPassword } = req.body;
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password_hash, email')
      .eq('email', email)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ message: 'Administrator record not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password verification failed.' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        updated_at: new Date()
      })
      .eq('email', email);

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({
      success: true,
      message: 'Credentials updated in secure storage.'
    });
  } catch (error) {
    console.error('Password Update Error:', error);
    res.status(500).json({ message: 'Internal server error during password update.' });
  }
}

async function logout(req, res) {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      path: '/'
    });

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ message: 'Logout failed' });
  }
}

module.exports = {
  loginUser,
  forgotPassword,
  resetPassword,
  updatePassword,
  logout,
  initAppData
};
