// REPLACE THE ENTIRE FILE WITH:
const analyticsService = require('../../services/analytics.service');

class AnalyticsController {
  async getPerformanceAnalytics(req, res, next) {
    try {
      const { timeframe = '1m', metrics } = req.validatedData?.query || req.query;
      // FIX: metrics from Zod is already an array; from raw query it's a string
      const metricsArray = Array.isArray(metrics)
        ? metrics
        : typeof metrics === 'string'
          ? metrics.split(',')
          : ['returns'];
      const data = await analyticsService.getPerformanceAnalytics(
        req.user.userId, timeframe, metricsArray
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
      const data = await analyticsService.getTaxReport(
        req.user.userId, year || new Date().getFullYear()
      );
      res.json({ status: 'success', data });
    } catch (error) { next(error); }
  }

  // ADD MISSING: AI-powered analytics endpoints
  async getPricePredictions(req, res, next) {
    try {
      const { symbol, timeframe = '1d' } = req.query;
      if (!symbol) return res.status(400).json({ status: 'error', message: 'symbol is required' });
      const data = await analyticsService.getPricePredictions(symbol, timeframe);
      res.json({ status: 'success', data });
    } catch (error) { next(error); }
  }

  async getMarketSentiment(req, res, next) {
    try {
      const { symbol, sources } = req.query;
      if (!symbol) return res.status(400).json({ status: 'error', message: 'symbol is required' });
      const srcArray = sources ? (Array.isArray(sources) ? sources : sources.split(',')) : ['news', 'technical'];
      const data = await analyticsService.getMarketSentiment(symbol, srcArray);
      res.json({ status: 'success', data });
    } catch (error) { next(error); }
  }

  async getInvestmentOpportunities(req, res, next) {
    try {
      const { type = 'all' } = req.query;
      const data = await analyticsService.getInvestmentOpportunities(req.user.userId, type);
      res.json({ status: 'success', data });
    } catch (error) { next(error); }
  }

  async generateCustomReport(req, res, next) {
    try {
      const data = await analyticsService.generateCustomReport(req.user.userId, req.body);
      res.json({ status: 'success', data });
    } catch (error) { next(error); }
  }
}

module.exports = new AnalyticsController();