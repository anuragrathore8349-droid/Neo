const Bull = require('bull');
const { redisClient }  = require('../config/database');
const tradingService   = require('../services/trading.service');
const krakenService    = require('../services/kraken.service');
const { logger }       = require('../api/middlewares/logger.middleware');
const bullRedisConfig  = require('../config/bullRedis');

const marketDataQueue  = new Bull('marketData', { redis: bullRedisConfig });

const TOP_SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK', 'UNI',
  'LTC', 'BNB', 'USDT', 'USDC', 'TRX', 'ALGO', 'ICP', 'FIL', 'ETC', 'POL',
];

// ── Order book ────────────────────────────────────────────────────────────────
marketDataQueue.process('orderbook', async (job) => {
  const { symbol } = job.data;
  try {
    const orderBook = await tradingService.getOrderBook(symbol);
    if (redisClient && redisClient.isOpen) {
      await redisClient.setEx(`orderbook:${symbol}`, 60, JSON.stringify(orderBook));
    }
    if (global.io) {
      global.io.of('/trading').to(`orderbook:${symbol}`).emit('orderbook', { symbol, data: orderBook });
    }
  } catch (err) {
    logger.error(`orderbook job failed [${symbol}]:`, err.message);
    throw err;
  }
});

// ── Recent trades ─────────────────────────────────────────────────────────────
marketDataQueue.process('trades', async (job) => {
  const { symbol } = job.data;
  try {
    const trades = await tradingService.getRecentTrades(symbol);
    if (redisClient && redisClient.isOpen) {
      await redisClient.setEx(`trades:${symbol}`, 60, JSON.stringify(trades));
    }
    if (global.io) {
      global.io.of('/trading').to(`trades:${symbol}`).emit('trades', { symbol, data: trades });
    }
  } catch (err) {
    logger.error(`trades job failed [${symbol}]:`, err.message);
    throw err;
  }
});

// ── Live price broadcast ───────────────────────────────────────────────────────
marketDataQueue.process('priceUpdate', async (job) => {
  const { symbols } = job.data;
  try {
    const prices = await krakenService.getLivePrices(symbols);
    const marketNsp = global.wsServer?.io?.of('/market');

    for (const [symbol, data] of Object.entries(prices)) {
      if (!data || data.price === null || data.price === undefined) continue;

      const priceData = {
        symbol,
        price:     data.price,
        change24h: data.change24h ?? 0,
        volume24h: data.volume24h ?? 0,
        timestamp: Date.now(),
      };

      // Cache in Redis
      if (redisClient?.isOpen) {
        await redisClient.setEx(`price:live:${symbol}`, 60, JSON.stringify(priceData)).catch(() => {});
      }

      // ✅ Emit to room-specific subscribers only
      if (marketNsp) {
        marketNsp.to(`price:${symbol}`).emit('priceUpdate', priceData);
      }

      // Also update global market handler broadcast
      if (global.marketHandler) {
        global.marketHandler.broadcastPriceUpdate(symbol, priceData);
      }
    }
    
    // Check price alerts after every broadcast
    await checkPriceAlerts(prices);
    
    // ✅ NEW: Trigger portfolio updates for all users when prices change
    // This ensures real-time P&L updates on the Dashboard
    await triggerPortfolioUpdates(symbols);
    
    logger.debug(`Price broadcast done for ${symbols.join(', ')}`);
  } catch (err) {
    logger.error('priceUpdate job failed:', err.message);
    throw err;
  }
});

// ── Schedule orderbook + trades for one symbol ────────────────────────────────
const scheduleMarketDataUpdates = async (symbol) => {
  try {
    const existing = await marketDataQueue.getRepeatableJobs();
    for (const job of existing) {
      if ((job.name === 'orderbook' || job.name === 'trades') && job.id?.includes(symbol)) {
        await marketDataQueue.removeRepeatableByKey(job.key);
      }
    }
    await marketDataQueue.add('orderbook', { symbol }, {
      repeat: { every: 5_000 }, jobId: `orderbook-${symbol}`,
      removeOnComplete: 5, removeOnFail: 3,
    });
    await marketDataQueue.add('trades', { symbol }, {
      repeat: { every: 10_000 }, jobId: `trades-${symbol}`,
      removeOnComplete: 5, removeOnFail: 3,
    });
    logger.info(`Scheduled market data updates for ${symbol}`);
  } catch (err) {
    logger.error(`Failed to schedule market data for ${symbol}:`, err.message);
  }
};

// ── Auto-start price broadcast on server boot ─────────────────────────────────
const BROADCAST_INTERVAL_MS = 15_000; // 15 seconds

async function startPriceBroadcastPolling() {
  logger.info('📡 Starting price broadcast via polling fallback (no Redis queue)');
  setInterval(async () => {
    try {
      const prices = await krakenService.getLivePrices(TOP_SYMBOLS);
      const marketNsp = global.wsServer?.io?.of('/market');
      if (!marketNsp) return;
      for (const [symbol, data] of Object.entries(prices)) {
        if (!data || data.price === null) continue;
        marketNsp.to(`price:${symbol}`).emit('priceUpdate', {
          symbol,
          price:     data.price,
          change24h: data.change24h ?? 0,
          volume24h: data.volume24h ?? 0,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      logger.error('Price broadcast polling error:', err.message);
    }
  }, BROADCAST_INTERVAL_MS);
}

async function startPriceBroadcast() {
  const { redisClient } = require('../config/database');

  if (redisClient && redisClient.isOpen) {
    // Use Bull queue (preferred)
    const existing = await marketDataQueue.getRepeatableJobs();
    for (const job of existing) {
      if (job.name === 'priceUpdate') await marketDataQueue.removeRepeatableByKey(job.key);
    }
    await marketDataQueue.add(
      'priceUpdate',
      { symbols: TOP_SYMBOLS },
      { repeat: { every: BROADCAST_INTERVAL_MS }, jobId: 'price-broadcast-top', removeOnComplete: 5, removeOnFail: 3 },
    );
    logger.info(`✅ Price broadcast started via Bull queue`);
  } else {
    // Fall back to polling
    await startPriceBroadcastPolling();
  }
}

// ── Portfolio Update Trigger ──────────────────────────────────────────────────
// ✅ NEW: When prices change, recalculate all user portfolios and broadcast updates
const Portfolio = require('../models/portfolio.model');
const PortfolioHistory = require('../models/portfolio-history.model');
const portfolioService = require('../services/portfolio.service');
const { subDays, startOfDay } = require('date-fns');

async function triggerPortfolioUpdates(changedSymbols) {
  try {
    // Find all portfolios that contain any of the changed symbols
    const portfolios = await Portfolio.find({
      'assets.symbol': { $in: changedSymbols }
    });

    if (!portfolios || portfolios.length === 0) {
      return; // No portfolios affected
    }

    logger.debug(`Updating ${portfolios.length} portfolios affected by price changes in: ${changedSymbols.join(', ')}`);

    // Recalculate metrics for each affected portfolio and broadcast update
    for (const portfolio of portfolios) {
      try {
        // Recalculate metrics with new prices (already updated by updatePortfolioMetrics)
        await portfolioService.updatePortfolioMetrics(portfolio);

        // Calculate change percentages from history efficiently
        const history = await PortfolioHistory.find({
          portfolioId: portfolio._id,
          timestamp: { $gte: subDays(startOfDay(new Date()), 30) }
        }).sort({ timestamp: 1 }).lean();

        const dailyChange = calculateChangeFromHistory(history, 1);
        const weeklyChange = calculateChangeFromHistory(history, 7);
        
        // Monthly: first vs last in history
        let monthlyChange = { value: 0, percentage: 0 };
        if (history && history.length > 1) {
          const currentValue = history[history.length - 1]?.totalValue || portfolio.totalValue || 0;
          const oldestValue = history[0]?.totalValue || 0;
          if (oldestValue > 0) {
            const change = currentValue - oldestValue;
            const percentage = (change / oldestValue) * 100;
            monthlyChange = {
              value: Number(change.toFixed(2)),
              percentage: Number(percentage.toFixed(2))
            };
          }
        }

        // Broadcast the updated summary with all P&L data
        if (global.portfolioHandler) {
          global.portfolioHandler.broadcastPortfolioUpdate(
            portfolio._id.toString(),
            {
              portfolioId: portfolio._id.toString(),
              totalValue: portfolio.totalValue || 0,
              totalCost: portfolio.totalCost || 0,
              totalProfit: portfolio.totalProfit || 0,
              totalProfitPercentage: portfolio.totalProfitPercentage || 0,
              allTimeProfit: portfolio.totalProfit || 0,
              allTimeProfitPercentage: portfolio.totalProfitPercentage || 0,
              dailyChange: dailyChange.value,
              dailyChangePercentage: dailyChange.percentage,
              weeklyChange: weeklyChange.value,
              weeklyChangePercentage: weeklyChange.percentage,
              monthlyChange: monthlyChange.value,
              monthlyChangePercentage: monthlyChange.percentage,
              assetCount: portfolio.assets.length,
              lastUpdated: portfolio.lastUpdated,
              assets: portfolio.assets.map(a => ({
                symbol: a.symbol,
                currentPrice: a.currentPrice,
                value: a.value,
                profit: a.profit,
                profitPercentage: a.profitPercentage,
                change24h: a.change24h
              }))
            }
          );
        }

        logger.debug(`Portfolio ${portfolio._id} metrics updated and broadcasted for user ${portfolio.userId}`);
      } catch (err) {
        logger.warn(`Failed to update portfolio ${portfolio._id}:`, err.message);
        // Continue with other portfolios
      }
    }
  } catch (err) {
    logger.error('Portfolio update trigger failed:', err.message);
    // Non-fatal error — don't let this crash the price broadcast
  }
}

// Helper function to calculate change from history
function calculateChangeFromHistory(history, days) {
  if (!history || history.length < 1) {
    return { value: 0, percentage: 0 };
  }

  const current = history[history.length - 1]?.totalValue || 0;
  if (current <= 0) {
    return { value: 0, percentage: 0 };
  }

  let past = null;
  if (days === 1) {
    past = history[history.length - 2]?.totalValue;
  } else if (history.length > 1) {
    const index = Math.max(0, history.length - days);
    past = history[index]?.totalValue;
  }

  if (!past || past <= 0) {
    return { value: 0, percentage: 0 };
  }

  const change = current - past;
  const percentage = (change / past) * 100;

  return {
    value: Number(change.toFixed(2)),
    percentage: Number(percentage.toFixed(2))
  };
}

// ── Price Alert Checker ────────────────────────────────────────────────────
const MarketAlert = require('../models/market-alert.model');

async function checkPriceAlerts(prices) {
  try {
    // Get all untriggered alerts for symbols we just fetched
    const symbols = Object.keys(prices);
    const alerts = await MarketAlert.find({
      symbol: { $in: symbols },
      isTriggered: false,
    });

    for (const alert of alerts) {
      const priceData = prices[alert.symbol];
      if (!priceData || priceData.price == null) continue;

      const currentPrice = priceData.price;
      let triggered = false;

      if (alert.type === 'above' && currentPrice >= alert.price) triggered = true;
      if (alert.type === 'below' && currentPrice <= alert.price) triggered = true;

      if (triggered) {
        alert.isTriggered = true;
        alert.triggeredAt = new Date();
        await alert.save();

        // Broadcast notification via WebSocket
        if (global.notificationHandler) {
          global.notificationHandler.broadcastNotification(alert.userId.toString(), {
            type: 'price_alert',
            title: `Price Alert: ${alert.symbol}`,
            message: `${alert.symbol} hit your target of $${alert.price.toLocaleString()}. Current price: $${currentPrice.toLocaleString()}`,
            symbol: alert.symbol,
            triggeredPrice: currentPrice,
            alertPrice: alert.price,
            alertType: alert.type,
            timestamp: new Date().toISOString(),
          });
        }
        logger.info(`Price alert triggered: ${alert.symbol} ${alert.type} $${alert.price} (current: $${currentPrice})`);
      }
    }
  } catch (err) {
    logger.error('Price alert check failed:', err.message);
  }
}

marketDataQueue.on('error',  (err)       => logger.error('Market data queue error:', err));
marketDataQueue.on('failed', (job, err)  => logger.error(`Job ${job.id} (${job.name}) failed:`, err.message));
marketDataQueue.on('stalled', (job)      => logger.warn(`Job stalled: ${job.id}`));

module.exports = { marketDataQueue, scheduleMarketDataUpdates, startPriceBroadcast, TOP_SYMBOLS };