// server/src/services/analytics.service.js
const Portfolio        = require('../models/portfolio.model');
const PortfolioHistory = require('../models/portfolio-history.model');
const marketService    = require('./market.service');
const { logger }       = require('../api/middlewares/logger.middleware');

class AnalyticsService {

  // ── Performance ───────────────────────────────────────────────────────────
  async getPerformanceAnalytics(userId, timeframe = '1m', metrics = ['returns']) {
    try {
      const portfolio = await Portfolio.findOne({ userId });
      if (!portfolio) {
        return { timeframe, metrics: { returns: [], message: 'No portfolio found' }, lastUpdated: new Date() };
      }

      const days = this._timeframeToDays(timeframe);
      const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const history = await PortfolioHistory.find({
        portfolioId: portfolio._id,
        timestamp:   { $gte: from }
      }).sort({ timestamp: 1 }).lean();

      const returns = history.map((h, i) => {
        const prev = history[i - 1];
        const pct  = prev && prev.totalValue > 0
          ? ((h.totalValue - prev.totalValue) / prev.totalValue) * 100
          : 0;
        return {
          label:     new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          date:      h.timestamp,
          value:     h.totalValue || 0,
          returnPct: parseFloat(pct.toFixed(2)),
        };
      });

      // Derived metrics
      let volatility = null, sharpeRatio = null, sortinoRatio = null, maxDrawdown = null;
      if (returns.length > 1) {
        const retPcts  = returns.map(r => r.returnPct).filter(v => !isNaN(v));
        const mean     = retPcts.reduce((s, v) => s + v, 0) / retPcts.length;
        const variance = retPcts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / retPcts.length;
        volatility = parseFloat(Math.sqrt(variance).toFixed(4));

        const riskFreeRate = 0.05 / 252;
        sharpeRatio = volatility > 0 ? parseFloat(((mean - riskFreeRate) / volatility).toFixed(4)) : 0;

        const downside    = retPcts.filter(r => r < 0);
        const downsideVol = downside.length > 0
          ? Math.sqrt(downside.reduce((s, v) => s + v * v, 0) / downside.length)
          : 0;
        sortinoRatio = downsideVol > 0 ? parseFloat(((mean - riskFreeRate) / downsideVol).toFixed(4)) : 0;

        let peak = -Infinity, maxDD = 0;
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
          ...(volatility   !== null && { volatility }),
          ...(sharpeRatio  !== null && { sharpeRatio }),
          ...(sortinoRatio !== null && { sortinoRatio }),
          ...(maxDrawdown  !== null && { maxDrawdown }),
        },
        lastUpdated: new Date(),
      };
    } catch (error) {
      logger.error('Error getting performance analytics:', error);
      throw error;
    }
  }

  // ── Risk — FIX: use timeframe to determine history window ─────────────────
  async getRiskAssessment(userId, assets = [], timeframe = '1m') {
    try {
      const portfolio = await Portfolio.findOne({ userId });
      if (!portfolio) return { overall: {}, assets: [], lastUpdated: new Date() };

      const assetsToAnalyze = assets.length > 0
        ? portfolio.assets.filter(a => assets.includes(a.symbol))
        : portfolio.assets.slice(0, 10);

      // Map timeframe → interval for Kraken price history
      const intervalMap = { '1w': '1h', '1m': '1d', '3m': '1d', '6m': '1d', '1y': '1d' };
      const interval    = intervalMap[timeframe] || '1d';
      const days        = this._timeframeToDays(timeframe);
      const from        = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const to          = new Date().toISOString();

      const riskMetrics = await Promise.all(assetsToAnalyze.map(async (asset) => {
        try {
          const histResult = await marketService.getPriceHistory(asset.symbol, interval, from, to);
          const prices = (histResult?.prices || []).map((p) => p.close || p.price || 0).filter(v => v > 0);

          if (prices.length < 5) {
            return { symbol: asset.symbol, volatility: 0, var: 0, beta: 1, riskLevel: 'Unknown' };
          }

          const retArr   = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
          const mean     = retArr.reduce((s, v) => s + v, 0) / retArr.length;
          const variance = retArr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / retArr.length;
          const vol      = Math.sqrt(variance);

          const sorted    = [...retArr].sort((a, b) => a - b);
          const varIndex  = Math.floor(sorted.length * 0.05);
          const valueAtRisk = Math.abs(sorted[varIndex] || 0);

          return {
            symbol:    asset.symbol,
            volatility: parseFloat(vol.toFixed(4)),
            var:        parseFloat(valueAtRisk.toFixed(4)),
            beta:       1.0,
            riskLevel:  vol > 0.05 ? 'High' : vol > 0.02 ? 'Medium' : 'Low',
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
        assets:      riskMetrics,
        timeframe,
        lastUpdated: new Date(),
      };
    } catch (error) {
      logger.error('Error getting risk assessment:', error);
      throw error;
    }
  }

  // ── Predictions ───────────────────────────────────────────────────────────
  async getPricePredictions(symbol, timeframe = '1d') {
    try {
      const aiService = require('./ai.service');
      return await aiService.getPricePredictions(symbol, timeframe, 7);
    } catch (error) {
      logger.error('Error getting price predictions:', error);
      throw error;
    }
  }

  // ── Sentiment ─────────────────────────────────────────────────────────────
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

  // ── Opportunities — FIX: honour the `type` filter ─────────────────────────
  async getInvestmentOpportunities(userId, type = 'all', filters = {}) {
    try {
      const symbols = ['BTC', 'ETH', 'SOL', 'ADA', 'AVAX', 'LINK', 'UNI'];
      const prices  = await marketService.getMarketPrices(symbols);

      const tradingOpps = [];
      for (const [symbol, data] of Object.entries(prices)) {
        if (!data || data.price == null) continue;
        const change = data.change24h || 0;
        if (Math.abs(change) > 2) {
          tradingOpps.push({
            type:            'trading',
            asset:           symbol,
            currentPrice:    data.price,
            change24h:       change,
            potentialReturn: Math.abs(change),
            risk:            Math.abs(change) > 10 ? 'High' : Math.abs(change) > 5 ? 'Medium' : 'Low',
            confidence:      50 + Math.min(Math.abs(change) * 2, 40),
            signal:          change > 0 ? 'bullish momentum' : 'bearish — potential reversal',
          });
        }
      }

      // DeFi opportunities (static for now — extend with real DeFi data as needed)
      const defiOpps = [
        { type: 'defi', asset: 'ETH/USDC LP', change24h: 0, potentialReturn: 12.4, risk: 'Medium', confidence: 72, signal: 'high APY liquidity pool' },
        { type: 'defi', asset: 'stETH Staking', change24h: 0, potentialReturn: 4.2, risk: 'Low',    confidence: 88, signal: 'liquid staking yield' },
      ];

      let opportunities;
      switch (type) {
        case 'trading': opportunities = tradingOpps; break;
        case 'defi':    opportunities = defiOpps;    break;
        default:        opportunities = [...tradingOpps, ...defiOpps];
      }

      // Apply optional filters
      if (filters.minReturn)  opportunities = opportunities.filter(o => o.potentialReturn >= filters.minReturn);
      if (filters.maxRisk) {
        const riskOrder = { Low: 1, Medium: 2, High: 3 };
        const maxLevel  = riskOrder[filters.maxRisk] || 3;
        opportunities   = opportunities.filter(o => (riskOrder[o.risk] || 3) <= maxLevel);
      }

      opportunities.sort((a, b) => b.confidence - a.confidence);
      return { opportunities: opportunities.slice(0, 10), count: opportunities.length, type, lastUpdated: new Date() };
    } catch (error) {
      logger.error('Error getting investment opportunities:', error);
      throw error;
    }
  }

  // ── Custom Report ─────────────────────────────────────────────────────────
  async generateCustomReport(userId, reportConfig) {
    try {
      // Support both object sections ({ type, params }) and string sections ('performance')
      const normalised = (reportConfig.sections || []).map(s =>
        typeof s === 'string' ? { type: s, params: {} } : s
      );
      const sections = await Promise.all(normalised.map(section => this._generateSection(userId, section)));
      return { title: reportConfig.title || 'Analytics Report', timeframe: reportConfig.timeframe, timestamp: new Date(), sections };
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
        return { type: 'predictions', title: 'Predictions', data: section.params?.symbol ? await this.getPricePredictions(section.params.symbol, section.params.timeframe) : null };
      case 'sentiment':
        return { type: 'sentiment', title: 'Sentiment', data: section.params?.symbol ? await this.getMarketSentiment(section.params.symbol, section.params.sources) : null };
      case 'opportunities':
        return { type: 'opportunities', title: 'Opportunities', data: await this.getInvestmentOpportunities(userId, section.params?.type, section.params?.filters) };
      default:
        return { type: section.type, title: section.type, data: null };
    }
  }

  // ── Correlation Matrix ────────────────────────────────────────────────────
  async getCorrelationMatrix(userId) {
    try {
      const portfolio = await Portfolio.findOne({ userId });
      if (!portfolio || !portfolio.assets.length) return { matrix: [], symbols: [] };

      const symbols = [...new Set(portfolio.assets.map(a => a.symbol))].slice(0, 10);
      const now     = new Date();
      const from    = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const historyMap = {};
      await Promise.all(symbols.map(async (sym) => {
        try {
          const h = await marketService.getPriceHistory(sym, '1d', from.toISOString(), now.toISOString());
          historyMap[sym] = (h?.prices || []).map(p => p.close).filter(Boolean);
        } catch { historyMap[sym] = []; }
      }));

      const pearson = (a, b) => {
        const n = Math.min(a.length, b.length);
        if (n < 2) return null;
        const ax = a.slice(0, n), bx = b.slice(0, n);
        const ma = ax.reduce((s, v) => s + v, 0) / n;
        const mb = bx.reduce((s, v) => s + v, 0) / n;
        const num = ax.reduce((s, v, i) => s + (v - ma) * (bx[i] - mb), 0);
        const da  = Math.sqrt(ax.reduce((s, v) => s + (v - ma) ** 2, 0));
        const db  = Math.sqrt(bx.reduce((s, v) => s + (v - mb) ** 2, 0));
        return da && db ? parseFloat((num / (da * db)).toFixed(4)) : null;
      };

      const matrix = symbols.map(s1 =>
        symbols.map(s2 => s1 === s2 ? 1 : pearson(historyMap[s1], historyMap[s2]))
      );

      return { symbols, matrix };
    } catch (error) {
      logger.error('Correlation matrix error:', error);
      throw error;
    }
  }

  // ── Benchmark Comparison ──────────────────────────────────────────────────
  async getBenchmarkComparison(userId, timeframe = '1m', benchmark = 'BTC') {
    try {
      const portfolio = await Portfolio.findOne({ userId });
      if (!portfolio) return null;

      const days  = this._timeframeToDays(timeframe);
      const from  = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [snapshots, benchmarkHistory] = await Promise.all([
        PortfolioHistory.find({
          portfolioId: portfolio._id,
          timestamp:   { $gte: from }
        }).sort({ timestamp: 1 }).lean(),
        marketService.getPriceHistory(benchmark, '1d', from.toISOString(), new Date().toISOString()),
      ]);

      const portfolioReturns = snapshots.map((s, i) => {
        const prev = snapshots[i - 1];
        const ret  = prev && prev.totalValue > 0 ? ((s.totalValue - prev.totalValue) / prev.totalValue) * 100 : 0;
        return {
          date:  new Date(s.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: s.totalValue,
          return: ret,
        };
      });

      const benchmarkPrices  = benchmarkHistory?.prices || [];
      const benchmarkReturns = benchmarkPrices.map((p, i) => {
        const prev = benchmarkPrices[i - 1];
        const ret  = prev ? ((p.close - prev.close) / prev.close) * 100 : 0;
        return {
          date:  new Date(p.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: p.close,
          return: ret,
        };
      });

      return { portfolio: portfolioReturns, benchmark: benchmarkReturns, benchmarkSymbol: benchmark, timeframe };
    } catch (error) {
      logger.error('Benchmark comparison error:', error);
      throw error;
    }
  }

  // ── Tax Report ────────────────────────────────────────────────────────────
  async getTaxReport(userId, year) {
    try {
      const Transaction  = require('../models/transaction.model');
      const startOfYear  = new Date(`${year}-01-01T00:00:00Z`);
      const endOfYear    = new Date(`${year}-12-31T23:59:59Z`);

      const transactions = await Transaction.find({
        userId,
        type:      { $in: ['sell', 'trade'] },
        createdAt: { $gte: startOfYear, $lte: endOfYear }
      }).lean();

      let totalGains = 0, totalLosses = 0;
      const events = transactions.map(tx => {
        const gain = (tx.price - (tx.costBasis || 0)) * (tx.amount || 0);
        if (gain > 0) totalGains  += gain;
        else          totalLosses += Math.abs(gain);
        return {
          symbol:    tx.symbol,
          type:      tx.type,
          date:      tx.createdAt,
          amount:    tx.amount,
          costBasis: tx.costBasis,
          salePrice: tx.price,
          gainLoss:  parseFloat(gain.toFixed(2)),
        };
      });

      return {
        year,
        totalGains:  parseFloat(totalGains.toFixed(2)),
        totalLosses: parseFloat(totalLosses.toFixed(2)),
        netGainLoss: parseFloat((totalGains - totalLosses).toFixed(2)),
        events,
        disclaimer: 'This report is for informational purposes only. Consult a qualified tax professional.',
      };
    } catch (error) {
      logger.error('Tax report error:', error);
      throw error;
    }
  }

  // ── Asset Allocation ──────────────────────────────────────────────────────
  async getAssetAllocation(userId) {
    try {
      const portfolio = await Portfolio.findOne({ userId });
      if (!portfolio) return null;

      const total = portfolio.totalValue || 0;
      return {
        total,
        assets: portfolio.assets.map(asset => ({
          symbol:     asset.symbol,
          name:       asset.name,
          value:      asset.value || 0,
          allocation: total > 0 ? parseFloat(((asset.value || 0) / total * 100).toFixed(2)) : 0,
        }))
      };
    } catch (error) {
      logger.error('Asset allocation error:', error);
      throw error;
    }
  }

  // ── Utility ───────────────────────────────────────────────────────────────
  _timeframeToDays(tf) {
    const map = { '1d': 1, '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365, 'all': 730 };
    return map[tf] || 30;
  }
}

module.exports = new AnalyticsService();