const aiService = require('../../services/ai.service');
const { logger } = require('../middlewares/logger.middleware');
const { success } = require('../../utils/responseNormaliser');

class AIController {
  async getPricePredictions(req, res, next) {
    try {
      const { symbol } = req.validatedData.params;
      const { timeframe, horizon } = req.validatedData.query || {};

      const predictions = await aiService.getPricePredictions(symbol, timeframe, horizon);
      res.json(success(predictions, { dataSource: 'kraken' }));
    } catch (error) {
      next(error);
    }
  }

  async getMarketSentiment(req, res, next) {
    try {
      const { symbol } = req.validatedData.params;
      const { sources, timeframe } = req.validatedData.query || {};

      const sentiment = await aiService.getMarketSentiment(symbol, sources, timeframe);
      res.json(success(sentiment, { dataSource: 'kraken' }));
    } catch (error) {
      next(error);
    }
  }

  async getRiskAssessment(req, res, next) {
    try {
      const { assets, timeframe } = req.validatedData.body;

      // Pass assets array directly — service now accepts both (userId) and (assets[])
      const assessment = await aiService.getRiskAssessment(assets, timeframe);
      res.json(success(assessment, { dataSource: 'kraken' }));
    } catch (error) {
      next(error);
    }
  }

  async getInvestmentOpportunities(req, res, next) {
    try {
      const opportunities = await aiService.getInvestmentOpportunities(
        req.validatedData.query
      );
      res.json(success(opportunities, { dataSource: 'kraken' }));
    } catch (error) {
      next(error);
    }
  }

  async optimizePortfolio(req, res, next) {
    try {
      const { assets, constraints, objective } = req.validatedData.body;

      const optimization = await aiService.optimizePortfolio(assets, constraints, objective);
      res.json(success(optimization, { dataSource: 'kraken' }));
    } catch (error) {
      next(error);
    }
  }

  async getStrategyRecommendations(req, res, next) {
    try {
      const { portfolio, preferences } = req.validatedData.body;

      const recommendations = await aiService.getStrategyRecommendations(portfolio, preferences);
      res.json(success(recommendations, { dataSource: 'kraken' }));
    } catch (error) {
      next(error);
    }
  }

  async detectPatterns(req, res, next) {
    try {
      const { symbol } = req.validatedData.params;
      const { timeframe, patterns } = req.validatedData.query || {};

      const detectedPatterns = await aiService.detectPatterns(symbol, timeframe, patterns);
      res.json(success(detectedPatterns, { dataSource: 'kraken' }));
    } catch (error) {
      next(error);
    }
  }

  async analyzeNews(req, res, next) {
    try {
      const { symbols, categories, timeframe, limit } = req.validatedData.query || {};

      const analysis = await aiService.analyzeNews(symbols, categories, timeframe, limit);
      res.json(success(analysis, { dataSource: 'kraken' }));
    } catch (error) {
      next(error);
    }
  }

  async detectAnomalies(req, res, next) {
    try {
      const body = req.validatedData.body;
      const data = body.data || body.assets?.map(s => ({ symbol: s, metrics: {} })) || [];
      const { sensitivity = 0.5, timeframe = '7d' } = body;

      const anomalies = await aiService.detectAnomalies(data, sensitivity, timeframe);
      res.json(success(anomalies, { dataSource: 'kraken' }));
    } catch (error) {
      next(error);
    }
  }

  async getPersonalizedInsights(req, res, next) {
    try {
      // userId comes from the auth middleware JWT
      const userId = req.user?.userId || req.user?.id || 'anonymous';
      const insights = await aiService.getPersonalizedInsights(userId);

      res.json(success(insights, { dataSource: 'kraken' }));
    } catch (error) {
      next(error);
    }
  }

  async getFearGreedIndex(req, res, next) {
    try {
      const data = await aiService.getFearGreedIndex();
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }

  async getBTCDominance(req, res, next) {
    try {
      const data = await aiService.getBTCDominance();
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }

  async getTrendingCoins(req, res, next) {
    try {
      const data = await aiService.getTrendingCoins();
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }

  // NEW: single endpoint that bundles fear/greed + dominance + trending + spot prices
  async getMarketOverview(req, res, next) {
    try {
      const data = await aiService.getMarketOverview();
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AIController();