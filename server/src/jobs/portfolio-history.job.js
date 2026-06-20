const { format } = require('date-fns');
const Portfolio = require('../models/portfolio.model');
const PortfolioHistory = require('../models/portfolio-history.model');
const { logger } = require('../api/middlewares/logger.middleware');

class PortfolioHistoryJob {
  async recordDailySnapshot() {
    try {
      const portfolios = await Portfolio.find({});
      const timestamp = new Date();
      const snapshots = [];

      for (const portfolio of portfolios) {
        // CRITICAL FIX: Only save snapshots with valid totalValue
        // Skip if portfolio has no valid data yet
        if (portfolio.totalValue === null || portfolio.totalValue === undefined || typeof portfolio.totalValue !== 'number') {
          logger.debug(`Skipping snapshot for portfolio ${portfolio._id}: invalid totalValue`);
          continue;
        }

        // Also skip if all assets have no value (portfolio not yet funded)
        const validAssets = portfolio.assets.filter(a => a.value !== null && a.value !== undefined && typeof a.value === 'number');
        if (validAssets.length === 0) {
          logger.debug(`Skipping snapshot for portfolio ${portfolio._id}: no assets with valid values`);
          continue;
        }

        const snapshot = new PortfolioHistory({
          portfolioId: portfolio._id,
          userId: portfolio.userId,
          timestamp,
          totalValue: portfolio.totalValue,
          assets: portfolio.assets.map(asset => ({
            symbol: asset.symbol,
            amount: asset.amount,
            value: asset.value !== null && asset.value !== undefined ? asset.value : 0,
            price: asset.currentPrice !== null && asset.currentPrice !== undefined ? asset.currentPrice : 0
          })),
          metrics: {
            dailyReturn: portfolio.dailyChange !== null && portfolio.dailyChange !== undefined ? portfolio.dailyChange : 0,
            weeklyReturn: this.calculateReturn(portfolio, 7),
            monthlyReturn: this.calculateReturn(portfolio, 30),
            yearlyReturn: this.calculateReturn(portfolio, 365)
          }
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

  calculateReturn(portfolio, days) {
    // This would use historical data to calculate actual returns
    // Placeholder implementation
    return portfolio.totalProfitPercentage;
  }

  async cleanupOldSnapshots() {
    const retentionPeriod = 365; // Keep one year of daily snapshots
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionPeriod);

    try {
      const result = await PortfolioHistory.deleteMany({
        timestamp: { $lt: cutoffDate }
      });
      logger.info(`Cleaned up ${result.deletedCount} old portfolio snapshots`);
    } catch (error) {
      logger.error('Error cleaning up old portfolio snapshots:', error);
    }
  }
}

module.exports = new PortfolioHistoryJob();