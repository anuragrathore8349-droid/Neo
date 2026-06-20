const { Server } = require('socket.io');
const { logger } = require('../../api/middlewares/logger.middleware');

class PortfolioHandler {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.of('/portfolio').on('connection', (socket) => {
      logger.info(`Client connected to portfolio websocket: ${socket.id}`);

      socket.on('subscribe', (portfolioId) => {
        this.handleSubscribe(socket, portfolioId);
      });

      socket.on('unsubscribe', (portfolioId) => {
        this.handleUnsubscribe(socket, portfolioId);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  handleSubscribe(socket, portfolioId) {
    const room = `portfolio:${portfolioId}`;
    socket.join(room);
    
    if (!this.rooms.has(socket.id)) {
      this.rooms.set(socket.id, new Set());
    }
    this.rooms.get(socket.id).add(room);

    logger.info(`Client ${socket.id} subscribed to portfolio ${portfolioId}`);
  }

  handleUnsubscribe(socket, portfolioId) {
    const room = `portfolio:${portfolioId}`;
    socket.leave(room);
    
    if (this.rooms.has(socket.id)) {
      this.rooms.get(socket.id).delete(room);
    }

    logger.info(`Client ${socket.id} unsubscribed from portfolio ${portfolioId}`);
  }

  handleDisconnect(socket) {
    if (this.rooms.has(socket.id)) {
      this.rooms.delete(socket.id);
    }
    logger.info(`Client disconnected from portfolio websocket: ${socket.id}`);
  }

  // Broadcast portfolio updates
  broadcastPortfolioUpdate(portfolioId, data) {
    const room = `portfolio:${portfolioId}`;
    this.io.of('/portfolio').to(room).emit('portfolioUpdate', {
      portfolioId,
      data,
      timestamp: Date.now()
    });
  }

  // Broadcast asset updates
  broadcastAssetUpdate(portfolioId, assetId, data) {
    const room = `portfolio:${portfolioId}`;
    this.io.of('/portfolio').to(room).emit('assetUpdate', {
      portfolioId,
      assetId,
      data,
      timestamp: Date.now()
    });
  }

  // Broadcast performance metrics
  broadcastPerformanceUpdate(portfolioId, metrics) {
    const room = `portfolio:${portfolioId}`;
    this.io.of('/portfolio').to(room).emit('performanceUpdate', {
      portfolioId,
      metrics,
      timestamp: Date.now()
    });
  }

  // Broadcast allocation updates
  broadcastAllocationUpdate(portfolioId, allocation) {
    const room = `portfolio:${portfolioId}`;
    this.io.of('/portfolio').to(room).emit('allocationUpdate', {
      portfolioId,
      allocation,
      timestamp: Date.now()
    });
  }
}

module.exports = PortfolioHandler;