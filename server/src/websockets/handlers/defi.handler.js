// server/src/websockets/handlers/defi.handler.js — REPLACE ENTIRE FILE
const { logger } = require('../../api/middlewares/logger.middleware');

class DefiHandler {
  constructor(io) {
    this.io = io;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.of('/defi').on('connection', (socket) => {
      logger.info(`Client connected to DeFi WebSocket: ${socket.id}`);

      socket.on('subscribe_positions', (userId) => {
        socket.join(`defi:${userId}`);
      });

      socket.on('disconnect', () => {
        logger.info(`Client disconnected from DeFi WebSocket: ${socket.id}`);
      });
    });
  }

  broadcastPositionUpdate(userId, position) {
    this.io.of('/defi').to(`defi:${userId}`).emit('position_update', {
      position,
      timestamp: Date.now(),
    });
  }

  broadcastGasUpdate(gasData) {
    this.io.of('/defi').emit('gas_update', { ...gasData, timestamp: Date.now() });
  }
}

module.exports = DefiHandler;
