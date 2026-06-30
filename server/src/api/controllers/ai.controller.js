const aiService = require('../../services/ai.service');
const { logger } = require('../middlewares/logger.middleware');
const { success } = require('../../utils/responseNormaliser');

class AIController {
  constructor() {
    Object.getOwnPropertyNames(AIController.prototype)
      .filter((name) => name !== 'constructor' && typeof AIController.prototype[name] === 'function')
      .forEach((name) => {
        this[name] = this[name].bind(this);
      });
  }

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

  async getNewsAnalysis(req, res, next) {
    return this.analyzeNews(req, res, next);
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

  async portfolioChat(req, res, next) {
    try {
      const userId = req.user?.userId || req.user?.id;
      if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Authentication required' });
      }

      const { message, history } = req.validatedData.body;
      const result = await aiService.portfolioChat(userId, message, history);
      res.json({ status: 'success', data: result });
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

  // ── Tax-Loss Harvesting Engine ──────────────────────────────────────────
  // Deterministic rule-based engine (neoReasoningEngine) + optional Gemini
  // narrative polish. Always returns real numbers even if Gemini is down.
  async getTaxLossHarvesting(req, res, next) {
    try {
      const taxLossHarvestingService = require('../../services/taxLossHarvesting.service');
      const taxRate = req.validatedData?.query?.taxRate;
      const result = await taxLossHarvestingService.getOpportunities(req.user.userId, { taxRate });
      res.json(success(result, { dataSource: 'live-portfolio', methodology: 'deterministic-rule-based' }));
    } catch (error) {
      next(error);
    }
  }

  // ── AI Weekly Report (data) — client renders the PDF with jsPDF ────────
  async getWeeklyReport(req, res, next) {
    try {
      const weeklyReportService = require('../../services/weeklyReport.service');
      const report = await weeklyReportService.buildReport(req.user.userId);
      res.json(success(report, { dataSource: 'live-portfolio' }));
    } catch (error) {
      next(error);
    }
  }

  // ── Gemini quota/health status — lets the client show "AI: live" vs
  //    "AI: using local reasoning (daily limit reached)" instead of
  //    silently failing or showing a generic error.
  async getAIQuotaStatus(req, res, next) {
    try {
      const { _dailyQuota } = require('../../utils/openai-integration');
      res.json(success({
        provider: 'gemini-2.5-flash',
        callsToday: _dailyQuota.count,
        dailyLimit: _dailyQuota.limit,
        quotaExceeded: _dailyQuota.hardExceeded,
        resetsAt: new Date(_dailyQuota.resetAt).toISOString(),
        fallbackMode: _dailyQuota.hardExceeded ? 'deterministic-templates' : 'none',
      }));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AIController();
