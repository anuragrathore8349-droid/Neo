// server/src/jobs/alertCheck.job.js
const MarketAlert = require('../models/market-alert.model');
const marketService = require('../services/market.service');
const notificationService = require('../services/notification.service');
const { logger } = require('../api/middlewares/logger.middleware');

/**
 * Checks all active price alerts against current market prices.
 * Fires notifications and marks alerts as triggered when conditions are met.
 */
async function checkPriceAlerts() {
  try {
    // Get all active (un-triggered) alerts
    const alerts = await MarketAlert.find({ triggered: false, active: true }).lean();
    if (!alerts || alerts.length === 0) return;

    // Collect unique symbols
    const symbols = [...new Set(alerts.map(a => a.symbol))];

    // Fetch current prices from market service
    const prices = await marketService.getMarketPrices(symbols);

    const triggeredIds = [];

    for (const alert of alerts) {
      const priceData = prices[alert.symbol];
      if (!priceData || priceData.price == null) continue;

      const currentPrice = parseFloat(priceData.price);
      let shouldTrigger = false;

      if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
        shouldTrigger = true;
      } else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        triggeredIds.push(alert._id);

        // Send notification to user
        try {
          await notificationService.createNotification(alert.userId, {
            type: 'price_alert',
            title: `Price Alert: ${alert.symbol}`,
            message: `${alert.symbol} is now ${alert.condition} $${alert.targetPrice.toLocaleString()}. Current price: $${currentPrice.toLocaleString()}`,
            data: {
              symbol: alert.symbol,
              targetPrice: alert.targetPrice,
              currentPrice,
              condition: alert.condition,
            },
          });
        } catch (notifErr) {
          logger.error(`Failed to send price alert notification for ${alert.symbol}:`, notifErr.message);
        }
      }
    }

    // Batch-mark triggered alerts
    if (triggeredIds.length > 0) {
      await MarketAlert.updateMany(
        { _id: { $in: triggeredIds } },
        { $set: { triggered: true, triggeredAt: new Date() } }
      );
      logger.info(`Price alert job: ${triggeredIds.length} alert(s) triggered`);
    }
  } catch (error) {
    logger.error('checkPriceAlerts job error:', error.message);
    throw error;
  }
}

module.exports = { checkPriceAlerts };