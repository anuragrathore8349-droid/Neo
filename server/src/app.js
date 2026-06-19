const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const WebSocketServer = require('./websockets');
const { errorMiddleware } = require('./api/middlewares/error.middleware');
const { loggerMiddleware } = require('./api/middlewares/logger.middleware');
const config = require('./config');
const { connectDB } = require('./config/database');
const externalContentService = require('./services/external-content.service');
const { startPriceBroadcast } = require('./jobs/marketData.job');
const portfolioHistoryJob = require('./jobs/portfolio-history.job');
const cron = require('node-cron');
// Initialize express app
const app = express();
const httpServer = createServer(app);

// Initialize WebSocket server
const wsServer = new WebSocketServer(httpServer);
global.wsServer = wsServer;

// Expose handlers globally for service access
global.portfolioHandler = wsServer.portfolioHandler;
global.marketHandler = wsServer.marketHandler;
global.tradingHandler = wsServer.tradingHandler;
global.notificationHandler = wsServer.notificationHandler;
global.defiHandler = wsServer.defiHandler;

// Apply middleware
app.use(helmet());
app.use(cors(config.corsOptions));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(loggerMiddleware);

// API Routes
app.use('/api/auth', require('./api/routes/auth.routes'));
app.use('/api/trading', require('./api/routes/trading.routes'));
app.use('/api/market', require('./api/routes/market.routes'));
app.use('/api/defi', require('./api/routes/defi.routes'));
app.use('/api/wallet', require('./api/routes/wallet.routes'));
app.use('/api/addressbook', require('./api/routes/addressbook.routes'));
app.use('/api/transaction', require('./api/routes/transaction.routes'));
app.use('/api/user', require('./api/routes/user.routes'));
app.use('/api/portfolio', require('./api/routes/portfolio.routes'));
app.use('/api/analytics', require('./api/routes/analytics.routes'));
app.use('/api/ai', require('./api/routes/ai.routes'));
app.use('/api/learning', require('./api/routes/learning.routes'));
app.use('/api/payment', require('./api/routes/payment.routes'));

// Basic health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    websocket: {
      connections: wsServer.getConnectedClientsCount()
    }
  });
});

// Serve static files from the React app build directory
const path = require('path');
const distPath = path.resolve(__dirname, '../../dist');
app.use(express.static(distPath));

// Catch-all handler: send back index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Error handling
app.use(errorMiddleware);

// Start server
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await connectDB();

    console.log('🔄 Syncing external learning content...');

    try {
      const results = await externalContentService.syncExternalContent();
      console.log('✅ External content synced:', results);
    } catch (err) {
      console.error('⚠️ External sync failed:', err.message);
    }

    // Auto-seed learning content if DB is empty
    try {
      const { Article } = require('./models/learning.model');
      const count = await Article.countDocuments();
      if (count === 0) {
        console.log('📚 No learning content found — running seed...');
        const { execSync } = require('child_process');
        execSync('node src/utils/seed-learning.js', { cwd: process.cwd(), stdio: 'inherit' });
        console.log('✅ Learning content seeded');
      }
    } catch (err) {
      console.warn('⚠️ Learning seed skipped:', err.message);
    }

    // Start price broadcast job
    try {
      await startPriceBroadcast();
      console.log('✅ Price broadcast job started');
    } catch (err) {
      console.error('⚠️ Price broadcast failed to start:', err.message);
    }

    // Schedule daily portfolio snapshot at 00:00 UTC
    cron.schedule('0 0 * * *', async () => {
      try {
        console.log('📸 Running daily portfolio history snapshot...');
        await portfolioHistoryJob.recordDailySnapshot();
        console.log('✅ Portfolio history snapshot completed');
      } catch (err) {
        console.error('⚠️ Portfolio history snapshot failed:', err.message);
      }
    });

    // Also run snapshot immediately on startup if none exist for today
    try {
      const PortfolioHistory = require('./models/portfolio-history.model');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existingToday = await PortfolioHistory.findOne({
        timestamp: { $gte: today }
      });
      
      if (!existingToday) {
        console.log('📸 Creating initial portfolio history snapshot...');
        await portfolioHistoryJob.recordDailySnapshot();
        console.log('✅ Initial portfolio snapshot created');
      }
    } catch (err) {
      console.error('⚠️ Initial portfolio snapshot failed:', err.message);
    }

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}
startServer();

module.exports = app;
