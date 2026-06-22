'use strict';
const { Server }             = require('socket.io');
const jwt                    = require('jsonwebtoken');
const { logger }             = require('../api/middlewares/logger.middleware');
const MarketHandler          = require('./handlers/market.handler');
const TradingHandler         = require('./handlers/trading.handler');
const NotificationHandler    = require('./handlers/notification.handler');
const PortfolioHandler       = require('./handlers/portfolio.handler');
const DefiHandler            = require('./handlers/defi.handler');
const alertCheckJob          = require('../jobs/alertCheck.job');

function initWebSocket(server) {
  const io = new Server(server, {
    cors: {
      origin:      process.env.CLIENT_URL || 'http://localhost:5173',
      methods:     ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout:  30000,
    pingInterval: 10000,
  });

  // Auth middleware for protected namespaces
  const authMiddleware = (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  };

  // Apply auth to protected namespaces
  ['/trading', '/notifications', '/portfolio', '/defi'].forEach(ns => {
    io.of(ns).use(authMiddleware);
  });

  // Initialise handlers
  new MarketHandler(io);
  new TradingHandler(io);
  new NotificationHandler(io);
  new PortfolioHandler(io);
  new DefiHandler(io);

  // ─── Wire alert-check job to io so bell notifications work ───────────────
  alertCheckJob.setIo(io);
  alertCheckJob.job.start();
  logger.info('[WebSocket] Alert check job started and wired to socket.io');

  logger.info('[WebSocket] All handlers initialized');
  return io;
}

module.exports = initWebSocket;
