const analyticsService = require('../../services/analytics.service');

class AnalyticsController {
  async getPerformanceAnalytics(req, res, next) {
    try {
      const { timeframe = '1m', metrics } = req.validatedData?.query || req.query;
      const data = await analyticsService.getPerformanceAnalytics(
        req.user.userId, timeframe, metrics ? metrics.split(',') : ['returns']
      );
      res.json({ status: 'success', data });
    } catch (error) { next(error); }
  }

  async getRiskMetrics(req, res, next) {
    try {
      const { timeframe = '3m' } = req.validatedData?.query || req.query;
      const data = await analyticsService.getRiskAssessment(req.user.userId, [], timeframe);
      res.json({ status: 'success', data });
    } catch (error) { next(error); }
  }

  async getAssetAllocation(req, res, next) {
    try {
      const data = await analyticsService.getAssetAllocation(req.user.userId);
      res.json({ status: 'success', data });
    } catch (error) { next(error); }
  }

  async getCorrelationMatrix(req, res, next) {
    try {
      const data = await analyticsService.getCorrelationMatrix(req.user.userId);
      res.json({ status: 'success', data });
    } catch (error) { next(error); }
  }

  async getBenchmarkComparison(req, res, next) {
    try {
      const { timeframe = '1m', benchmark = 'BTC' } = req.query;
      const data = await analyticsService.getBenchmarkComparison(
        req.user.userId, timeframe, benchmark
      );
      res.json({ status: 'success', data });
    } catch (error) { next(error); }
  }

  async getTaxReport(req, res, next) {
    try {
      const { year } = req.query;
      const data = await analyticsService.getTaxReport(req.user.userId, year || new Date().getFullYear());
      res.json({ status: 'success', data });
    } catch (error) { next(error); }
  }
}

module.exports = new AnalyticsController();
