const { logger } = require('../../api/middlewares/logger.middleware');

class PortfolioHandler {
  constructor(io) {
    this.io = io;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.of('/portfolio').on('connection', (socket) => {
      const userId = socket.user?.userId?.toString();
      if (!userId) return socket.disconnect(true);

      logger.info(`Portfolio WS connected: user=${userId}`);

      // Join the user's personal room
      socket.join(`user:${userId}`);

      socket.on('disconnect', () => {
        logger.info(`Portfolio WS disconnected: user=${userId}`);
      });
    });
  }

  // Called by trading.service.js and portfolio-history.job.js after updates
  broadcastPortfolioUpdate(userId, data) {
    this.io.of('/portfolio').to(`user:${userId}`).emit('portfolio_update', data);
    logger.debug(`Portfolio update broadcast to user:${userId}`);
  }

  broadcastTransactionUpdate(userId, transaction) {
    this.io.of('/portfolio').to(`user:${userId}`).emit('transaction_update', transaction);
  }
}

module.exports = PortfolioHandler;

module.exports = PortfolioHandler;