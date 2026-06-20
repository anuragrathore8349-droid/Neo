const jwt = require('jsonwebtoken');
const config = require('../../config');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;

    // Log activity (non-blocking)
    try {
      const ActivityLog = require('../../models/activity-log.model');
      const isWriteOp = ['POST','PUT','PATCH','DELETE'].includes(req.method);
      if (isWriteOp) {
        ActivityLog.create({
          userId:      decoded.userId,
          action:      `${req.method} ${req.path}`,
          description: `${req.method} request to ${req.originalUrl}`,
          ipAddress:   req.ip,
          userAgent:   req.headers['user-agent'],
          status:      'success',
        }).catch(() => {}); // fire-and-forget
      }
    } catch (_) {}

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = { authMiddleware };
