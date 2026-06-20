const Portfolio = require('../models/portfolio.model');
const PortfolioHistory = require('../models/portfolio-history.model');
const marketService = require('./market.service');
const { logger } = require('../api/middlewares/logger.middleware');

class AnalyticsService {

  async getPerformanceAnalytics(userId, timeframe = '1m', metrics = ['returns']) {
    try {
      const portfolio = await Portfolio.findOne({ userId });
      if (!portfolio) {
        return { timeframe, metrics: { returns: [], message: 'No portfolio found' }, lastUpdated: new Date() };
      }

      const PortfolioHistory = require('../models/portfolio-history.model');
      const days = this._timeframeToDays(timeframe);
      const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const history = await PortfolioHistory.find({
        portfolioId: portfolio._id,
        timestamp: { $gte: from }
      }).sort({ timestamp: 1 }).lean();

      const returns = history.map((h, i) => {
        const prev = history[i - 1];
        const pct = prev && prev.totalValue > 0
          ? ((h.totalValue - prev.totalValue) / prev.totalValue) * 100
          : 0;
        return {
          label: new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          date: h.timestamp,
          value: h.totalValue || 0,
          returnPct: parseFloat(pct.toFixed(2)),
        };
      });

      let volatility = null;
      let sharpeRatio = null;
      let sortinoRatio = null;
      let maxDrawdown = null;

      if (returns.length > 1) {
        const retPcts = returns.map(r => r.returnPct).filter(v => !isNaN(v));
        const mean = retPcts.reduce((s, v) => s + v, 0) / retPcts.length;
        const variance = retPcts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / retPcts.length;
        volatility = parseFloat(Math.sqrt(variance).toFixed(4));

        const riskFreeRate = 0.05 / 252; // daily risk-free
        sharpeRatio = volatility > 0
          ? parseFloat(((mean - riskFreeRate) / volatility).toFixed(4))
          : 0;

        const downside = retPcts.filter(r => r < 0);
        const downsideVol = downside.length > 0
          ? Math.sqrt(downside.reduce((s, v) => s + v * v, 0) / downside.length)
          : 0;
        sortinoRatio = downsideVol > 0
          ? parseFloat(((mean - riskFreeRate) / downsideVol).toFixed(4))
          : 0;

        let peak = -Infinity;
        let maxDD = 0;
        for (const r of returns) {
          if (r.value > peak) peak = r.value;
          const dd = peak > 0 ? ((peak - r.value) / peak) * 100 : 0;
          if (dd > maxDD) maxDD = dd;
        }
        maxDrawdown = parseFloat(maxDD.toFixed(2));
      }

      return {
        timeframe,
        metrics: {
          returns,
          ...(volatility !== null && { volatility }),
          ...(sharpeRatio !== null && { sharpeRatio }),
          ...(sortinoRatio !== null && { sortinoRatio }),
          ...(maxDrawdown !== null && { maxDrawdown }),
        },
        lastUpdated: new Date(),
      };
    } catch (error) {
      logger.error('Error getting performance analytics:', error);
      throw error;
    }
  }

  async getRiskAssessment(userId, assets = [], timeframe = '1m') {
    try {
      const portfolio = await Portfolio.findOne({ userId });
      if (!portfolio) {
        return { overall: {}, assets: [], lastUpdated: new Date() };
      }

      const assetsToAnalyze = assets.length > 0
        ? portfolio.assets.filter(a => assets.includes(a.symbol))
        : portfolio.assets.slice(0, 10);

      const riskMetrics = await Promise.all(assetsToAnalyze.map(async (asset) => {
        try {
          const histResult = await marketService.getPriceHistory(asset.symbol, '1d');
          const prices = (histResult?.prices || []).map((p) => p.close || p.price || 0).filter(v => v > 0);

          if (prices.length < 5) {
            return { symbol: asset.symbol, volatility: 0, var: 0, beta: 1, riskLevel: 'Unknown' };
          }

          const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
          const mean = returns.reduce((s, v) => s + v, 0) / returns.length;
          const variance = returns.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / returns.length;
          const vol = Math.sqrt(variance);

          // Simple VaR at 95% confidence
          const sorted = [...returns].sort((a, b) => a - b);
          const varIndex = Math.floor(sorted.length * 0.05);
          const valueAtRisk = Math.abs(sorted[varIndex] || 0);

          return {
            symbol: asset.symbol,
            volatility: parseFloat(vol.toFixed(4)),
            var: parseFloat(valueAtRisk.toFixed(4)),
            beta: 1.0, // simplified; real beta needs market index correlation
            riskLevel: vol > 0.05 ? 'High' : vol > 0.02 ? 'Medium' : 'Low',
          };
        } catch {
          return { symbol: asset.symbol, volatility: 0, var: 0, beta: 1, riskLevel: 'Unknown' };
        }
      }));

      const avgVol = riskMetrics.reduce((s, m) => s + m.volatility, 0) / (riskMetrics.length || 1);
      return {
        overall: {
          portfolioVolatility: parseFloat(avgVol.toFixed(4)),
          riskScore: avgVol > 0.05 ? 'High' : avgVol > 0.02 ? 'Medium' : 'Low',
        },
        assets: riskMetrics,
        lastUpdated: new Date(),
      };
    } catch (error) {
      logger.error('Error getting risk assessment:', error);
      throw error;
    }
  }

  async getPricePredictions(symbol, timeframe = '1d') {
    try {
      const aiService = require('./ai.service');
      return await aiService.getPricePredictions(symbol, timeframe, 7);
    } catch (error) {
      logger.error('Error getting price predictions:', error);
      throw error;
    }
  }

  async getMarketSentiment(symbol, sources = ['news', 'technical']) {
    try {
      const aiService = require('./ai.service');
      const src = Array.isArray(sources) ? sources.join(',') : sources;
      return await aiService.getMarketSentiment(symbol, src, '24h');
    } catch (error) {
      logger.error('Error getting market sentiment:', error);
      throw error;
    }
  }

  async getInvestmentOpportunities(userId, type = 'all', filters = {}) {
    try {
      // Pull market data for top assets and rank by momentum
      const symbols = ['BTC', 'ETH', 'SOL', 'ADA', 'AVAX', 'LINK', 'UNI'];
      const prices = await marketService.getMarketPrices(symbols);
      const opportunities = [];

      for (const [symbol, data] of Object.entries(prices)) {
        if (!data || data.price == null) continue;
        const change = data.change24h || 0;
        if (Math.abs(change) > 2) {
          opportunities.push({
            type: 'trading',
            asset: symbol,
            currentPrice: data.price,
            change24h: change,
            potentialReturn: Math.abs(change),
            risk: Math.abs(change) > 10 ? 'High' : Math.abs(change) > 5 ? 'Medium' : 'Low',
            confidence: 50 + Math.min(Math.abs(change) * 2, 40),
            signal: change > 0 ? 'bullish momentum' : 'bearish — potential reversal',
          });
        }
      }

      opportunities.sort((a, b) => b.confidence - a.confidence);
      return { opportunities: opportunities.slice(0, 10), count: opportunities.length, lastUpdated: new Date() };
    } catch (error) {
      logger.error('Error getting investment opportunities:', error);
      throw error;
    }
  }

  async generateCustomReport(userId, reportConfig) {
    try {
      const sections = await Promise.all(
        (reportConfig.sections || []).map(section => this._generateSection(userId, section))
      );
      return { title: reportConfig.title || 'Analytics Report', timestamp: new Date(), sections };
    } catch (error) {
      logger.error('Error generating custom report:', error);
      throw error;
    }
  }

  async _generateSection(userId, section) {
    switch (section.type) {
      case 'performance':
        return { type: 'performance', title: 'Performance', data: await this.getPerformanceAnalytics(userId, section.params?.timeframe, section.params?.metrics) };
      case 'risk':
        return { type: 'risk', title: 'Risk', data: await this.getRiskAssessment(userId, section.params?.assets, section.params?.timeframe) };
      case 'predictions':
        return { type: 'predictions', title: 'Predictions', data: await this.getPricePredictions(section.params?.symbol, section.params?.timeframe) };
      case 'sentiment':
        return { type: 'sentiment', title: 'Sentiment', data: await this.getMarketSentiment(section.params?.symbol, section.params?.sources) };
      case 'opportunities':
        return { type: 'opportunities', title: 'Opportunities', data: await this.getInvestmentOpportunities(userId, section.params?.type, section.params?.filters) };
      default:
        return { type: section.type, title: section.type, data: null };
    }
  }

  _timeframeToDays(tf) {
    const map = { '1d': 1, '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365 };
    return map[tf] || 30;
  }
}

module.exports = new AnalyticsService();