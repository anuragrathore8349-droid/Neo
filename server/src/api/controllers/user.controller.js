const userService = require('../../services/user.service');
const { logger } = require('../middlewares/logger.middleware');

class UserController {
  async getProfile(req, res, next) {
    try {
      const profile = await userService.getProfile(req.user.userId);
      res.json({
        status: 'success',
        data: profile
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const profile = await userService.updateProfile(
        req.user.userId,
        req.validatedData.body
      );
      res.json({
        status: 'success',
        data: profile
      });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      await userService.changePassword(
        req.user.userId,
        req.validatedData.body
      );
      res.json({
        status: 'success',
        message: 'Password updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async getNotificationSettings(req, res, next) {
    try {
      const settings = await userService.getNotificationSettings(req.user.userId);
      res.json({
        status: 'success',
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  async updateNotificationSettings(req, res, next) {
    try {
      const settings = await userService.updateNotificationSettings(
        req.user.userId,
        req.validatedData.body
      );
      res.json({
        status: 'success',
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  async getApiKeys(req, res, next) {
    try {
      const apiKeys = await userService.getApiKeys(req.user.userId);
      res.json({
        status: 'success',
        data: apiKeys
      });
    } catch (error) {
      next(error);
    }
  }

  async createApiKey(req, res, next) {
    try {
      const apiKey = await userService.createApiKey(
        req.user.userId,
        req.validatedData.body
      );
      res.json({
        status: 'success',
        data: apiKey
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteApiKey(req, res, next) {
    try {
      await userService.deleteApiKey(
        req.user.userId,
        req.validatedData.params.id
      );
      res.json({
        status: 'success',
        message: 'API key deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async getSecurityStatus(req, res, next) {
    try {
      const User = require('../../models/user.model');
      const user = await User.findById(req.user.userId)
        .select('isTwoFactorEnabled refreshTokens isEmailVerified lastLogin failedLoginAttempts');
      
      res.json({
        status: 'success',
        data: {
          twoFactorEnabled: user.isTwoFactorEnabled,
          emailVerified: user.isEmailVerified,
          activeSessions: user.refreshTokens?.length || 0,
          lastLogin: user.lastLogin,
          failedAttempts: user.failedLoginAttempts || 0
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getSessions(req, res, next) {
    try {
      const User = require('../../models/user.model');
      const user = await User.findById(req.user.userId).select('refreshTokens lastLogin');
      if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

      // Map refresh tokens to session objects
      const sessions = (user.refreshTokens || []).map((t, i) => ({
        _id: t._id || String(i),
        current: i === (user.refreshTokens.length - 1), // most recent = current
        lastActive: t.expiresAt ? new Date(t.expiresAt.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString() : new Date().toISOString(),
        ip: 'Not tracked',
        userAgent: 'Session',
        deviceName: `Session ${i + 1}`,
      }));

      res.json({ status: 'success', data: sessions });
    } catch (error) {
      next(error);
    }
  }

  async removeSession(req, res, next) {
    try {
      const { id } = req.params;
      const User = require('../../models/user.model');
      const user = await User.findById(req.user.userId);
      if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

      // Remove the token at the given index
      const idx = parseInt(id, 10);
      if (!isNaN(idx) && user.refreshTokens[idx]) {
        user.refreshTokens.splice(idx, 1);
      } else {
        // Try by _id if stored with ObjectId
        user.refreshTokens = user.refreshTokens.filter(t => String(t._id) !== id);
      }
      await user.save();

      res.json({ status: 'success', message: 'Session removed' });
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount(req, res, next) {
    try {
      const User = require('../../models/user.model');
      const Portfolio = require('../../models/portfolio.model');
      const Wallet = require('../../models/wallet.model');
      
      const userId = req.user.userId;
      await Promise.all([
        User.findByIdAndDelete(userId),
        Portfolio.deleteMany({ userId }),
        Wallet.deleteMany({ userId }),
      ]);

      res.clearCookie('refreshToken');
      res.json({ status: 'success', message: 'Account deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
