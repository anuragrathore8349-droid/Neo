const analyticsService = require('../../services/analytics.service');
const { logger } = require('../middlewares/logger.middleware');

class AnalyticsController {
  async getPerformance(req, res, next) {
    try {
      const { timeframe, metrics } = req.validatedData.query || {};
      const performance = await analyticsService.getPerformanceAnalytics(
        req.user.userId,
        timeframe,
        metrics
      );
      res.json({
        status: 'success',
        data: performance
      });
    } catch (error) {
      next(error);
    }
  }

  async getRisk(req, res, next) {
    try {
      const { assets, timeframe } = req.validatedData.query || {};
      const risk = await analyticsService.getRiskAssessment(
        req.user.userId,
        assets,
        timeframe
      );
      res.json({
        status: 'success',
        data: risk
      });
    } catch (error) {
      next(error);
    }
  }

  async getPredictions(req, res, next) {
    try {
      const { symbol, timeframe } = req.validatedData.query || {};
      const predictions = await analyticsService.getPricePredictions(
        symbol,
        timeframe
      );
      res.json({
        status: 'success',
        data: predictions
      });
    } catch (error) {
      next(error);
    }
  }

  async getSentiment(req, res, next) {
    try {
      const { symbol, sources } = req.validatedData.query || {};
      const sentiment = await analyticsService.getMarketSentiment(
        symbol,
        sources
      );
      res.json({
        status: 'success',
        data: sentiment
      });
    } catch (error) {
      next(error);
    }
  }

  async getOpportunities(req, res, next) {
    try {
      const { type, filters } = req.validatedData.query || {};
      const opportunities = await analyticsService.getInvestmentOpportunities(
        req.user.userId,
        type,
        filters
      );
      res.json({
        status: 'success',
        data: opportunities
      });
    } catch (error) {
      next(error);
    }
  }

  async generateCustomReport(req, res, next) {
    try {
      const report = await analyticsService.generateCustomReport(
        req.user.userId,
        req.validatedData.body
      );
      res.json({
        status: 'success',
        data: report
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AnalyticsController();