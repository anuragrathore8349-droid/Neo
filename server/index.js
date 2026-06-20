// server/index.js — REPLACE ENTIRE FILE
'use strict';

const http = require('http');
const app = require('./src/app');
const WebSocketServer = require('./src/websockets/index');
const { connectDB, redisClient } = require('./src/config/database');
const { startPriceBroadcast } = require('./src/jobs/marketData.job');
const { startPortfolioHistoryJob } = require('./src/jobs/portfolio-history.job');
const { startDefiJob } = require('./src/jobs/defi.job');
const { seedLearningContent } = require('./src/utils/seed-learning');
const config = require('./src/config');
const { logger } = require('./src/api/middlewares/logger.middleware');

const PORT = config.port || 3000;

async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();
    logger.info('✅ MongoDB connected');

    // Seed learning content if DB is empty
    try {
      await seedLearningContent();
      logger.info('✅ Learning content seeded');
    } catch (err) {
      logger.warn('Learning seed skipped:', err.message);
    }

    const server = http.createServer(app);

    // Initialize WebSocket server
    const wsServer = new WebSocketServer(server);

    // ✅ Expose globally so jobs & services can broadcast
    global.wsServer          = wsServer;
    global.io                = wsServer.io;
    global.marketHandler     = wsServer.handlers.market;
    global.tradingHandler    = wsServer.handlers.trading;
    global.portfolioHandler  = wsServer.handlers.portfolio;
    global.notificationHandler = wsServer.handlers.notification;
    global.defiHandler       = wsServer.handlers.defi;

    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
    });

    // Start background jobs after server is up
    await startPriceBroadcast();
    logger.info('✅ Price broadcast started');

    await startPortfolioHistoryJob();
    logger.info('✅ Portfolio history job started');

    await startDefiJob();
    logger.info('✅ DeFi job started');

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        if (redisClient?.isOpen) await redisClient.quit();
        process.exit(0);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
