const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/user.model');
const ApiKey = require('../models/api-key.model');
const { logger } = require('../api/middlewares/logger.middleware');

class UserService {
  // Helper method to format user response
  formatUserResponse(user) {
    if (!user) return null;
    
    const userObj = user.toObject ? user.toObject() : user;
    return {
      id: userObj._id,
      email: userObj.email,
      firstName: userObj.firstName,
      lastName: userObj.lastName,
      phoneNumber: userObj.phoneNumber,
      country: userObj.country,
      dateOfBirth: userObj.dateOfBirth,
      profession: userObj.profession,
      avatar: userObj.avatar,
      bio: userObj.bio,
      plan: userObj.plan,
      preferences: userObj.preferences,
      role: userObj.role,
      twoFactorEnabled: userObj.isTwoFactorEnabled
    };
  }

  async getProfile(userId) {
    try {
      const user = await User.findById(userId).select('-passwordHash -refreshTokens');
      if (!user) {
        throw new Error('User not found');
      }
      return this.formatUserResponse(user);
    } catch (error) {
      logger.error('Error fetching user profile:', error);
      throw error;
    }
  }

  async updateProfile(userId, updateData) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (updateData.fullName) {
        const parts = updateData.fullName.trim().split(/\s+/);
        updateData.firstName = parts[0] || '';
        updateData.lastName = parts.slice(1).join(' ') || parts[0] || '';
      }

      // Update allowed fields
      const allowedFields = ['firstName', 'lastName', 'phoneNumber', 'country', 'dateOfBirth', 'profession', 'avatar', 'bio', 'timezone', 'language', 'currency'];
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          user[field] = updateData[field];
        }
      });

      await user.save();
      return this.formatUserResponse(user);
    } catch (error) {
      logger.error('Error updating user profile:', error);
      throw error;
    }
  }

  async changePassword(userId, { currentPassword, newPassword }) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const isValid = await user.comparePassword(currentPassword);
      if (!isValid) {
        throw new Error('Current password is incorrect');
      }

      user.password = newPassword;
      user.refreshTokens = []; // Invalidate all sessions
      await user.save();
    } catch (error) {
      logger.error('Error changing password:', error);
      throw error;
    }
  }

  async getNotificationSettings(userId) {
    try {
      const user = await User.findById(userId).select('preferences.notifications');
      if (!user) {
        throw new Error('User not found');
      }
      return user.preferences.notifications;
    } catch (error) {
      logger.error('Error fetching notification settings:', error);
      throw error;
    }
  }

  async updateNotificationSettings(userId, settings) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.preferences.notifications = {
        ...user.preferences.notifications,
        ...settings
      };

      await user.save();
      return user.preferences.notifications;
    } catch (error) {
      logger.error('Error updating notification settings:', error);
      throw error;
    }
  }

  async getApiKeys(userId) {
    try {
      const apiKeys = await ApiKey.find({ userId })
        .select('-secret')
        .sort({ createdAt: -1 });
      return apiKeys;
    } catch (error) {
      logger.error('Error fetching API keys:', error);
      throw error;
    }
  }

  async createApiKey(userId, keyData) {
    try {
      // Generate API key and secret
      const key = crypto.randomBytes(20).toString('hex');
      const secret = crypto.randomBytes(40).toString('hex');

      const apiKey = new ApiKey({
        userId,
        key,
        secret: await bcrypt.hash(secret, 12),
        name: keyData.name,
        permissions: keyData.permissions,
        ipWhitelist: keyData.ipWhitelist,
        expiresAt: keyData.expiresAt
      });

      await apiKey.save();

      // Only return secret once during creation
      return {
        ...apiKey.toObject(),
        secret
      };
    } catch (error) {
      logger.error('Error creating API key:', error);
      throw error;
    }
  }

  async deleteApiKey(userId, keyId) {
    try {
      const result = await ApiKey.deleteOne({
        _id: keyId,
        userId
      });

      if (result.deletedCount === 0) {
        throw new Error('API key not found');
      }
    } catch (error) {
      logger.error('Error deleting API key:', error);
      throw error;
    }
  }
}

module.exports = new UserService();