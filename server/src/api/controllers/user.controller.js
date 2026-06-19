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
}

module.exports = new UserController();