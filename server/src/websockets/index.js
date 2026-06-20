const { Server } = require('socket.io');
const MarketHandler = require('./handlers/market.handler');
const TradingHandler = require('./handlers/trading.handler');
const PortfolioHandler = require('./handlers/portfolio.handler');
const NotificationHandler = require('./handlers/notification.handler');
const DefiHandler = require('./handlers/defi.handler');
const { logger } = require('../api/middlewares/logger.middleware');
const jwt = require('jsonwebtoken');
const config = require('../config');

class WebSocketServer {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupMiddleware();
    this.initializeHandlers();
  }

  setupMiddleware() {
    // Public namespaces — no auth required
    const PUBLIC_NAMESPACES = ['/market'];

    // Authentication middleware
    this.io.use(async (socket, next) => {
      // Skip auth for public namespaces
      if (PUBLIC_NAMESPACES.includes(socket.nsp.name)) {
        return next();
      }

      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, config.jwt.secret);
        socket.user = decoded;
        next();
      } catch (error) {
        logger.error('WebSocket authentication error:', error);
        next(new Error('Invalid token'));
      }
    });

    // Logging middleware
    this.io.use((socket, next) => {
      logger.info(`New WebSocket connection: ${socket.id} on ${socket.nsp.name}`, {
        userId: socket.user?.userId,
        transport: socket.conn.transport.name
      });
      next();
    });

    // Error handling middleware
    this.io.engine.on('connection_error', (err) => {
      logger.error('WebSocket connection error:', err);
    });
  }

  initializeHandlers() {
    this.marketHandler = new MarketHandler(this.io);
    this.tradingHandler = new TradingHandler(this.io);
    this.portfolioHandler = new PortfolioHandler(this.io);
    this.notificationHandler = new NotificationHandler(this.io);
    this.defiHandler = new DefiHandler(this.io);

    // Make handlers accessible
    this.handlers = {
      market: this.marketHandler,
      trading: this.tradingHandler,
      portfolio: this.portfolioHandler,
      notification: this.notificationHandler,
      defi: this.defiHandler
    };
  }

  // Helper method to broadcast system status
  broadcastSystemStatus(status) {
    this.io.emit('systemStatus', {
      ...status,
      timestamp: Date.now()
    });
  }

  // Helper method to get connected clients count
  getConnectedClientsCount() {
    return this.io.engine.clientsCount;
  }

  // Helper method to get active namespaces
  getActiveNamespaces() {
    return Array.from(this.io._nsps.keys());
  }

  // Helper method to get room members
  getRoomMembers(namespace, room) {
    return this.io.of(namespace).adapter.rooms.get(room)?.size || 0;
  }

  // Helper method to disconnect all clients
  disconnectAll(reason = 'Server shutdown') {
    this.io.disconnectSockets(true, reason);
  }

  // Helper method to get handler instance
  getHandler(type) {
    return this.handlers[type];
  }
}

module.exports = WebSocketServer;
