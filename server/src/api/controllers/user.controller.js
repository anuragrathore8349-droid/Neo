const userService = require('../../services/user.service');
const { logger } = require('../middlewares/logger.middleware');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const uploadDir = path.join(__dirname, '../../../uploads/avatars');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb)   => cb(null, `${req.user.userId}-${Date.now()}${path.extname(file.originalname)}`),
});

const avatarUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
}).single('avatar');

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

  async uploadAvatar(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'No file uploaded'
        });
      }
      
      const avatarPath = `/uploads/avatars/${req.file.filename}`;
      const profile = await userService.updateProfile(
        req.user.userId,
        { avatar: avatarPath }
      );
      
      res.json({
        status: 'success',
        data: {
          avatar: avatarPath,
          profile
        }
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
      const ApiKey = require('../../models/api-key.model');
      const keys = await ApiKey.find({ userId: req.user.userId }).select('-secret');
      res.json({ status: 'success', data: keys });
    } catch (error) { next(error); }
  }

  async saveApiKey(req, res, next) {
    try {
      const ApiKey = require('../../models/api-key.model');
      const { exchange, apiKey, secret, label } = req.body;
      const key = await ApiKey.findOneAndUpdate(
        { userId: req.user.userId, exchange },
        { apiKey, secret, label, isActive: true, updatedAt: new Date() },
        { upsert: true, new: true }
      );
      res.json({ status: 'success', data: { id: key._id, exchange: key.exchange, label: key.label } });
    } catch (error) { next(error); }
  }

  async deleteApiKey(req, res, next) {
    try {
      const ApiKey = require('../../models/api-key.model');
      await ApiKey.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
      res.json({ status: 'success', message: 'API key deleted' });
    } catch (error) { next(error); }
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

  async getSecurityStatus(req, res, next) {
    try {
      const User = require('../../models/user.model');
      const user = await User.findById(req.user.userId)
        .select('isTwoFactorEnabled refreshTokens isEmailVerified lastLogin failedLoginAttempts activityLog');

      const recentActivity = (user.activityLog || []).slice(0, 20).map(entry => ({
        action: entry.action,
        ip: entry.ip,
        device: entry.userAgent
          ? (entry.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop')
          : 'Unknown',
        timestamp: entry.timestamp,
      }));

      res.json({
        status: 'success',
        data: {
          twoFactorEnabled: user.isTwoFactorEnabled,
          emailVerified: user.isEmailVerified,
          activeSessions: user.refreshTokens?.length || 0,
          lastLogin: user.lastLogin,
          failedAttempts: user.failedLoginAttempts || 0,
          recentActivity,
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

  async getDevices(req, res, next) {
    try {
      const User = require('../../models/user.model');
      const user = await User.findById(req.user.userId).select('refreshTokens lastLogin');
      
      // Build device list from refresh tokens
      const devices = (user?.refreshTokens || []).map((rt, idx) => ({
        id: rt._id || idx,
        name: rt.deviceName || `Device ${idx + 1}`,
        browser: rt.userAgent || 'Unknown browser',
        lastActive: rt.createdAt || user.lastLogin,
        isCurrent: false, // Could be enhanced with token matching
        trusted: true,
      }));

      res.json({ status: 'success', data: devices });
    } catch (error) {
      next(error);
    }
  }

  async revokeDevice(req, res, next) {
    try {
      const User = require('../../models/user.model');
      await User.findByIdAndUpdate(req.user.userId, {
        $pull: { refreshTokens: { _id: req.params.id } }
      });
      res.json({ status: 'success', message: 'Device revoked' });
    } catch (error) {
      next(error);
    }
  }

  async getActivityLog(req, res, next) {
    try {
      const Transaction = require('../../models/transaction.model');
      const Order = require('../../models/order.model');

      const [transactions, orders] = await Promise.all([
        Transaction.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(20).lean(),
        Order.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(20).lean(),
      ]);

      const activity = [
        ...transactions.map(t => ({ type: 'transaction', action: t.type, amount: t.amount, symbol: t.asset?.symbol, date: t.createdAt })),
        ...orders.map(o => ({ type: 'order', action: `${o.side} order`, amount: o.amount, symbol: o.symbol, date: o.createdAt })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30);

      res.json({ status: 'success', data: activity });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
module.exports.avatarUpload = avatarUpload;
