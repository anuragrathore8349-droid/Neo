// server/src/jobs/alertCheck.job.js
const MarketAlert = require('../models/market-alert.model');
const User = require('../models/user.model');
const marketService = require('../services/market.service');
const notificationService = require('../services/notification.service');
const emailService = require('../services/email.service');
const config = require('../config');
const { logger } = require('../api/middlewares/logger.middleware');

/**
 * Checks all active price alerts against current market prices.
 * Fires notifications and marks alerts as triggered when conditions are met.
 */
async function checkPriceAlerts() {
  try {
    // Get all active (un-triggered) alerts
    const alerts = await MarketAlert.find({ triggered: false, active: true }).lean();
    if (!alerts || alerts.length === 0) {
      logger.debug('No active price alerts to check');
      return;
    }

    logger.info(`🔔 Checking ${alerts.length} price alert(s)...`);

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

        // Fetch user to get email
        const user = await User.findById(alert.userId).select('email firstName lastName').lean();
        if (!user) continue;

        // Create in-app notification
        try {
          const notification = await notificationService.createNotification(alert.userId, {
            type: 'alert',
            title: `Price Alert: ${alert.symbol}`,
            message: `${alert.symbol} is now ${alert.condition} $${alert.targetPrice.toLocaleString()}. Current price: $${currentPrice.toLocaleString()}`,
            severity: alert.condition === 'above' ? 'success' : 'warning',
            icon: 'Bell',
            metadata: {
              symbol: alert.symbol,
              targetPrice: alert.targetPrice,
              currentPrice,
              condition: alert.condition,
            },
          });
          logger.info(`✅ Notification created for user ${alert.userId}:`, notification._id);
        } catch (notifErr) {
          logger.error(`Failed to create in-app notification for ${alert.symbol}:`, notifErr.message);
        }

        // Send email if enabled
        if (alert.notificationTypes && alert.notificationTypes.includes('email')) {
          try {
            await emailService.sendEmail({
              to: user.email,
              subject: `🔔 Price Alert: ${alert.symbol}`,
              template: 'priceAlert',
              context: {
                name: user.firstName,
                symbol: alert.symbol,
                condition: alert.condition,
                targetPrice: alert.targetPrice.toLocaleString(),
                currentPrice: currentPrice.toLocaleString(),
                actionUrl: `${config.appUrl}/trading?symbol=${alert.symbol}`,
              },
            });
            logger.info(`✅ Price alert email sent to ${user.email} for ${alert.symbol}`);
          } catch (emailErr) {
            logger.error(`Failed to send email for ${alert.symbol} to ${user.email}:`, emailErr.message);
          }
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
