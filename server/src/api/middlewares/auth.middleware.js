// server/src/api/middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');
const config = require('../../config');
const User = require('../../models/user.model');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, config.jwt.secret);

    // ✅ FIX: Always fetch fresh plan from DB — JWT plan is stale after upgrades
    const freshUser = await User.findById(decoded.userId || decoded.id)
      .select('plan subscription')
      .lean();

    req.user = {
      ...decoded,
      plan: freshUser?.plan || decoded.plan || 'basic',
      subscriptionStatus: freshUser?.subscription?.status || 'inactive',
    };

    // Log activity (non-blocking)
    try {
      const ActivityLog = require('../../models/activity-log.model');
      const isWriteOp = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
      if (isWriteOp) {
        ActivityLog.create({
          userId:      decoded.userId || decoded.id,
          action:      `${req.method} ${req.path}`,
          description: `${req.method} request to ${req.originalUrl}`,
          ipAddress:   req.ip,
          userAgent:   req.headers['user-agent'],
          status:      'success',
        }).catch(() => {});
      }
    } catch (_) {}

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = { authMiddleware };
