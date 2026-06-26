const { Server } = require('socket.io');
const { logger } = require('../../api/middlewares/logger.middleware');

class NotificationHandler {
  constructor(io) {
    this.io = io;
    this.userSockets = new Map(); // Map of userId -> Set of socket IDs
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.of('/notifications').on('connection', (socket) => {
      logger.info(`Client connected to notifications websocket: ${socket.id}`);

      socket.on('authenticate', (userId) => {
        this.handleAuthentication(socket, userId);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // Client-side actions
      socket.on('notification:read', (notificationId) => {
        // Client notifies they read a notification
        logger.debug(`Notification read event: ${notificationId}`);
      });

      socket.on('notification:deleted', (notificationId) => {
        // Client notifies they deleted a notification
        logger.debug(`Notification deleted event: ${notificationId}`);
      });
    });
  }

  handleAuthentication(socket, userId) {
    socket.join(`user:${userId}`);

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socket.id);

    logger.info(`Client ${socket.id} authenticated for user ${userId}`);
  }

  handleDisconnect(socket) {
    // Remove socket from user mappings
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
        break;
      }
    }
    logger.info(`Client disconnected from notifications websocket: ${socket.id}`);
  }

  /**
   * Broadcast a new notification to a user
   */
  broadcastNotification(userId, notification) {
    const room = `user:${userId}`;
    this.io.of('/notifications').to(room).emit('notification', {
      event: 'new',
      data: notification,
      timestamp: Date.now(),
    });
    logger.debug(`Notification broadcasted to user ${userId}`);
  }

  /**
   * Broadcast notification read status update
   */
  broadcastNotificationUpdate(userId, updateData) {
    const room = `user:${userId}`;
    this.io.of('/notifications').to(room).emit('notification:update', {
      event: 'read',
      data: updateData,
      timestamp: Date.now(),
    });
    logger.debug(`Notification update broadcasted to user ${userId}`);
  }

  /**
   * Broadcast all marked as read
   */
  broadcastAllRead(userId) {
    const room = `user:${userId}`;
    this.io.of('/notifications').to(room).emit('notification:batch', {
      event: 'markAllRead',
      timestamp: Date.now(),
    });
    logger.debug(`Mark all read broadcasted to user ${userId}`);
  }

  /**
   * Broadcast notification deletion
   */
  broadcastNotificationDeleted(userId, notificationId) {
    const room = `user:${userId}`;
    this.io.of('/notifications').to(room).emit('notification:delete', {
      event: 'deleted',
      data: { notificationId },
      timestamp: Date.now(),
    });
    logger.debug(`Notification deletion broadcasted to user ${userId}: ${notificationId}`);
  }

  /**
   * Broadcast all deleted
   */
  broadcastAllDeleted(userId) {
    const room = `user:${userId}`;
    this.io.of('/notifications').to(room).emit('notification:batch', {
      event: 'deleteAll',
      timestamp: Date.now(),
    });
    logger.debug(`Delete all notifications broadcasted to user ${userId}`);
  }

  /**
   * Send user notification (legacy method for compatibility)
   */
  sendUserNotification(userId, notification) {
    this.broadcastNotification(userId, notification);
  }

  /**
   * Send alert notification
   */
  sendAlert(userId, alert) {
    const room = `user:${userId}`;
    this.io.of('/notifications').to(room).emit('alert', {
      ...alert,
      timestamp: Date.now(),
    });
  }

  /**
   * Send price alert notification
   */
  sendPriceAlert(userId, alert) {
    const room = `user:${userId}`;
    this.io.of('/notifications').to(room).emit('priceAlert', {
      ...alert,
      timestamp: Date.now(),
    });
  }

  /**
   * Send price alert notification
   */
  sendPriceAlert(userId, alert) {
    const room = `user:${userId}`;
    this.io.of('/notifications').to(room).emit('priceAlert', {
      ...alert,
      timestamp: Date.now(),
    });
  }

  /**
   * Send system notification
   */
  sendSystemNotification(userId, notification) {
    const room = `user:${userId}`;
    this.io.of('/notifications').to(room).emit('systemNotification', {
      ...notification,
      timestamp: Date.now(),
    });
  }

  /**
   * Get connected users count (for monitoring)
   */
  getConnectedUsersCount() {
    return this.userSockets.size;
  }

  /**
   * Get sockets for a specific user
   */
  getUserSockets(userId) {
    return this.userSockets.get(userId) || new Set();
  }
}

module.exports = NotificationHandler;