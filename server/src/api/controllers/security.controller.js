const speakeasy = require('speakeasy');
const { logger } = require('../middlewares/logger.middleware');

class SecurityController {
  async getSecurityStatus(req, res, next) {
    try {
      res.json({ status: 'success', data: { message: 'Security features available' } });
    } catch (error) { next(error); }
  }

  async getDevices(req, res, next) {
    try {
      res.json({ status: 'success', data: [] });
    } catch (error) { next(error); }
  }

  async removeDevice(req, res, next) {
    try {
      res.json({ status: 'success', message: 'Device removed' });
    } catch (error) { next(error); }
  }

  async getActivityLog(req, res, next) {
    try {
      const ActivityLog = require('../../models/activity-log.model');
      const { page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;
      const [logs, total] = await Promise.all([
        ActivityLog.find({ userId: req.user.userId })
          .sort({ createdAt: -1 })
          .skip(+skip)
          .limit(+limit)
          .lean(),
        ActivityLog.countDocuments({ userId: req.user.userId }),
      ]);
      res.json({ status: 'success', data: { logs, total, page: +page, limit: +limit } });
    } catch (error) { next(error); }
  }

  async setup2FA(req, res, next) {
    try {
      const secret = speakeasy.generateSecret({ name: 'NeoFin' });
      res.json({ status: 'success', data: secret });
    } catch (error) { next(error); }
  }

  async verify2FA(req, res, next) {
    try {
      res.json({ status: 'success', message: '2FA verified' });
    } catch (error) { next(error); }
  }

  async disable2FA(req, res, next) {
    try {
      res.json({ status: 'success', message: '2FA disabled' });
    } catch (error) { next(error); }
  }
}

module.exports = new SecurityController();
