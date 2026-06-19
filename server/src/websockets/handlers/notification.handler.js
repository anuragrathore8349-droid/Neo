const { Server } = require('socket.io');
const { logger } = require('../../api/middlewares/logger.middleware');

class NotificationHandler {
  constructor(io) {
    this.io = io;
    this.userSockets = new Map();
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

  // Send notification to specific user
  sendUserNotification(userId, notification) {
    const room = `user:${userId}`;
    this.io.of('/notifications').to(room).emit('notification', {
      ...notification,
      timestamp: Date.now()
    });
  }

  // Send broadcast notification to all users
  broadcastNotification(notification) {
    this.io.of('/notifications').emit('notification', {
      ...notification,
      timestamp: Date.now()
    });
  }

  // Send alert notification
  sendAlert(userId, alert) {
    const room = `user:${userId}`;
    this.io.of('/notifications').to(room).emit('alert', {
      ...alert,
      timestamp: Date.now()
    });
  }

  // Send price alert notification
  sendPriceAlert(userId, alert) {
    const room = `user:${userId}`;
    this.io.of('/notifications').to(room).emit('priceAlert', {
      ...alert,
      timestamp: Date.now()
    });
  }

  // Send system notification
  sendSystemNotification(userId, notification) {
    const room = `user:${userId}`;
    this.io.of('/notifications').to(room).emit('systemNotification', {
      ...notification,
      timestamp: Date.now()
    });
  }
}

module.exports = NotificationHandler;