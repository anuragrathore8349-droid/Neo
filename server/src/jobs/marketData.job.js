// server/src/jobs/marketData.job.js
'use strict';

const Bull          = require('bull');
const { redisClient } = require('../config/database');
const tradingService  = require('../services/trading.service');
const krakenService   = require('../services/kraken.service');
const { logger }      = require('../api/middlewares/logger.middleware');
const bullRedisConfig = require('../config/bullRedis');

const marketDataQueue = new Bull('marketData', { redis: bullRedisConfig });

const TOP_SYMBOLS = [
  'BTC','ETH','SOL','XRP','ADA','DOGE','AVAX','DOT','LINK','UNI',
  'LTC','BNB','USDT','USDC','TRX','ALGO','ICP','FIL','ETC','POL',
];

// ── Processors ────────────────────────────────────────────────────────────────

marketDataQueue.process('orderbook', async (job) => {
  const { symbol } = job.data;
  try {
    const orderBook = await tradingService.getOrderBook(symbol);
    if (redisClient?.isOpen) {
      await redisClient.setEx(`orderbook:${symbol}`, 60, JSON.stringify(orderBook)).catch(() => {});
    }
    if (global.tradingHandler) {
      global.tradingHandler.broadcastOrderBook(symbol, orderBook);
    }
  } catch (err) {
    logger.error(`orderbook job failed [${symbol}]:`, err.message);
    throw err;
  }
});

marketDataQueue.process('trades', async (job) => {
  const { symbol } = job.data;
  try {
    const trades = await tradingService.getRecentTrades(symbol);
    if (redisClient?.isOpen) {
      await redisClient.setEx(`trades:${symbol}`, 60, JSON.stringify(trades)).catch(() => {});
    }
    if (global.tradingHandler) {
      trades.forEach(t => global.tradingHandler.broadcastTrade(symbol, t));
    }
  } catch (err) {
    logger.error(`trades job failed [${symbol}]:`, err.message);
    throw err;
  }
});

marketDataQueue.process('priceUpdate', async (job) => {
  const { symbols } = job.data;
  try {
    const prices    = await krakenService.getLivePrices(symbols);
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

      if (redisClient?.isOpen) {
        await redisClient.setEx(`price:live:${symbol}`, 60, JSON.stringify(priceData)).catch(() => {});
      }

      if (marketNsp) {
        marketNsp.to(`price:${symbol}`).emit('priceUpdate', priceData);
      }

      if (global.marketHandler) {
        global.marketHandler.broadcastPriceUpdate(symbol, priceData);
      }
    }
  } catch (err) {
    logger.error('priceUpdate job failed:', err.message);
    throw err;
  }
});

// ── Scheduler ─────────────────────────────────────────────────────────────────

/**
 * Called by server/index.js on startup.
 * Schedules repeating price broadcast jobs.
 */
async function startPriceBroadcast() {
  // Clear any stale jobs
  await marketDataQueue.empty().catch(() => {});

  // Price update every 10 seconds
  await marketDataQueue.add(
    'priceUpdate',
    { symbols: TOP_SYMBOLS },
    { repeat: { every: 10_000 }, removeOnComplete: 5, removeOnFail: 3 }
  );

  // Orderbook refresh every 5 seconds for top 5 assets
  for (const sym of TOP_SYMBOLS.slice(0, 5)) {
    await marketDataQueue.add(
      'orderbook',
      { symbol: sym },
      { repeat: { every: 5_000 }, removeOnComplete: 3, removeOnFail: 2 }
    );
  }

  logger.info(`[MarketData] Jobs scheduled for ${TOP_SYMBOLS.length} symbols`);
}

marketDataQueue.on('failed', (job, err) => {
  logger.error(`[MarketData] Job ${job.name} failed:`, err.message);
});

module.exports = { startPriceBroadcast };
