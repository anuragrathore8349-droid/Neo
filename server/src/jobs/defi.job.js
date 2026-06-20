// FILE: src/jobs/defi.job.js
// REPLACE ENTIRE FILE

'use strict';

const Bull        = require('bull');
const bullRedisConfig = require('../config/bullRedis');
const { logger }  = require('../api/middlewares/logger.middleware');
const DefiPosition = require('../models/defi-position.model');
const DefiChart   = require('../models/defi-chart.model');
const priceService = require('../services/price.service');

const defiQueue = new Bull('defi', { redis: bullRedisConfig });

// ─── Symbol → CoinGecko ID ────────────────────────────────────────────────
function symbolToCoinId(symbol) {
  const map = {
    ETH: 'ethereum', stETH: 'lido-staked-ether',
    AAVE: 'aave', CRV: 'curve-dao-token',
    UNI: 'uniswap', WBTC: 'bitcoin',
    MATIC: 'matic-network', LINK: 'chainlink'
  };
  return map[symbol] || symbol?.toLowerCase() || 'ethereum';
}

// ─── PROCESS: update all active position values ───────────────────────────
defiQueue.process('updatePositions', async (job) => {
  try {
    const positions = await DefiPosition.find({ status: 'active' });
    await Promise.all(positions.map(updatePosition));
    logger.info(`Updated ${positions.length} DeFi positions`);
  } catch (error) {
    logger.error('Error updating DeFi positions:', error.message);
    throw error;
  }
});

defiQueue.process('syncPrices', async (job) => {
  try {
    const positions = await DefiPosition.find({ status: 'active' });
    await Promise.all(positions.map(updatePosition));
    logger.info('Price sync complete');
  } catch (error) {
    logger.error('syncPrices failed:', error.message);
    throw error;
  }
});

defiQueue.process('updateCharts', async (job) => {
  try {
    const defiService = require('../services/defi.service');
    await defiService.fetchYieldFarmsData(); // triggers DefiChart.getOrCreateChart internally
    logger.info('Charts updated');
  } catch (error) {
    logger.error('updateCharts failed:', error.message);
    throw error;
  }
});

defiQueue.process('claimRewards', async (job) => {
  try {
    const { positionId } = job.data;
    const position = await DefiPosition.findById(positionId);
    if (!position) throw new Error('Position not found');
    await emitClaimReady(position);
    logger.info(`Claim ready emitted for position ${positionId}`);
  } catch (error) {
    logger.error('claimRewards job failed:', error.message);
    throw error;
  }
});

// ─── Update a single position's value in DB ───────────────────────────────
async function updatePosition(position) {
  try {
    const assetSymbol = position.asset?.symbol;
    if (!assetSymbol) return;

    const coinId = symbolToCoinId(assetSymbol);
    const price  = await priceService.getPrice(coinId);
    if (!price) return;

    const amount = parseFloat(position.asset?.amount || 0);
    const currentValue = amount * price;

    const apy = position.apy || 0;
    const daysSince = (Date.now() - (position.lastClaimedAt || position.startedAt || position.createdAt)) / 86400000;
    const accruedReward = currentValue * (apy / 100) / 365 * Math.max(0, daysSince);

    await DefiPosition.findByIdAndUpdate(position._id, {
      'asset.currentValue': currentValue,
      'rewards.accrued':    accruedReward,
      lastUpdated:          new Date()
    });

    // Store daily chart point
    try {
      const chart = await DefiChart.findOne({ entityId: position._id.toString(), entityType: 'staking', metric: 'price' })
        || new DefiChart({ entityId: position._id.toString(), entityType: 'staking', metric: 'price', data: [] });
      const today = new Date(); today.setHours(0,0,0,0);
      const exists = chart.data.some(d => { const dd = new Date(d.date); dd.setHours(0,0,0,0); return dd.getTime() === today.getTime(); });
      if (!exists) { chart.data.push({ date: today, value: currentValue }); if (chart.data.length > 90) chart.data.shift(); await chart.save(); }
    } catch (_) {}
  } catch (err) {
    logger.error(`updatePosition failed for ${position._id}:`, err.message);
  }
}

// ─── Emit claim-ready via socket if available ─────────────────────────────
async function emitClaimReady(position) {
  if (global.io) {
    global.io.of('/defi')
      .to(`user:${position.userId}`)
      .emit('claim:ready', { positionId: position._id });
  }
}

// ─── Schedule (clear duplicates first) ───────────────────────────────────
const schedulePositionUpdates = async () => {
  try {
    await defiQueue.add('updatePositions', {}, { repeat: { every: 5 * 60 * 1000 }, removeOnComplete: 5, removeOnFail: 3 });
  } catch (err) {
    logger.error('schedulePositionUpdates failed:', err.message);
  }
};

const scheduleRewardClaim = async (positionId) => {
  try {
    await defiQueue.add('claimRewards', { positionId }, { delay: 24 * 60 * 60 * 1000, removeOnComplete: 5, removeOnFail: 3 });
  } catch (err) {
    logger.error('scheduleRewardClaim failed:', err.message);
  }
};

// ─── Auto-start on boot — clear old repeat jobs first ─────────────────────
async function initDefiJobs() {
  try {
    const existing = await defiQueue.getRepeatableJobs();
    for (const job of existing) {
      await defiQueue.removeRepeatableByKey(job.key);
    }
    await defiQueue.add('syncPrices',       {}, { repeat: { every: 5  * 60 * 1000 }, removeOnComplete: 5, removeOnFail: 3 });
    await defiQueue.add('updateCharts',     {}, { repeat: { every: 6  * 60 * 60 * 1000 }, removeOnComplete: 5, removeOnFail: 3 });
    await defiQueue.add('updatePositions',  {}, { repeat: { every: 5  * 60 * 1000 }, removeOnComplete: 5, removeOnFail: 3 });
    logger.info('DeFi jobs initialized');
  } catch (err) {
    logger.error('initDefiJobs failed:', err.message);
  }
}

defiQueue.on('error',   err       => logger.error('DeFi queue error:',             err.message));
defiQueue.on('failed',  (job, err) => logger.error(`DeFi job ${job.id} failed:`,   err.message));
defiQueue.on('stalled', job       => logger.warn(`DeFi job stalled: ${job.id}`));

initDefiJobs();

module.exports = { defiQueue, schedulePositionUpdates, scheduleRewardClaim };