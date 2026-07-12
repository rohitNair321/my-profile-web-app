// middleware/authVerify.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
const PROFILE_OWNER_ID = process.env.PROFILE_OWNER_ID;

/**
 * STRICT Verification (Admin Routes)
 */
function verifyToken(req, res, next) {
  let token = req.cookies?.token;

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Authorization token required" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

/**
 * ADMIN middleware — a super admin is a superset of admin, so it passes too.
 */
function requireAdmin(req, res, next) {
  const role = req.user?.role;
  if (role !== 'admin' && role !== 'superadmin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

/**
 * SUPER ADMIN ONLY middleware
 */
function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ message: 'Super admin access required' });
  }
  next();
}

/**
 * OPTIONAL Verification (Public + Authed user endpoints)
 */
function optionalAuth(req, res, next) {
  let token = req.cookies?.token;

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    req.user = { id: PROFILE_OWNER_ID, role: 'guest' };
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, role: payload.role || 'guest' };
    return next();
  } catch {
    req.user = { id: PROFILE_OWNER_ID, role: 'guest' };
    return next();
  }
}

module.exports = {
  verifyToken,
  requireAdmin,
  requireSuperAdmin,
  optionalAuth
};