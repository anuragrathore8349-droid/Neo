const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const { createServer } = require('http');
const path = require('path');
const cron = require('node-cron');
const mongoose = require('mongoose');
const swaggerUi = require('swagger-ui-express');
const openapiDocument = require('../openapi.generated.json');
const WebSocketServer = require('./websockets');
const { errorMiddleware } = require('./api/middlewares/error.middleware');
const { loggerMiddleware } = require('./api/middlewares/logger.middleware');
const paymentRoutes = require('./api/routes/payment.routes');
const config = require('./config');
const { connectDB, redisClient } = require('./config/database');

const app = express();
const httpServer = createServer(app);

// WebSocket
const wsServer = new WebSocketServer(httpServer);
global.wsServer = wsServer;
global.portfolioHandler = wsServer.portfolioHandler;
global.marketHandler = wsServer.marketHandler;
global.tradingHandler = wsServer.tradingHandler;
global.notificationHandler = wsServer.notificationHandler;
global.defiHandler = wsServer.defiHandler;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow Vite HMR in dev
}));
app.use(cors(config.corsOptions));
app.use(compression());

const jsonParser = express.json({ limit: '10mb' });
app.use((req, res, next) => {
  // Preserve raw Stripe webhook payload for signature validation.
  if (req.originalUrl === '/api/v1/payment/webhook' && req.method === 'POST') {
    return next();
  }
  return jsonParser(req, res, next);
});

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(loggerMiddleware);

// Standardize API response envelope for all JSON responses
const { success, error } = require('./utils/responseNormaliser');
app.use((req, res, next) => {
  const oldJson = res.json.bind(res);
  res.json = (body) => {
    // If controller already returns normalized envelope, pass through
    if (body && (body.status === 'success' || body.status === 'error')) {
      return oldJson(body);
    }

    // If response status is an error, wrap into error envelope
    if (res.statusCode && res.statusCode >= 400) {
      const message = body?.message || body || 'An error occurred';
      return oldJson(error(message, res.statusCode));
    }

    // Otherwise wrap in success envelope
    return oldJson(success(body));
  };
  next();
});

const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 60 * 60
  }
});

app.use('/api/v1/payment', paymentRoutes.webhookRouter);
app.use('/api/v1', csrfProtection);
app.get('/api/v1/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// ── API Routes ────────────────────────────────────────────────────────────
app.use('/api/v1/auth',             require('./api/routes/auth.routes'));
app.use('/api/v1/payment',          paymentRoutes.router);
app.use('/api/v1/trading',          require('./api/routes/trading.routes'));
app.use('/api/v1/market',           require('./api/routes/market.routes'));
app.use('/api/v1/defi',             require('./api/routes/defi.routes'));
app.use('/api/v1/wallet',           require('./api/routes/wallet.routes'));
app.use('/api/v1/addressbook',      require('./api/routes/addressbook.routes'));
app.use('/api/v1/transaction',      require('./api/routes/transaction.routes'));
app.use('/api/v1/user',             require('./api/routes/user.routes'));
app.use('/api/v1/user/notifications', require('./api/routes/notification.routes'));
app.use('/api/v1/portfolio',        require('./api/routes/portfolio.routes'));
app.use('/api/v1/analytics',        require('./api/routes/analytics.routes'));
app.use('/api/v1/ai',               require('./api/routes/ai.routes'));
app.use('/api/v1/learning',         require('./api/routes/learning.routes'));
app.use('/api/v1/security',         require('./api/routes/security.routes'));

// OpenAPI / Swagger docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));
app.get('/openapi.json', (req, res) => res.json(openapiDocument));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    websocket: { connections: wsServer.getConnectedClientsCount?.() || 0 },
    ai: {
      enabled: Boolean(config.gemini?.apiKey),
      model: config.gemini?.model || 'not configured',
      provider: 'Google Gemini',
      maxTokens: config.gemini?.maxTokens || 300,
    }
  });
});

// ── FIX: Return JSON 404 for unknown /api/* routes (BEFORE the SPA catch-all) ──
app.use('/api/v1/*', (req, res) => {
  res.status(404).json({ status: 'error', message: `API route not found: ${req.method} ${req.originalUrl}` });
});

// ── Static files and SPA fallback (only in production build) ──
const distPath = path.resolve(__dirname, '../../dist');
const fs = require('fs');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Error handling (must be last)
app.use(errorMiddleware);

// ── Server startup ─────────────────────────────────────────────────────────
// FIX: Use config port (3003 to match client proxy) not hardcoded 3001
const PORT = config.port || 3003;

async function startServer() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected');

    // Sync external learning content
    try {
      const externalContentService = require('./services/external-content.service');
      const results = await externalContentService.syncExternalContent();
      console.log('✅ External content synced:', results);
    } catch (err) {
      console.error('⚠️ External sync failed:', err.message);
    }

    // Auto-seed learning content if DB is empty
    try {
      const { Article, Video } = require('./models/learning.model');
      const [articleCount, videoCount] = await Promise.all([
        Article.estimatedDocumentCount(),
        Video.estimatedDocumentCount(),
      ]);
      if (articleCount === 0 && videoCount === 0) {
        console.log('📚 Learning DB is empty — running seed...');
        const seedDB = require('./utils/seed-learning');
        await seedDB();
        console.log('✅ Learning content seeded');
      }
    } catch (err) {
      console.warn('⚠️ Learning seed skipped:', err.message);
    }

    // Price broadcast job
    try {
      const { startPriceBroadcast } = require('./jobs/marketData.job');
      await startPriceBroadcast();
      console.log('✅ Price broadcast job started');
    } catch (err) {
      console.error('⚠️ Price broadcast failed:', err.message);
    }

    // Portfolio history snapshot job (daily at midnight UTC)
    try {
      const portfolioHistoryJob = require('./jobs/portfolio-history.job');
      cron.schedule('0 0 * * *', async () => {
        console.log('📸 Daily portfolio snapshot...');
        await portfolioHistoryJob.recordDailySnapshot();
      });

      // Run initial snapshot if none exist today
      const PortfolioHistory = require('./models/portfolio-history.model');
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const existing = await PortfolioHistory.findOne({ timestamp: { $gte: today } });
      if (!existing) {
        await portfolioHistoryJob.recordDailySnapshot();
        console.log('✅ Initial portfolio snapshot created');
      }
    } catch (err) {
      console.error('⚠️ Portfolio history job failed:', err.message);
    }

    // Price alert checking (every minute)
    try {
      const { checkPriceAlerts } = require('./jobs/alertCheck.job');
      cron.schedule('*/1 * * * *', async () => {
        try { await checkPriceAlerts(); } catch (e) { console.error('⚠️ Alert check error:', e.message); }
      });
      console.log('✅ Price alert checker scheduled');
    } catch (err) {
      console.warn('⚠️ Price alert checker skipped (job not found):', err.message);
    }

    const shutdown = async (signal) => {
      console.log(`[${signal}] Shutting down gracefully...`);
      try {
        await mongoose.connection.close();
      } catch (err) {
        console.error('Error closing MongoDB connection:', err);
      }

      try {
        if (redisClient?.isOpen) {
          await redisClient.quit();
        }
      } catch (err) {
        console.error('Error closing Redis client:', err);
      }

      httpServer.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });

      setTimeout(() => {
        console.error('Forced shutdown after 10 seconds.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Health: http://localhost:${PORT}/health`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    if (error?.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

startServer();

module.exports = app;
