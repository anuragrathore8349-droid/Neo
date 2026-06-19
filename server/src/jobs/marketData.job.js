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

// ── Live price broadcast (fixes the WebSocket timeout) ────────────────────────
marketDataQueue.process('priceUpdate', async (job) => {
  const { symbols } = job.data;
  try {
    const prices = await krakenService.getLivePrices(symbols);
    for (const [symbol, data] of Object.entries(prices)) {
      if (!data || data.price === null || data.price === undefined) continue;

      const priceData = {
        price:     data.price,
        change24h: data.change24h ?? 0,
        volume24h: data.volume24h ?? 0
      };

      if (redisClient && redisClient.isOpen) {
        await redisClient.setEx(`price:${symbol}`, 35, JSON.stringify({ ...priceData, timestamp: Date.now() }));
      }

      if (global.io) {
        // Pass full priceData object — market.handler now accepts this shape
        global.io.of('/market').to(`price:${symbol}`).emit('priceUpdate', {
          symbol,
          price:     priceData.price,
          change24h: priceData.change24h,
          volume24h: priceData.volume24h,
          timestamp: Date.now()
        });
      }
    }
    // Check price alerts after every broadcast
    await checkPriceAlerts(prices);
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
const startPriceBroadcast = async () => {
  try {
    const existing = await marketDataQueue.getRepeatableJobs();
    for (const job of existing) {
      if (job.name === 'priceUpdate') await marketDataQueue.removeRepeatableByKey(job.key);
    }
    await marketDataQueue.add(
      'priceUpdate',
      { symbols: TOP_SYMBOLS },
      { repeat: { every: 30_000 }, jobId: 'price-broadcast-top', removeOnComplete: 5, removeOnFail: 3 },
    );
    logger.info(`Price broadcast scheduled for: ${TOP_SYMBOLS.join(', ')}`);
  } catch (err) {
    logger.error('Failed to start price broadcast:', err.message);
  }
};

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
