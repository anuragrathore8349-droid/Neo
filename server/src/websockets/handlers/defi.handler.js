const { logger } = require('../../api/middlewares/logger.middleware');
const DefiSocket = require('../../../sockets/defi.socket');

class DefiHandler {
  constructor(io) {
    this.io = io;
    this.defiSocket = new DefiSocket(io);
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.of('/defi').on('connection', (socket) => {
      logger.info(`Client connected to DeFi websocket: ${socket.id}`);

      socket.on('subscribe', (positions) => {
        this.handleSubscribe(socket, positions);
      });

      socket.on('unsubscribe', (positions) => {
        this.handleUnsubscribe(socket, positions);
      });
    });
  }

  handleSubscribe(socket, positions) {
    if (!Array.isArray(positions)) {
      positions = [positions];
    }

    positions.forEach(positionId => {
      const room = `position:${positionId}`;
      socket.join(room);
      logger.info(`Client ${socket.id} subscribed to position ${positionId}`);
    });
  }

  handleUnsubscribe(socket, positions) {
    if (!Array.isArray(positions)) {
      positions = [positions];
    }

    positions.forEach(positionId => {
      const room = `position:${positionId}`;
      socket.leave(room);
      logger.info(`Client ${socket.id} unsubscribed from position ${positionId}`);
    });
  }

  // Broadcast position updates
  broadcastPositionUpdate(positionId, data) {
    const room = `position:${positionId}`;
    this.io.of('/defi').to(room).emit('positionUpdate', {
      positionId,
      data,
      timestamp: Date.now()
    });
  }

  // Broadcast reward updates
  broadcastRewardUpdate(positionId, data) {
    const room = `position:${positionId}`;
    this.io.of('/defi').to(room).emit('rewardUpdate', {
      positionId,
      data,
      timestamp: Date.now()
    });
  }

  // Broadcast protocol updates
  broadcastProtocolUpdate(protocolId, data) {
    this.io.of('/defi').emit('protocolUpdate', {
      protocolId,
      data,
      timestamp: Date.now()
    });
  }

  // Broadcast pool updates
  broadcastPoolUpdate(poolId, data) {
    const room = `pool:${poolId}`;
    this.io.of('/defi').to(room).emit('poolUpdate', {
      poolId,
      data,
      timestamp: Date.now()
    });
  }
}

module.exports = DefiHandler;