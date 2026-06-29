const Portfolio = require('../models/portfolio.model');
const PortfolioHistory = require('../models/portfolio-history.model');
const { calculateMetrics } = require('../utils/calculations');
const marketService = require('./market.service');
const transactionService = require('./transaction.service');
const { logger } = require('../api/middlewares/logger.middleware');
const { startOfDay, subDays, subMonths, subYears } = require('date-fns');

class PortfolioService {

  // =========================
  // EXISTING CODE (UNCHANGED)
  // =========================
  async ensureUserPortfolio(userId) {
    const seededAssets = process.env.DEMO_MODE === 'true'
      ? [
          { symbol: 'BTC',  name: 'Bitcoin',  type: 'crypto', amount: 0.25,  costBasis: 42000 },
          { symbol: 'ETH',  name: 'Ethereum', type: 'crypto', amount: 1.5,   costBasis: 2800  },
          { symbol: 'SOL',  name: 'Solana',   type: 'crypto', amount: 10,    costBasis: 120   },
          { symbol: 'AAPL', name: 'Apple',    type: 'stock',  amount: 5,     costBasis: 178   },
          { symbol: 'MSFT', name: 'Microsoft',type: 'stock',  amount: 3,     costBasis: 380   },
        ]
      : [];

    const defaultPortfolio = {
      userId,
      name: 'My Portfolio',
      description: 'Default investment portfolio',
      assets: seededAssets
    };

    const portfolio = await Portfolio.findOneAndUpdate(
      { userId, name: 'My Portfolio' },
      { $setOnInsert: defaultPortfolio },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (portfolio && (!portfolio.totalValue || portfolio.totalValue === undefined)) {
      try {
        await this.updatePortfolioMetrics(portfolio);
      } catch (error) {
        logger.warn('Error updating metrics for new portfolio:', error.message);
      }
    }

    // 🔥 REMOVED: Do NOT create snapshot on every ensureUserPortfolio call
    // This was causing duplicate snapshots
    // Snapshots are created by background jobs only

    return portfolio;
  }

  // =========================
  // HISTORY FIXES
  // =========================
  async getPortfolioHistory(userId, timeframe = '1m') {
    const portfolio = await this.ensureUserPortfolio(userId);

    const days = this.getTimeframeDays(timeframe);
    const fromDate = subDays(startOfDay(new Date()), days);

    const snapshots = await PortfolioHistory.find({
      portfolioId: portfolio._id,
      timestamp: { $gte: fromDate }
    }).sort({ timestamp: 1 }).lean();

    let history = snapshots.map(s => ({
      timestamp: new Date(s.timestamp).getTime(),
      value: typeof s.totalValue === 'number' ? s.totalValue : 0,
      // Include per-asset breakdown for the performance chart overlay
      assets: (s.assets || []).reduce((acc, a) => {
        acc[a.symbol] = a.value || 0;
        return acc;
      }, {})
    }));

    // 🔥 FIX 2: never return empty - ensure assets property exists
    if (!history.length) {
      // ✅ BUILD INITIAL ASSETS BREAKDOWN
      const assets = {};
      for (const asset of (portfolio.assets || [])) {
        if (asset.value > 0) {
          assets[asset.symbol] = asset.value;
        }
      }
      
      history = [{
        timestamp: Date.now(),
        value: portfolio.totalValue || 0,
        assets: assets  // ✅ INCLUDE ASSETS BREAKDOWN
      }];
    }

    // If no real history yet, build synthetic from portfolio cost basis
    if (history.length <= 1) {
      const currentValue = portfolio.totalValue || 0;
      const totalCost    = portfolio.totalCost   || 0;

      if (currentValue > 0) {
        // Find earliest asset purchase date (or fall back to `days` ago)
        let earliestMs = Date.now() - days * 24 * 60 * 60 * 1000;
        for (const asset of (portfolio.assets || [])) {
          if (asset.purchaseDate) {
            const ms = new Date(asset.purchaseDate).getTime();
            if (ms < earliestMs) earliestMs = ms;
          }
        }

        const spanMs    = Date.now() - earliestMs;
        const numPoints = Math.min(days, Math.max(2, Math.ceil(spanMs / (24 * 60 * 60 * 1000))));
        const startValue = totalCost > 0 ? totalCost : currentValue * 0.9;

        const syntheticPoints = [];
        for (let i = 0; i <= numPoints; i++) {
          const fraction = i / numPoints;
          const ts       = earliestMs + fraction * spanMs;
          // Linear interpolation from cost basis to current value + slight noise
          const noise    = 1 + (Math.random() - 0.48) * 0.015;
          const value    = parseFloat((startValue + (currentValue - startValue) * fraction * noise).toFixed(2));
          
          // ✅ BUILD PER-ASSET BREAKDOWN FOR SYNTHETIC DATA
          const assets = {};
          for (const asset of (portfolio.assets || [])) {
            // Distribute asset values proportionally across timeframe
            const assetStartValue = (asset.costBasis || 0);
            const assetCurrentValue = asset.value || 0;
            const assetValue = parseFloat(
              (assetStartValue + (assetCurrentValue - assetStartValue) * fraction).toFixed(2)
            );
            if (assetValue > 0) {
              assets[asset.symbol] = assetValue;
            }
          }
          
          syntheticPoints.push({ 
            timestamp: ts, 
            value: Math.max(0, value),
            assets: assets  // ✅ INCLUDE ASSETS BREAKDOWN
          });
        }
        history = syntheticPoints;
      } else {
        history = [
          { timestamp: Date.now() - 86400000, value: 0, assets: {} },
          { timestamp: Date.now(), value: 0, assets: {} },
        ];
      }
    }

    return history;
  }

  // =========================
  // CHANGE FIX
  // =========================
  calculateChangeFromHistory(history, days) {
    if (!history || history.length < 1) {
      return { value: 0, percentage: 0 };
    }

    const current = history[history.length - 1]?.value || 0;

    if (current <= 0) {
      return { value: 0, percentage: 0 };
    }

    let past = null;

    if (days === 1) {
      // Daily: use yesterday's value if available
      past = history[history.length - 2]?.value;
    } else if (history.length > 1) {
      // For weekly/monthly: try to find data from N days ago
      const index = Math.max(0, history.length - days);
      past = history[index]?.value;
    }

    // If not enough historical data, return 0 (will show $0.00 until we have history)
    if (!past || past <= 0) {
      return { value: 0, percentage: 0 };
    }

    const change = current - past;
    const percentage = (change / past) * 100;

    return {
      value: Number(change.toFixed(2)),
      percentage: Number(percentage.toFixed(2))
    };
  }

  // =========================
  // METRICS FIX
  // =========================
  async updatePortfolioMetrics(portfolio) {
    try {
      const symbols = portfolio.assets.map(asset => asset.symbol);
      const prices = await marketService.getMarketPrices(symbols);

      let totalValue = 0;
      let totalCost = 0;

// UPDATED — extracts change24h alongside price
portfolio.assets.forEach(asset => {
  const rawPrice = prices[asset.symbol];

  let numericPrice = 0;
  let numericChange24h = 0;

  if (typeof rawPrice === 'number') {
    numericPrice = rawPrice;
  } else if (typeof rawPrice === 'object' && rawPrice !== null) {
    numericPrice =
      rawPrice.price ??
      rawPrice.value ??
      rawPrice.p ??
      rawPrice.c ??
      0;

    // Extract 24h % change — try common field names from different market APIs
    numericChange24h =
      rawPrice.change24h ??
      rawPrice.percent_change_24h ??
      rawPrice.changePercent24Hr ??
      rawPrice.price_change_percentage_24h ??
      rawPrice.pc ??       // Finnhub
      rawPrice.dp ??       // Finnhub quote
      0;
  } else {
    const parsed = Number(rawPrice);
    numericPrice = (!isNaN(parsed)) ? parsed : 0;
  }

  if (isNaN(numericPrice)) numericPrice = 0;
  if (isNaN(numericChange24h)) numericChange24h = 0;

  asset.currentPrice = numericPrice;
  asset.change24h = numericChange24h;         // ← NEW
  asset.value = asset.amount * numericPrice;

  const cost = asset.costBasis * asset.amount;

  asset.profit = asset.value - cost;
  asset.profitPercentage = cost > 0
    ? ((asset.value / cost) - 1) * 100
    : 0;

  totalValue += asset.value;
  totalCost += cost;
});
      portfolio.totalValue = totalValue;
      portfolio.totalCost = totalCost;
      portfolio.totalProfit = totalValue - totalCost;
      portfolio.totalProfitPercentage = totalCost > 0
        ? ((totalValue / totalCost) - 1) * 100
        : 0;

      portfolio.assets.forEach(asset => {
        asset.allocation = totalValue > 0
          ? (asset.value / totalValue) * 100
          : 0;
      });

      portfolio.metrics = await calculateMetrics(portfolio);
      portfolio.lastUpdated = new Date();

      await portfolio.save();
// ✅ Broadcast live update to subscribed clients
try {
  if (global.portfolioHandler) {
    global.portfolioHandler.broadcastPortfolioUpdate(
      portfolio._id.toString(),
      {
        totalValue: portfolio.totalValue,
        totalProfit: portfolio.totalProfit,
        totalProfitPercentage: portfolio.totalProfitPercentage,
        assets: portfolio.assets.map(a => ({
          symbol: a.symbol,
          currentPrice: a.currentPrice,
          value: a.value,
          profit: a.profit,
          profitPercentage: a.profitPercentage
        }))
      }
    );
  }
} catch (e) {
  logger.warn('WebSocket broadcast failed (non-fatal):', e.message);
}
      // 🔥 REMOVED: Do NOT create snapshot on API call
      // Snapshots are created by background jobs only

    } catch (error) {
      logger.error('Error updating portfolio metrics:', error);
      throw error;
    }
  }

  // =========================
  // SNAPSHOT (UNCHANGED LOGIC, SAFE)
  // =========================
  async saveHistoricalSnapshot(portfolio) {
    try {
      await PortfolioHistory.create({
        portfolioId: portfolio._id,
        userId: portfolio.userId,
        timestamp: new Date(),
        totalValue: portfolio.totalValue ?? 0,
        totalCost: portfolio.totalCost ?? 0,
        totalProfit: portfolio.totalProfit ?? 0,
        assets: portfolio.assets.map(asset => ({
          symbol: asset.symbol,
          amount: asset.amount,
          value: asset.value ?? 0,
          price: asset.currentPrice ?? 0,
          profit: asset.profit ?? 0,
          profitPercentage: asset.profitPercentage ?? 0
        })),
        metrics: portfolio.metrics || {}
      });
    } catch (error) {
      logger.error('Error saving historical snapshot:', error);
    }
  }

  // =========================
  // TIMEFRAME HELPER
  // =========================
  getTimeframeDays(timeframe) {
    const timeframes = {
      '1d': 1,
      '1w': 7,
      '1m': 30,
      '3m': 90,
      '6m': 180,
      '1y': 365,
      'all': 3650,   // ~10 years — returns all available history
    };
    return timeframes[timeframe] || 30;
  }

  // =========================
  // MAIN API METHODS
  // =========================
  async getPortfolioSummary(userId) {
    try {
      const portfolio = await this.ensureUserPortfolio(userId);
      
      // 🔥 PARALLELIZE: Fetch portfolio metrics and history in parallel, not sequential
      const [, history] = await Promise.all([
        // Only update metrics if not recently updated (skip if updated < 30 seconds ago)
        (!portfolio.lastUpdated || Date.now() - portfolio.lastUpdated.getTime() > 30000)
          ? this.updatePortfolioMetrics(portfolio)
          : Promise.resolve(),
        this.getPortfolioHistory(userId, '1m')
      ]);
      
      // 🔥 SIMPLE CHANGE CALCULATION
      // Use first snapshot vs current, not "exactly 30 days"
      const dailyChange = this.calculateChangeFromHistory(history, 1);
      const weeklyChange = this.calculateChangeFromHistory(history, 7);
      
      // Simple: first value in 30-day history vs current
      let monthlyChange = { value: 0, percentage: 0 };
      if (history && history.length > 1) {
        const currentValue = history[history.length - 1].value || 0;
        const oldestValue = history[0].value || 0;
        if (oldestValue > 0) {
          const change = currentValue - oldestValue;
          const percentage = (change / oldestValue) * 100;
          monthlyChange = {
            value: Number(change.toFixed(2)),
            percentage: Number(percentage.toFixed(2))
          };
        }
      }

      const totalValue = portfolio.totalValue || 0;

      logger.debug('Portfolio summary computed', {
        userId,
        totalValue,
        historySnapshots: history.length
      });

return {
  portfolioId: portfolio._id.toString(),  // ← ADD THIS for WebSocket subscription
  totalValue,
  totalCost: portfolio.totalCost || 0,
  totalProfit: portfolio.totalProfit || 0,
  totalProfitPercentage: portfolio.totalProfitPercentage || 0,

  // ✅ Add these — frontend PortfolioSummary interface uses these names:
  allTimeProfit: portfolio.totalProfit || 0,
  allTimeProfitPercentage: portfolio.totalProfitPercentage || 0,

  dailyChange: dailyChange.value,
  dailyChangePercentage: dailyChange.percentage,
  weeklyChange: weeklyChange.value,
  weeklyChangePercentage: weeklyChange.percentage,
  monthlyChange: monthlyChange.value,
  monthlyChangePercentage: monthlyChange.percentage,
  assetCount: portfolio.assets.length,
  lastUpdated: portfolio.lastUpdated
};    } catch (error) {
      logger.error('Error getting portfolio summary:', error);
      throw error;
    }
  }

  async getAllAssets(userId, options = {}) {
    try {
      const { limit = 50, skip = 0 } = options;
      const portfolio = await this.ensureUserPortfolio(userId);
      await this.updatePortfolioMetrics(portfolio);
      
      const allAssets = portfolio.assets.map(asset => ({
        // Identity
        id: asset._id.toString(),
        _id: asset._id,
        symbol: asset.symbol,
        name: asset.name || asset.symbol,
        type: asset.type || 'crypto',

        // Frontend PortfolioAsset interface fields:
        price: asset.currentPrice || 0,          // frontend expects 'price' not 'currentPrice'
        change24h: asset.change24h || 0,
        quantity: asset.amount,                   // frontend expects 'quantity' not 'amount'
        value: asset.value || 0,
        allocation: asset.allocation || 0,
        profitLoss: asset.profit || 0,            // frontend expects 'profitLoss' not 'profit'
        profitLossPercentage: asset.profitPercentage || 0,  // frontend expects 'profitLossPercentage'
        averageBuyPrice: asset.costBasis || 0,    // frontend expects 'averageBuyPrice' not 'costBasis'

        // Keep originals too (used internally)
        amount: asset.amount,
        costBasis: asset.costBasis,
        currentPrice: asset.currentPrice || 0,
        profit: asset.profit || 0,
        profitPercentage: asset.profitPercentage || 0,
        acquiredAt: asset.acquiredAt,
        purchaseDate: asset.acquiredAt,
        notes: asset.notes
      }));

      const items = allAssets.slice(skip, skip + limit);
      return { items, total: allAssets.length };
    } catch (error) {
      logger.error('Error getting all assets:', error);
      throw error;
    }
  }

  async getAssetDetails(userId, assetId) {
    try {
      const portfolio = await this.ensureUserPortfolio(userId);
      await this.updatePortfolioMetrics(portfolio);
      
      const asset = portfolio.assets.id(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      const history = await PortfolioHistory.find({
        portfolioId: portfolio._id,
        'assets._id': asset._id
      }).sort({ timestamp: -1 }).limit(100).lean();

      return {
        ...asset.toObject(),
        priceHistory: history.map(h => {
          const assetData = h.assets.find(a => a._id.toString() === asset._id.toString());
          return {
            timestamp: h.timestamp,
            price: assetData?.price || 0,
            value: assetData?.value || 0
          };
        })
      };
    } catch (error) {
      logger.error('Error getting asset details:', error);
      throw error;
    }
  }

  async getPortfolioExport(userId) {
    try {
      const portfolio = await this.ensureUserPortfolio(userId);
      await this.updatePortfolioMetrics(portfolio);

      return {
        portfolioName: portfolio.name,
        exportDate: new Date(),
        summary: await this.getPortfolioSummary(userId),
        assets: await this.getAllAssets(userId),
        history: await this.getPortfolioHistory(userId, '1y')
      };
    } catch (error) {
      logger.error('Error exporting portfolio:', error);
      throw error;
    }
  }

async getPerformanceMetrics(userId) {
  const portfolio = await this.ensureUserPortfolio(userId);
  await this.updatePortfolioMetrics(portfolio);
  const history = await this.getPortfolioHistory(userId, '1y');

  // Compute best/worst asset by profitPercentage
  const ranked = [...portfolio.assets]
    .filter(a => typeof a.profitPercentage === 'number')
    .sort((a, b) => b.profitPercentage - a.profitPercentage);

  const best = ranked[0] || null;
  const worst = ranked[ranked.length - 1] || null;

  return {
    // ✅ Fields the frontend PerformanceMetrics interface expects:
    bestPerformingAsset: best ? {
      symbol: best.symbol,
      name: best.name || best.symbol,
      returnPercentage: Number((best.profitPercentage || 0).toFixed(2))
    } : null,
    worstPerformingAsset: worst ? {
      symbol: worst.symbol,
      name: worst.name || worst.symbol,
      returnPercentage: Number((worst.profitPercentage || 0).toFixed(2))
    } : null,
    beta: portfolio.metrics?.beta || null,
    sharpeRatio: portfolio.metrics?.sharpeRatio || null,
    volatility: portfolio.metrics?.volatility || null,
    sortino: portfolio.metrics?.sortino || null,

    // Extra data used by chart:
    metrics: portfolio.metrics || {},
    totalValue: portfolio.totalValue || 0,
    totalProfit: portfolio.totalProfit || 0,
    totalProfitPercentage: portfolio.totalProfitPercentage || 0,
    history
  };
}
  async getAssetAllocation(userId) {
    try {
      const portfolio = await this.ensureUserPortfolio(userId);
      await this.updatePortfolioMetrics(portfolio);

      return {
        total: portfolio.totalValue || 0,
        assets: portfolio.assets.map(asset => ({
          symbol: asset.symbol,
          name: asset.name,
          value: asset.value || 0,
          allocation: asset.allocation || 0
        }))
      };
    } catch (error) {
      logger.error('Error getting asset allocation:', error);
      throw error;
    }
  }

  async createPortfolio(userId, portfolioData) {
    try {
      const portfolio = await Portfolio.create({
        userId,
        name: portfolioData.name,
        description: portfolioData.description,
        assets: portfolioData.assets || []
      });

      await this.updatePortfolioMetrics(portfolio);
      return portfolio;
    } catch (error) {
      logger.error('Error creating portfolio:', error);
      throw error;
    }
  }

  async addAssetToPortfolio(userId, assetData) {
    try {
      const portfolio = await this.ensureUserPortfolio(userId);
      
portfolio.assets.push({
  assetId: assetData.assetId,
  symbol: assetData.symbol,
  name: assetData.name || assetData.symbol,  // ✅ store name
  type: assetData.type || 'crypto',           // ✅ store type
  amount: assetData.amount,
  costBasis: assetData.costBasis,
  currentPrice: assetData.currentPrice || 0,
  purchaseDate: assetData.purchaseDate || new Date(),
  notes: assetData.notes
});   
await portfolio.save();
await this.updatePortfolioMetrics(portfolio);

// Immediately snapshot so the history chart isn't flat for the first 24h
await this.saveHistoricalSnapshot(portfolio);

return portfolio;
    } catch (error) {
      logger.error('Error adding asset to portfolio:', error);
      throw error;
    }
  }

  async removeAssetFromPortfolio(userId, assetId) {
    try {
      const portfolio = await this.ensureUserPortfolio(userId);

      const assetIndex = portfolio.assets.findIndex(
        a => a._id.toString() === assetId
      );
      if (assetIndex === -1) {
        throw new Error('Asset not found in portfolio');
      }

      portfolio.assets.splice(assetIndex, 1);
      await portfolio.save();
      await this.updatePortfolioMetrics(portfolio);

      return { message: 'Asset removed successfully' };
    } catch (error) {
      logger.error('Error removing asset from portfolio:', error);
      throw error;
    }
  }

  async updateAsset(userId, assetId, updates) {
    try {
      const portfolio = await this.ensureUserPortfolio(userId);
      const asset = portfolio.assets.id(assetId);
      if (!asset) throw new Error('Asset not found');

      // Only allow updating these fields
      if (updates.amount !== undefined && updates.amount > 0) {
        asset.amount = Number(updates.amount);
      }
      if (updates.costBasis !== undefined && updates.costBasis > 0) {
        asset.costBasis = Number(updates.costBasis);
      }
      if (updates.notes !== undefined) {
        asset.notes = String(updates.notes);
      }

      await portfolio.save();
      await this.updatePortfolioMetrics(portfolio);

      return asset;
    } catch (error) {
      logger.error('Error updating asset:', error);
      throw error;
    }
  }

  async updatePortfolio(userId, portfolioId, updateData) {
    try {
      const portfolio = await Portfolio.findOneAndUpdate(
        { _id: portfolioId, userId },
        updateData,
        { new: true }
      );

      if (!portfolio) {
        throw new Error('Portfolio not found');
      }

      await this.updatePortfolioMetrics(portfolio);
      return portfolio;
    } catch (error) {
      logger.error('Error updating portfolio:', error);
      throw error;
    }
  }

  async deletePortfolio(userId, portfolioId) {
    try {
      const portfolio = await Portfolio.findOneAndDelete({
        _id: portfolioId,
        userId
      });

      if (!portfolio) {
        throw new Error('Portfolio not found');
      }

      // Also delete all history for this portfolio
      await PortfolioHistory.deleteMany({ portfolioId });

      return { message: 'Portfolio deleted successfully' };
    } catch (error) {
      logger.error('Error deleting portfolio:', error);
      throw error;
    }
  }
  async getAssetPriceHistory(userId, assetSymbol, timeframe = '30d') {
  try {
    const portfolio = await this.ensureUserPortfolio(userId);

    const asset = portfolio.assets.find(
      a => a.symbol.toUpperCase() === assetSymbol.toUpperCase()
    );
    if (!asset) throw new Error('Asset not found in portfolio');

    const days = parseInt(timeframe) || 30;
    const fromDate = subDays(startOfDay(new Date()), days);

    const snapshots = await PortfolioHistory.find({
      portfolioId: portfolio._id,
      timestamp: { $gte: fromDate }
    }).sort({ timestamp: 1 }).lean();

    const priceHistory = snapshots
      .map(snap => {
        const assetSnap = snap.assets?.find(
          a => a.symbol?.toUpperCase() === assetSymbol.toUpperCase()
        );
        if (!assetSnap) return null;
        return {
          date: new Date(snap.timestamp).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric'
          }),
          price: assetSnap.price || 0,
          value: assetSnap.value || 0,
          timestamp: new Date(snap.timestamp).getTime()
        };
      })
      .filter(Boolean);

    // Fallback: no history yet — return current price as single data point
    if (priceHistory.length === 0) {
      return [{
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        price: asset.currentPrice || 0,
        value: asset.value || 0,
        timestamp: Date.now()
      }];
    }

    return priceHistory;
  } catch (error) {
    logger.error('Error getting asset price history:', error);
    throw error;
  }
}

/**
 * Rebalance portfolio using AI optimization
 */
async rebalancePortfolio(userId, portfolioId, objective = 'sharpe', dryRun = false) {
  try {
    const objectiveMap = {
      'min-volatility': 'minvar',
      minvar: 'minvar',
      maxreturn: 'maxreturn',
      'max-return': 'maxreturn',
      return: 'maxreturn',
      risk: 'minvar',
      sharpe: 'sharpe'
    };
    objective = objectiveMap[objective] || objective || 'sharpe';

    const portfolio = await Portfolio.findOne({ _id: portfolioId, userId });
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    if (!portfolio.assets || portfolio.assets.length < 2) {
      throw new Error('Portfolio must have at least 2 assets to rebalance');
    }

    // Get AI service
    const aiService = require('./ai.service');

    // Prepare assets for optimization
    const assetsForOptimization = portfolio.assets.map(asset => ({
      symbol: asset.symbol,
      name: asset.name,
      type: asset.type,
      currentAmount: asset.amount,
      currentPrice: asset.currentPrice || 0,
      value: asset.value || 0
    }));

    // Calculate constraints based on portfolio type
    const constraints = {
      minAllocation: 0.05,      // Minimum 5% per asset
      maxAllocation: 0.50,      // Maximum 50% per asset
      riskTolerance: 'moderate' // Can be adjusted based on user profile
    };

    // Call AI optimization
    const optimization = await aiService.optimizePortfolio(
      assetsForOptimization,
      constraints,
      objective
    );

    if (dryRun) {
      // Return recommendation without applying changes
      return {
        status: 'preview',
        message: `Preview generated using the ${objective} objective to rebalance your portfolio.`,
        currentAllocation: optimization.currentAllocation,
        recommendedAllocation: optimization.recommendedAllocation,
        expectedMetrics: optimization.expectedMetrics,
        rebalancing: optimization.rebalancing,
        objective: optimization.objective,
        trades: this.calculateTrades(portfolio.assets, optimization.recommendedAllocation),
        applied: false
      };
    }

    // Apply rebalancing: Update asset allocations
    const totalValue = portfolio.totalValue || 0;
    const updatedAssets = portfolio.assets.map(asset => {
      const recommendedAlloc = optimization.recommendedAllocation[asset.symbol] || 0;
      const newAmount = (totalValue * recommendedAlloc) / (asset.currentPrice || 1);
      
      return {
        ...asset,
        amount: newAmount,
        allocatedAt: new Date()
      };
    });

    // Save rebalanced portfolio
    portfolio.assets = updatedAssets;
    portfolio.lastRebalancedAt = new Date();
    portfolio.rebalanceHistory = portfolio.rebalanceHistory || [];
    portfolio.rebalanceHistory.push({
      date: new Date(),
      objective,
      previousAllocation: optimization.currentAllocation,
      newAllocation: optimization.recommendedAllocation,
      expectedMetrics: optimization.expectedMetrics,
      reason: `Rebalanced to optimize for ${objective} ratio`
    });

    await portfolio.save();

    // Recalculate metrics
    await this.updatePortfolioMetrics(portfolio);

    // Broadcast portfolio update via WebSocket
    if (global.portfolioHandler) {
      global.portfolioHandler.broadcastPortfolioUpdate(userId);
    }

    // Create notification
    const notificationService = require('./notification.service');
    await notificationService.createNotification(userId, {
      type: 'performance',
      title: 'Portfolio Rebalanced',
      message: `Your portfolio has been rebalanced to optimize for ${objective}. New allocation applied.`,
      icon: 'TrendingUp',
      severity: 'success',
      actionUrl: '/portfolio',
      actionLabel: 'View Portfolio',
      metadata: {
        portfolioId: portfolioId.toString(),
        objective,
        expectedSharpe: optimization.expectedMetrics?.sharpe,
        expectedVolatility: optimization.expectedMetrics?.volatility
      }
    });

    return {
      status: 'success',
      message: `Portfolio rebalanced successfully using the ${objective} objective.`,
      currentAllocation: optimization.currentAllocation,
      recommendedAllocation: optimization.recommendedAllocation,
      expectedMetrics: optimization.expectedMetrics,
      rebalancing: optimization.rebalancing,
      objective: optimization.objective,
      trades: this.calculateTrades(portfolio.assets, optimization.recommendedAllocation),
      applied: true,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error rebalancing portfolio:', error);
    throw error;
  }
}

/**
 * Calculate required trades for rebalancing
 */
calculateTrades(assets, recommendedAllocation) {
  const totalValue = assets.reduce((sum, a) => sum + (a.value || 0), 0);
  
  return assets.map(asset => {
    const currentValue = asset.value || 0;
    const currentAllocation = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
    const recommendedAlloc = (recommendedAllocation[asset.symbol] || 0) * 100;
    const difference = recommendedAlloc - currentAllocation;
    const tradeValue = (difference / 100) * totalValue;

    return {
      symbol: asset.symbol,
      name: asset.name,
      currentAmount: asset.amount,
      currentValue: currentValue,
      currentAllocation: currentAllocation.toFixed(2),
      recommendedAllocation: recommendedAlloc.toFixed(2),
      differencePercent: difference.toFixed(2),
      tradeValue: tradeValue.toFixed(2),
      action: tradeValue > 0 ? 'BUY' : tradeValue < 0 ? 'SELL' : 'HOLD'
    };
  });
}

async importAssetsFromCSV(userId, csvBuffer) {
  const csv = require('csv-parser');
  const { Readable } = require('stream');
  const marketService = require('./market.service');

  return new Promise((resolve, reject) => {
    const rows = [];
    
    Readable.from([csvBuffer])
      .pipe(csv())
      .on('data', (row) => {
        // Normalize headers to lowercase
        const normalizedRow = {};
        for (const [key, value] of Object.entries(row)) {
          normalizedRow[key.toLowerCase().trim()] = value;
        }
        rows.push(normalizedRow);
      })
      .on('end', async () => {
        try {
          const portfolio = await this.ensureUserPortfolio(userId);
          const importedAssets = [];
          const errors = [];

          // Process each row
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2; // CSV line number (1-indexed + header)

            try {
              // Validate required fields
              const symbol = row.symbol?.toString().toUpperCase().trim();
              const amount = parseFloat(row.amount || row.quantity);
              const purchasePrice = parseFloat(row['purchase price'] || row['price'] || row['cost']);
              const purchaseDate = row['purchase date'] || row['date'];

              if (!symbol) {
                errors.push(`Row ${rowNum}: Missing or empty symbol field`);
                continue;
              }
              if (isNaN(amount) || amount <= 0) {
                errors.push(`Row ${rowNum}: Invalid amount (${row.amount})`);
                continue;
              }
              if (isNaN(purchasePrice) || purchasePrice <= 0) {
                errors.push(`Row ${rowNum}: Invalid purchase price (${row['purchase price']})`);
                continue;
              }

              // Determine asset type (default to crypto if not specified)
              let assetType = row.type?.toLowerCase() || 'crypto';
              if (!['crypto', 'stock', 'forex', 'commodity', 'fiat'].includes(assetType)) {
                assetType = 'crypto';
              }

              // Fetch current price from market service
              let currentPrice = purchasePrice; // fallback
              try {
                let priceData;
                if (assetType === 'crypto') {
                  const prices = await marketService.getCryptoPrices([symbol]);
                  priceData = prices[symbol];
                } else if (assetType === 'stock') {
                  const prices = await marketService.getStockPrices([symbol]);
                  priceData = prices[symbol];
                } else if (assetType === 'forex') {
                  const prices = await marketService.getForexPrices([symbol]);
                  priceData = prices[symbol];
                }

                if (priceData?.price) {
                  currentPrice = priceData.price;
                }
              } catch (priceErr) {
                logger.warn(`Could not fetch current price for ${symbol}:`, priceErr.message);
                // Use purchase price as fallback
              }

              // Calculate cost basis
              const costBasis = purchasePrice * amount;

              // Parse purchase date
              let acquiredDate = new Date();
              if (purchaseDate) {
                const parsedDate = new Date(purchaseDate);
                if (!isNaN(parsedDate.getTime())) {
                  acquiredDate = parsedDate;
                }
              }

              // Create asset object
              const newAsset = {
                assetId: `${symbol}_${Date.now()}_${i}`,
                symbol,
                name: row.name || symbol,
                type: assetType,
                amount,
                costBasis,
                currentPrice,
                purchaseDate: acquiredDate,
                value: amount * currentPrice,
                profit: (amount * currentPrice) - costBasis,
                profitPercentage: costBasis > 0 ? ((amount * currentPrice - costBasis) / costBasis * 100) : 0,
                notes: row.notes || `Imported from CSV on ${new Date().toLocaleDateString()}`,
                acquisition: purchaseDate ? `CSV import (purchased ${purchaseDate})` : 'CSV import'
              };

              portfolio.assets.push(newAsset);
              importedAssets.push({
                symbol,
                amount,
                purchasePrice,
                currentPrice,
                costBasis,
                value: newAsset.value
              });

            } catch (rowErr) {
              errors.push(`Row ${rowNum}: ${rowErr.message}`);
            }
          }

          if (importedAssets.length === 0) {
            throw new Error(`No valid assets found in CSV. Errors: ${errors.join('; ')}`);
          }

          // Save portfolio with imported assets
          await portfolio.save();
          await this.updatePortfolioMetrics(portfolio);
          await this.saveHistoricalSnapshot(portfolio);

          resolve({
            importedCount: importedAssets.length,
            assets: importedAssets,
            errors: errors.length > 0 ? errors : undefined,
            message: errors.length > 0 
              ? `Imported ${importedAssets.length} assets with ${errors.length} error(s)`
              : `Successfully imported ${importedAssets.length} assets`
          });
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject);
  });
}

/**
 * Add multiple assets to portfolio at once
 * Used for CSV import
 */
async addMultipleAssets(userId, assets) {
  const portfolio = await Portfolio.findOne({ userId });
  if (!portfolio) {
    throw new Error('Portfolio not found');
  }

  for (const asset of assets) {
    const exists = portfolio.assets.find(a => a.symbol === asset.symbol);
    if (exists) {
      // Merge with existing asset
      exists.amount    += asset.amount;
      exists.costBasis  = (exists.costBasis * (exists.amount - asset.amount) + asset.costBasis * asset.amount) / exists.amount;
    } else {
      // Add new asset
      portfolio.assets.push(asset);
    }
  }

  await portfolio.save();
  await this.updatePortfolioMetrics(portfolio);
  return portfolio;
}

  // ── NEW ASSET CRUD METHODS ─────────────────────────────────────────────────

  async addAsset(userId, assetData) {
    const Transaction = require('../models/transaction.model');
    const portfolio = await this.ensureUserPortfolio(userId);
    const { symbol, name, type, amount, costBasis, purchaseDate } = assetData;

    const upper = symbol.toUpperCase();
    const existing = portfolio.assets.find(a => a.symbol === upper);
    
    // Fetch current price (fallback to costBasis if fetch fails)
    let currentPrice = costBasis;
    try {
      const priceData = await this.fetchAssetPrice(upper);
      if (priceData) currentPrice = priceData.price;
    } catch (err) {
      // Use costBasis as fallback
    }

    const transactionTimestamp = purchaseDate ? new Date(purchaseDate) : new Date();

    if (existing) {
      // Average down / up
      const totalCost = existing.costBasis * existing.amount + costBasis * amount;
      existing.amount   += amount;
      existing.costBasis = totalCost / existing.amount;
      existing.currentPrice = currentPrice;
      existing.value = existing.amount * currentPrice;
      if (purchaseDate && new Date(purchaseDate) < new Date(existing.acquiredAt || 0)) {
        existing.acquiredAt = new Date(purchaseDate);
      }
    } else {
      // Generate assetId for new asset
      const { Types } = require('mongoose');
      portfolio.assets.push({
        assetId: new Types.ObjectId().toString(),
        symbol: upper,
        name: name || upper,
        type,
        amount,
        costBasis,
        currentPrice,
        value: amount * currentPrice,
        acquiredAt: purchaseDate ? new Date(purchaseDate) : new Date(),
        profit: 0,
        profitPercentage: 0,
        allocation: 0,
        change24h: 0
      });
    }

    await this.updatePortfolioMetrics(portfolio);
    await portfolio.save();

    // ✅ CREATE TRANSACTION RECORD for portfolio history
    try {
      const transaction = new Transaction({
        userId,
        type: amount > 0 ? 'buy' : 'sell',
        asset: upper,
        assetName: name || upper,
        amount: Math.abs(amount),
        fee: 0,
        network: 'portfolio',
        status: 'completed',
        timestamp: transactionTimestamp,
        memo: `Manual ${amount > 0 ? 'buy' : 'sell'} entry`
      });
      await transaction.save();
    } catch (txErr) {
      // Log but don't fail the asset addition if transaction creation fails
      console.warn('Failed to create transaction record for asset:', txErr.message);
    }

    return portfolio;
  }

  async updateAsset(userId, assetId, updates) {
    const portfolio = await this.ensureUserPortfolio(userId);
    const asset = portfolio.assets.id(assetId);
    if (!asset) throw new Error('Asset not found');
    
    // Map purchaseDate to acquiredAt if provided
    if (updates.purchaseDate) {
      updates.acquiredAt = new Date(updates.purchaseDate);
      delete updates.purchaseDate;
    }
    
    Object.assign(asset, updates);
    await this.updatePortfolioMetrics(portfolio);
    await portfolio.save();
    return portfolio;
  }

  async deleteAsset(userId, assetId) {
    const portfolio = await this.ensureUserPortfolio(userId);
    portfolio.assets.pull(assetId);
    await this.updatePortfolioMetrics(portfolio);
    await portfolio.save();
  }

  async getTransactions(userId, { limit = 50, skip = 0 } = {}) {
    const Transaction = require('../models/transaction.model');
    const [transactions, total] = await Promise.all([
      Transaction.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Transaction.countDocuments({ userId }),
    ]);
    return { items: transactions, total };
  }

  async importTransactionsCSV(userId, csvText) {
    const lines = csvText.split('\n').filter(Boolean);
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = lines.slice(1);
    const imported = [];
    const errors   = [];

    for (const row of rows) {
      try {
        const vals = row.split(',').map(v => v.trim());
        const obj  = Object.fromEntries(headers.map((h, i) => [h, vals[i]]));
        // Expected CSV columns: symbol, type (buy/sell), amount, price, date
        if (!obj.symbol || !obj.type || !obj.amount || !obj.price) continue;
        const amount   = parseFloat(obj.amount);
        const price    = parseFloat(obj.price);
        await this.addAsset(userId, {
          symbol:       obj.symbol,
          name:         obj.name || obj.symbol,
          type:         obj.assettype || 'crypto',
          amount:       obj.type.toLowerCase() === 'sell' ? -amount : amount,
          costBasis:    price,
          purchaseDate: obj.date ? new Date(obj.date) : new Date(),
        });
        imported.push(obj.symbol);
      } catch (err) {
        errors.push({ row, error: err.message });
      }
    }
    return { imported: imported.length, errors };
  }
}

module.exports = new PortfolioService();
