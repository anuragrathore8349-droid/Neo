const notificationService = require('../../services/notification.service');
const { logger } = require('../middlewares/logger.middleware');

class NotificationController {
  /**
   * GET /api/user/notifications
   * Fetch notifications for the current user
   */
  async getNotifications(req, res, next) {
    try {
      const { limit = 20, skip = 0, unreadOnly = false } = req.query;
      const result = await notificationService.getNotifications(req.user.userId, {
        limit: parseInt(limit),
        skip: parseInt(skip),
        unreadOnly: unreadOnly === 'true',
      });

      res.json({
        status: 'success',
        data: result.data,
        pagination: result.pagination,
        unreadCount: result.unreadCount,
      });
    } catch (error) {
      logger.error('Get notifications error:', error);
      next(error);
    }
  }

  /**
   * GET /api/user/notifications/:id
   * Get a single notification
   */
  async getNotification(req, res, next) {
    try {
      const notification = await notificationService.getNotification(req.user.userId, req.params.id);
      res.json({ status: 'success', data: notification });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ status: 'error', message: 'Notification not found' });
      }
      logger.error('Get notification error:', error);
      next(error);
    }
  }

  /**
   * PATCH /api/user/notifications/:id/read
   * Mark a notification as read
   */
  async markAsRead(req, res, next) {
    try {
      const notification = await notificationService.markAsRead(req.user.userId, req.params.id);
      res.json({ status: 'success', data: notification });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ status: 'error', message: 'Notification not found' });
      }
      logger.error('Mark as read error:', error);
      next(error);
    }
  }

  /**
   * PATCH /api/user/notifications/mark-all-read
   * Mark all notifications as read
   */
  async markAllAsRead(req, res, next) {
    try {
      const result = await notificationService.markAllAsRead(req.user.userId);
      res.json({ status: 'success', message: 'All notifications marked as read', modifiedCount: result.modifiedCount });
    } catch (error) {
      logger.error('Mark all as read error:', error);
      next(error);
    }
  }

  /**
   * DELETE /api/user/notifications/:id
   * Delete a notification
   */
  async deleteNotification(req, res, next) {
    try {
      await notificationService.deleteNotification(req.user.userId, req.params.id);
      res.json({ status: 'success', message: 'Notification deleted' });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ status: 'error', message: 'Notification not found' });
      }
      logger.error('Delete notification error:', error);
      next(error);
    }
  }

  /**
   * DELETE /api/user/notifications
   * Delete all notifications for the user
   */
  async deleteAllNotifications(req, res, next) {
    try {
      const result = await notificationService.deleteAllNotifications(req.user.userId);
      res.json({ status: 'success', message: 'All notifications deleted', deletedCount: result.deletedCount });
    } catch (error) {
      logger.error('Delete all notifications error:', error);
      next(error);
    }
  }

  /**
   * GET /api/user/notifications/unread/count
   * Get unread notification count
   */
  async getUnreadCount(req, res, next) {
    try {
      const count = await notificationService.getUnreadCount(req.user.userId);
      res.json({ status: 'success', unreadCount: count });
    } catch (error) {
      logger.error('Get unread count error:', error);
      next(error);
    }
  }
}

module.exports = new NotificationController();
