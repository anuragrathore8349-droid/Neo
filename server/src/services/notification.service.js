const Notification = require('../models/notification.model');
const { logger } = require('../api/middlewares/logger.middleware');

class NotificationService {
  /**
   * Create and emit a new notification
   */
  async createNotification(userId, data) {
    try {
      const {
        type,
        title,
        message,
        icon = 'Bell',
        severity = 'info',
        actionUrl = null,
        actionLabel = null,
        metadata = {},
      } = data;

      if (!userId || !type || !title || !message) {
        throw new Error('Missing required notification fields');
      }

      const notification = await Notification.create({
        userId,
        type,
        title,
        message,
        icon,
        severity,
        actionUrl,
        actionLabel,
        metadata,
      });

      // Broadcast via WebSocket if available
      if (global.notificationHandler) {
        global.notificationHandler.broadcastNotification(userId, notification);
      }

      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get all notifications for a user
   */
  async getNotifications(userId, { limit = 20, skip = 0, unreadOnly = false } = {}) {
    try {
      const query = { userId };
      if (unreadOnly) {
        query.isRead = false;
      }

      const [notifications, total] = await Promise.all([
        Notification.find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(skip)
          .lean(),
        Notification.countDocuments(query),
      ]);

      const unreadCount = await Notification.countDocuments({ userId, isRead: false });

      return {
        data: notifications,
        pagination: { total, limit, skip, hasMore: skip + limit < total },
        unreadCount,
      };
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Get a single notification
   */
  async getNotification(userId, notificationId) {
    try {
      const notification = await Notification.findOne({ _id: notificationId, userId });
      if (!notification) {
        throw new Error('Notification not found');
      }
      return notification;
    } catch (error) {
      logger.error('Error fetching notification:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId, notificationId) {
    try {
      const notification = await Notification.findOne({ _id: notificationId, userId });
      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.markAsRead();

      // Notify client of read status update
      if (global.notificationHandler) {
        global.notificationHandler.broadcastNotificationUpdate(userId, {
          notificationId,
          isRead: true,
          readAt: notification.readAt,
        });
      }

      return notification;
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        { userId, isRead: false },
        {
          $set: {
            isRead: true,
            readAt: new Date(),
          },
        }
      );

      if (global.notificationHandler) {
        global.notificationHandler.broadcastAllRead(userId);
      }

      return result;
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(userId, notificationId) {
    try {
      const result = await Notification.findOneAndDelete({ _id: notificationId, userId });
      if (!result) {
        throw new Error('Notification not found');
      }

      if (global.notificationHandler) {
        global.notificationHandler.broadcastNotificationDeleted(userId, notificationId);
      }

      return result;
    } catch (error) {
      logger.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAllNotifications(userId) {
    try {
      const result = await Notification.deleteMany({ userId });

      if (global.notificationHandler) {
        global.notificationHandler.broadcastAllDeleted(userId);
      }

      return result;
    } catch (error) {
      logger.error('Error deleting all notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId) {
    try {
      return await Notification.getUnreadCount(userId);
    } catch (error) {
      logger.error('Error getting unread count:', error);
      throw error;
    }
  }

  /**
   * Create order notification
   */
  async notifyOrderFilled(userId, order) {
    return this.createNotification(userId, {
      type: 'order',
      title: `${order.side.toUpperCase()} Order Filled`,
      message: `${order.amount} ${order.symbol} filled at $${order.averageFilledPrice?.toFixed(2)}`,
      icon: 'TrendingUp',
      severity: 'success',
      actionUrl: '/trading',
      actionLabel: 'View Order',
      metadata: { orderId: order._id?.toString(), symbol: order.symbol, price: order.averageFilledPrice },
    });
  }

  /**
   * Create price alert notification
   */
  async notifyPriceAlert(userId, alert, currentPrice) {
    const message = alert.type === 'above'
      ? `${alert.symbol} has risen above $${alert.price}`
      : `${alert.symbol} has fallen below $${alert.price}`;

    return this.createNotification(userId, {
      type: 'alert',
      title: `Price Alert: ${alert.symbol}`,
      message,
      icon: 'AlertCircle',
      severity: 'warning',
      actionUrl: `/trading?symbol=${alert.symbol}`,
      actionLabel: 'View Chart',
      metadata: { alertId: alert._id?.toString(), symbol: alert.symbol, currentPrice, targetPrice: alert.price },
    });
  }

  /**
   * Create security notification
   */
  async notifySecurityEvent(userId, event, details) {
    return this.createNotification(userId, {
      type: 'security',
      title: `Security: ${event}`,
      message: details,
      icon: 'Shield',
      severity: 'warning',
      actionUrl: '/security',
      actionLabel: 'Review Activity',
      metadata: { event, timestamp: new Date().toISOString() },
    });
  }

  /**
   * Create subscription notification
   */
  async notifySubscriptionUpdate(userId, event, planName) {
    const titleMap = {
      upgraded: 'Plan Upgraded',
      downgraded: 'Plan Downgraded',
      renewed: 'Subscription Renewed',
      cancelled: 'Subscription Cancelled',
      failed: 'Payment Failed',
    };

    return this.createNotification(userId, {
      type: 'subscription',
      title: titleMap[event] || 'Subscription Updated',
      message: `Your subscription has been ${event}. Plan: ${planName}`,
      icon: 'CreditCard',
      severity: event === 'failed' ? 'error' : 'info',
      actionUrl: '/settings/billing',
      actionLabel: 'View Billing',
      metadata: { event, planName },
    });
  }

  /**
   * Create DeFi warning notification
   */
  async notifyDeFiWarning(userId, protocol, warning, metadata = {}) {
    return this.createNotification(userId, {
      type: 'defi',
      title: `${protocol} Alert`,
      message: warning,
      icon: 'AlertTriangle',
      severity: 'warning',
      actionUrl: '/defi',
      actionLabel: 'View Positions',
      metadata: { protocol, ...metadata },
    });
  }

  /**
   * Create portfolio milestone notification
   */
  async notifyPortfolioMilestone(userId, message, metadata = {}) {
    return this.createNotification(userId, {
      type: 'performance',
      title: 'Portfolio Milestone',
      message,
      icon: 'Zap',
      severity: 'success',
      actionUrl: '/portfolio',
      actionLabel: 'View Portfolio',
      metadata,
    });
  }

  /**
   * Create AI insight notification
   */
  async notifyAIInsight(userId, symbol, insight) {
    return this.createNotification(userId, {
      type: 'ai_insight',
      title: `AI Insight: ${symbol}`,
      message: insight,
      icon: 'Lightbulb',
      severity: 'info',
      actionUrl: '/ai-insights',
      actionLabel: 'View Insights',
      metadata: { symbol, insight },
    });
  }

  /**
   * Bulk create notifications for multiple users
   */
  async broadcastNotification(userIds, data) {
    try {
      const notifications = userIds.map(userId => ({ userId, ...data }));
      const results = await Notification.insertMany(notifications);

      // Broadcast to each user
      userIds.forEach((userId, idx) => {
        if (global.notificationHandler) {
          global.notificationHandler.broadcastNotification(userId, results[idx]);
        }
      });

      return results;
    } catch (error) {
      logger.error('Error broadcasting notifications:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();
