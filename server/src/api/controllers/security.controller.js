// server/src/api/controllers/security.controller.js
'use strict';

const speakeasy    = require('speakeasy');
const QRCode       = require('qrcode');
const User         = require('../../models/user.model');
const ActivityLog  = require('../../models/activity-log.model');
const { logger }   = require('../middlewares/logger.middleware');

class SecurityController {

  /**
   * GET /api/security/status
   * Full security status for the authenticated user.
   */
  async getSecurityStatus(req, res, next) {
    try {
      const user = await User.findById(req.user.userId)
        .select('isTwoFactorEnabled refreshTokens isEmailVerified lastLogin failedLoginAttempts');

      if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

      const data = {
        twoFactorEnabled: user.isTwoFactorEnabled || false,
        emailVerified:    user.isEmailVerified    || false,
        activeSessions:   (user.refreshTokens || []).length,
        lastLogin:        user.lastLogin || null,
        failedAttempts:   user.failedLoginAttempts || 0,
      };

      res.json({ status: 'success', data });
    } catch (error) {
      logger.error('getSecurityStatus error:', error);
      next(error);
    }
  }

  /**
   * GET /api/security/devices
   * Returns active sessions mapped as device list.
   */
  async getDevices(req, res, next) {
    try {
      const user = await User.findById(req.user.userId)
        .select('refreshTokens lastLogin');

      if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

      const devices = (user.refreshTokens || []).map((rt, idx) => ({
        id:         String(rt._id || idx),
        name:       rt.deviceName || `Session ${idx + 1}`,
        browser:    rt.userAgent  || 'Unknown browser',
        lastActive: rt.createdAt  || user.lastLogin || new Date(),
        isCurrent:  false,
        trusted:    true,
      }));

      res.json({ status: 'success', data: devices });
    } catch (error) {
      logger.error('getDevices error:', error);
      next(error);
    }
  }

  /**
   * DELETE /api/security/devices/:id
   * Revoke a session/device by its refresh-token _id.
   */
  async removeDevice(req, res, next) {
    try {
      const result = await User.findByIdAndUpdate(
        req.user.userId,
        { $pull: { refreshTokens: { _id: req.params.id } } },
        { new: true }
      );

      if (!result) return res.status(404).json({ status: 'error', message: 'Session not found' });

      // Log the action
      await ActivityLog.create({
        userId:      req.user.userId,
        action:      'session_revoked',
        description: `Session ${req.params.id} was revoked`,
        ipAddress:   req.ip,
        userAgent:   req.headers['user-agent'],
        status:      'success',
      });

      res.json({ status: 'success', message: 'Session revoked successfully' });
    } catch (error) {
      logger.error('removeDevice error:', error);
      next(error);
    }
  }

  /**
   * GET /api/security/activity
   * Paginated activity log from ActivityLog collection.
   */
  async getActivityLog(req, res, next) {
    try {
      const { limit = 20, skip = 0 } = req.query;

      const [logs, total] = await Promise.all([
        ActivityLog.find({ userId: req.user.userId })
          .sort({ createdAt: -1 })
          .skip(+skip)
          .limit(+limit)
          .lean(),
        ActivityLog.countDocuments({ userId: req.user.userId }),
      ]);

      res.json({ status: 'success', data: logs, pagination: { limit: +limit, skip: +skip, total } });
    } catch (error) {
      logger.error('getActivityLog error:', error);
      next(error);
    }
  }

  /**
   * POST /api/security/2fa/setup
   * Generate TOTP secret + QR code for the user.
   */
  async setup2FA(req, res, next) {
    try {
      const user = await User.findById(req.user.userId).select('email');
      if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

      const secret = speakeasy.generateSecret({ name: `NeoFin:${user.email}` });

      // Store secret temporarily (not yet enabled)
      await User.findByIdAndUpdate(req.user.userId, { $set: { twoFactorSecret: secret.base32 } });

      const qrCode = await QRCode.toDataURL(secret.otpauth_url);
      res.json({ status: 'success', data: { secret: secret.base32, qrCode } });
    } catch (error) {
      logger.error('setup2FA error:', error);
      next(error);
    }
  }

  /**
   * POST /api/security/2fa/verify
   * Verify TOTP code and enable 2FA.
   */
  async verify2FA(req, res, next) {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ status: 'error', message: 'Token is required' });

      const user = await User.findById(req.user.userId).select('twoFactorSecret');
      if (!user?.twoFactorSecret) {
        return res.status(400).json({ status: 'error', message: '2FA setup not initiated. Call /setup first.' });
      }

      const isValid = speakeasy.totp.verify({
        secret:   user.twoFactorSecret,
        encoding: 'base32',
        token,
        window:   1,
      });

      if (!isValid) return res.status(400).json({ status: 'error', message: 'Invalid 2FA code' });

      await User.findByIdAndUpdate(req.user.userId, { $set: { isTwoFactorEnabled: true } });

      await ActivityLog.create({
        userId:      req.user.userId,
        action:      '2fa_enabled',
        description: 'Two-factor authentication was enabled',
        ipAddress:   req.ip,
        userAgent:   req.headers['user-agent'],
        status:      'success',
      });

      res.json({ status: 'success', message: '2FA enabled successfully', data: { verified: true } });
    } catch (error) {
      logger.error('verify2FA error:', error);
      next(error);
    }
  }

  /**
   * POST /api/security/2fa/disable
   */
  async disable2FA(req, res, next) {
    try {
      await User.findByIdAndUpdate(req.user.userId, {
        $set:   { isTwoFactorEnabled: false },
        $unset: { twoFactorSecret: '' },
      });

      await ActivityLog.create({
        userId:      req.user.userId,
        action:      '2fa_disabled',
        description: 'Two-factor authentication was disabled',
        ipAddress:   req.ip,
        userAgent:   req.headers['user-agent'],
        status:      'success',
      });

      res.json({ status: 'success', message: '2FA disabled' });
    } catch (error) {
      logger.error('disable2FA error:', error);
      next(error);
    }
  }

  /**
   * PUT /api/security/permissions/:id
   * Toggle a named permission flag on the user preferences.
   * Supported: trading, api, notifications
   */
  async togglePermission(req, res, next) {
    try {
      const { id }     = req.params;
      const { enabled } = req.body;

      const allowed = ['trading', 'api', 'notifications'];
      if (!allowed.includes(id)) {
        return res.status(400).json({ status: 'error', message: `Unknown permission: ${id}` });
      }

      const update = { $set: { [`preferences.permissions.${id}`]: !!enabled } };
      await User.findByIdAndUpdate(req.user.userId, update);

      res.json({ status: 'success', message: `Permission "${id}" set to ${enabled}` });
    } catch (error) {
      logger.error('togglePermission error:', error);
      next(error);
    }
  }
}

module.exports = new SecurityController();