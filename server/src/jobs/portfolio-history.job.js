// server/src/jobs/portfolio-history.job.js
const Portfolio        = require('../models/portfolio.model');
const PortfolioHistory = require('../models/portfolio-history.model');
const { logger }       = require('../api/middlewares/logger.middleware');

class PortfolioHistoryJob {

  async recordDailySnapshot() {
    try {
      const portfolios = await Portfolio.find({});
      const timestamp  = new Date();
      const snapshots  = [];

      for (const portfolio of portfolios) {
        if (portfolio.totalValue === null || portfolio.totalValue === undefined || typeof portfolio.totalValue !== 'number') {
          logger.debug(`Skipping snapshot for portfolio ${portfolio._id}: invalid totalValue`);
          continue;
        }

        const validAssets = portfolio.assets.filter(
          a => a.value !== null && a.value !== undefined && typeof a.value === 'number'
        );
        if (validAssets.length === 0) {
          logger.debug(`Skipping snapshot for portfolio ${portfolio._id}: no assets with valid values`);
          continue;
        }

        // Calculate period returns from actual history
        const [daily, weekly, monthly, yearly] = await Promise.all([
          this._calcReturnFromHistory(portfolio._id, portfolio.totalValue, 1),
          this._calcReturnFromHistory(portfolio._id, portfolio.totalValue, 7),
          this._calcReturnFromHistory(portfolio._id, portfolio.totalValue, 30),
          this._calcReturnFromHistory(portfolio._id, portfolio.totalValue, 365),
        ]);

        const snapshot = new PortfolioHistory({
          portfolioId: portfolio._id,
          userId:      portfolio.userId,
          timestamp,
          totalValue:  portfolio.totalValue,
          assets: portfolio.assets.map(asset => ({
            symbol: asset.symbol,
            amount: asset.amount,
            value:  asset.value  != null ? asset.value  : 0,
            price:  asset.currentPrice != null ? asset.currentPrice : 0,
          })),
          metrics: {
            dailyReturn:   daily,
            weeklyReturn:  weekly,
            monthlyReturn: monthly,
            yearlyReturn:  yearly,
          },
        });

        snapshots.push(snapshot);
      }

      if (snapshots.length > 0) {
        await PortfolioHistory.insertMany(snapshots);
        logger.info(`Recorded portfolio snapshots for ${snapshots.length} portfolios`);
      } else {
        logger.info('No portfolios with valid data to snapshot');
      }
    } catch (error) {
      logger.error('Error recording portfolio snapshots:', error);
    }
  }

  /**
   * Calculate percentage return over the last `days` days for a portfolio.
   * Returns 0 if no historical snapshot exists for that window.
   */
  async _calcReturnFromHistory(portfolioId, currentValue, days) {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      // Find the oldest snapshot within the window
      const earliest = await PortfolioHistory.findOne({
        portfolioId,
        timestamp: { $gte: since },
      }).sort({ timestamp: 1 }).lean();

      if (!earliest || earliest.totalValue <= 0) return 0;
      return parseFloat(
        (((currentValue - earliest.totalValue) / earliest.totalValue) * 100).toFixed(4)
      );
    } catch {
      return 0;
    }
  }

  async cleanupOldSnapshots() {
    const retentionPeriod = 365;
    const cutoffDate      = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionPeriod);

    try {
      const result = await PortfolioHistory.deleteMany({ timestamp: { $lt: cutoffDate } });
      logger.info(`Cleaned up ${result.deletedCount} old portfolio snapshots`);
    } catch (error) {
      logger.error('Error cleaning up old portfolio snapshots:', error);
    }
  }
}

module.exports = new PortfolioHistoryJob();