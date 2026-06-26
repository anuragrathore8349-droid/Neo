'use strict';
const cron          = require('node-cron');
const MarketAlert   = require('../models/market-alert.model');
const Notification  = require('../models/notification.model');
const emailService  = require('../services/email.service');
const { logger }    = require('../api/middlewares/logger.middleware');
const krakenService = require('../services/kraken.service');

let _io = null;   // socket.io instance injected at startup

/**
 * Call this once from server/src/websockets/index.js after io is created:
 *   alertCheckJob.setIo(io);
 */
function setIo(io) {
  _io = io;
}

/**
 * Emit a real-time notification to the user's personal room.
 * This makes the bell icon badge increment immediately.
 */
async function _notifyUser(userId, alert, triggeredPrice) {
  try {
    const message = `${alert.symbol} hit your alert: $${triggeredPrice.toFixed(2)} (${alert.condition} $${alert.targetPrice})`;

    logger.info(`[AlertCheck] Creating notification for user: ${userId}, symbol: ${alert.symbol}`);

    // Persist to DB so it shows in notification history
    const notif = await Notification.create({
      userId,
      type:     'alert',
      title:    `Price Alert: ${alert.symbol}`,
      message,
      icon:     'AlertCircle',
      severity: 'warning',
      isRead:   false,
      metadata: { symbol: alert.symbol, alertPrice: alert.targetPrice, triggeredAt: triggeredPrice },
    });

    logger.info(`[AlertCheck] Notification created in DB: ${notif._id}`);

    // Emit via socket to the user's room
    if (_io) {
      const room = `user:${userId.toString()}`;
      logger.info(`[AlertCheck] Emitting to /notifications room: ${room}`);
      
      _io.of('/notifications')
        .to(room)
        .emit('notification', { data: notif.toObject() });

      logger.info(`[AlertCheck] ✅ Notification emitted to /notifications namespace for user ${userId}`);

      // Also emit to /trading namespace so the trading page can react
      logger.info(`[AlertCheck] Emitting to /trading room: ${room}`);
      
      _io.of('/trading')
        .to(room)
        .emit('priceAlert', {
          symbol:        alert.symbol,
          alertPrice:    alert.targetPrice,
          triggeredPrice,
          condition:     alert.condition,
          message,
        });

      logger.info(`[AlertCheck] ✅ Alert event emitted to /trading namespace for user ${userId}`);
    } else {
      logger.warn('[AlertCheck] WebSocket IO not initialized - notifications won\'t be sent');
    }

    logger.info(`[AlertCheck] Notification sent to user ${userId} for ${alert.symbol}`);
  } catch (err) {
    logger.error('[AlertCheck] Failed to send notification:', err.message);
  }
}

async function checkAlerts() {
  try {
    logger.info('[AlertCheck] 🔍 Starting alert check...');
    
    const activeAlerts = await MarketAlert.find({ active: true, triggered: false })
      .populate('userId', '_id email name')
      .lean();

    logger.info(`[AlertCheck] Found ${activeAlerts.length} active alerts to check`);
    if (!activeAlerts.length) {
      logger.info('[AlertCheck] No active alerts found');
      return;
    }

    // Group symbols for a single batch Kraken call
    const symbols = [...new Set(activeAlerts.map(a => a.symbol))];
    logger.info(`[AlertCheck] Checking prices for symbols: ${symbols.join(', ')}`);
    
    let prices = {};
    try {
      prices = await krakenService.getLivePrices(symbols);
      logger.info(`[AlertCheck] ✅ Got prices from Kraken: ${JSON.stringify(prices)}`);
    } catch (err) {
      logger.warn('[AlertCheck] Kraken price fetch failed:', err.message);
      return;
    }

    for (const alert of activeAlerts) {
      const priceData     = prices[alert.symbol];
      const currentPrice  = priceData?.price;
      
      logger.info(`[AlertCheck] Checking ${alert.symbol}: current=$${currentPrice}, target=$${alert.targetPrice}, condition=${alert.condition}`);
      
      if (!currentPrice || isNaN(currentPrice)) {
        logger.warn(`[AlertCheck] ⚠️ No valid price for ${alert.symbol}`);
        continue;
      }

      const shouldTrigger =
        (alert.condition === 'above' && currentPrice >= alert.targetPrice) ||
        (alert.condition === 'below' && currentPrice <= alert.targetPrice);

      if (!shouldTrigger) {
        logger.debug(`[AlertCheck] ❌ ${alert.symbol} condition not met`);
        continue;
      }

      logger.info(`[AlertCheck] 🎯 Alert triggered: ${alert.symbol} at $${currentPrice} (condition: ${alert.condition} $${alert.targetPrice})`);

      // Mark as triggered
      await MarketAlert.findByIdAndUpdate(alert._id, {
        triggered:   true,
        triggeredAt: new Date(),
        active:    false,
      });

      const userId = alert.userId?._id || alert.userId;
      logger.info(`[AlertCheck] Sending notifications to userId: ${userId}`);

      // Send email
      try {
        await emailService.sendPriceAlertEmail({
          to:      alert.userId?.email,
          name:    alert.userId?.name || 'Trader',
          symbol:  alert.symbol,
          condition: alert.condition,
          alertPrice: alert.targetPrice,
          currentPrice,
        });
        logger.info(`[AlertCheck] ✅ Email sent to ${alert.userId?.email}`);
      } catch (emailErr) {
        logger.error('[AlertCheck] Email send failed:', emailErr.message);
      }

      // Push real-time notification (NEW — this was missing)
      await _notifyUser(userId, alert, currentPrice);
    }
  } catch (err) {
    logger.error('[AlertCheck] Job error:', err.message);
  }
}

// Run every 60 seconds
const job = cron.schedule('* * * * *', checkAlerts, { scheduled: false });

module.exports = { job, setIo, checkAlerts, checkPriceAlerts: checkAlerts };