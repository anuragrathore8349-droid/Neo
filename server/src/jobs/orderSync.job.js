'use strict';

const Bull = require('bull');
const bullRedisConfig = require('../config/bullRedis');
const Order = require('../models/order.model');
const tradingService = require('../services/trading.service');
const { logger } = require('../api/middlewares/logger.middleware');

const orderSyncQueue = new Bull('order-sync', { redis: bullRedisConfig });

// Process order sync jobs
orderSyncQueue.process(async (job) => {
  const { orderId } = job.data;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      logger.warn(`[OrderSync] Order ${orderId} not found`);
      return;
    }

    // Skip paper and already-terminal orders
    if (
      order.exchange === 'paper' ||
      ['filled', 'cancelled', 'expired', 'rejected'].includes(order.status)
    ) {
      return;
    }

    await tradingService.syncOrderStatus(order);
    logger.info(`[OrderSync] Synced order ${orderId}`);
  } catch (err) {
    logger.error(`[OrderSync] Failed to sync order ${orderId}:`, err.message);
    throw err; // Bull will retry
  }
});

/**
 * Schedule sync for a newly placed order.
 * Checks at 5s, 15s, 60s, 5min, 15min intervals.
 */
async function scheduleOrderSync(orderId) {
  const delays = [5_000, 15_000, 60_000, 300_000, 900_000];
  for (const delay of delays) {
    await orderSyncQueue.add({ orderId }, {
      delay,
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}

orderSyncQueue.on('failed', (job, err) => {
  logger.error(`[OrderSync] Job failed for order ${job.data.orderId}:`, err.message);
});

module.exports = {
  orderSyncQueue,
  scheduleOrderSync
};