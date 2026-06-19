const portfolioService = require('../../services/portfolio.service');

class PortfolioController {
  async getPortfolioSummary(req, res, next) {
    try {
      const summary = await portfolioService.getPortfolioSummary(req.user.userId);
      res.json({
        status: 'success',
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }
async getAssetPriceHistory(req, res, next) {
  try {
    const { symbol } = req.params;
    const { timeframe } = req.query;
    const history = await portfolioService.getAssetPriceHistory(
      req.user.userId,
      symbol,
      timeframe
    );
    res.json({ status: 'success', data: history });
  } catch (error) {
    next(error);
  }
}
  async getAllAssets(req, res, next) {
    try {
      const assets = await portfolioService.getAllAssets(req.user.userId);
      res.json({
        status: 'success',
        data: assets
      });
    } catch (error) {
      next(error);
    }
  }

  async getAssetDetails(req, res, next) {
    try {
      const asset = await portfolioService.getAssetDetails(
        req.user.userId,
        req.params.id
      );
      res.json({
        status: 'success',
        data: asset
      });
    } catch (error) {
      next(error);
    }
  }

  async getPortfolioHistory(req, res, next) {
    try {
      const { timeframe } = req.query;
      const history = await portfolioService.getPortfolioHistory(
        req.user.userId,
        timeframe
      );
      const response = { status: 'success', data: history };
      if (!Array.isArray(history) || history.length === 0) {
        response.meta = { message: 'No historical data available yet' };
      }
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getPortfolioExport(req, res, next) {
    try {
      const exportData = await portfolioService.getPortfolioExport(req.user.userId);
      res.json({
        status: 'success',
        data: exportData
      });
    } catch (error) {
      next(error);
    }
  }

  async getPerformanceMetrics(req, res, next) {
    try {
      const metrics = await portfolioService.getPerformanceMetrics(req.user.userId);
      res.json({
        status: 'success',
        data: metrics
      });
    } catch (error) {
      next(error);
    }
  }

  async getAssetAllocation(req, res, next) {
    try {
      const allocation = await portfolioService.getAssetAllocation(req.user.userId);
      res.json({
        status: 'success',
        data: allocation
      });
    } catch (error) {
      next(error);
    }
  }

  async createPortfolio(req, res, next) {
    try {
      // DEFENSIVE: Validate that all numeric fields are actually numbers BEFORE passing to service
      const body = req.validatedData.body;
      if (body.assets && Array.isArray(body.assets)) {
        body.assets.forEach((asset, idx) => {
          // Check if any numeric field is an object (this would cause Mongoose validation errors)
          const numericFields = ['amount', 'costBasis', 'currentPrice', 'value', 'profit', 'profitPercentage', 'allocation'];
          numericFields.forEach(field => {
            if (typeof asset[field] === 'object' && asset[field] !== null) {
              // Log the problematic data
              logger.error(`CRITICAL: Asset ${idx} field "${field}" is an object:`, asset[field]);
              throw new Error(`Asset field ${field} must be a number, not an object. Received: ${JSON.stringify(asset[field])}`);
            }
          });
        });
      }
      
      const portfolio = await portfolioService.createPortfolio(
        req.user.userId,
        body
      );
      res.status(201).json({
        status: 'success',
        data: portfolio
      });
    } catch (error) {
      next(error);
    }
  }

  async addAssetToPortfolio(req, res, next) {
    try {
      const assetData = req.body;
      
      // Validate that numeric fields are numbers, not objects
      const numericFields = ['amount', 'costBasis', 'currentPrice', 'value', 'profit', 'profitPercentage', 'allocation'];
      numericFields.forEach(field => {
        if (typeof assetData[field] === 'object' && assetData[field] !== null) {
          throw new Error(`Asset field ${field} must be a number, not an object. Received: ${JSON.stringify(assetData[field])}`);
        }
      });

      const portfolio = await portfolioService.addAssetToPortfolio(
        req.user.userId,
        assetData
      );
      res.status(201).json({
        status: 'success',
        data: portfolio
      });
    } catch (error) {
      next(error);
    }
  }

  async removeAssetFromPortfolio(req, res, next) {
    try {
      const result = await portfolioService.removeAssetFromPortfolio(
        req.user.userId,
        req.params.assetId
      );
      res.json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateAsset(req, res, next) {
    try {
      const result = await portfolioService.updateAsset(
        req.user.userId,
        req.params.assetId,
        req.body
      );
      res.json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  async updatePortfolio(req, res, next) {
    try {
      const portfolio = await portfolioService.updatePortfolio(
        req.user.userId,
        req.params.id,
        req.validatedData.body
      );
      res.json({
        status: 'success',
        data: portfolio
      });
    } catch (error) {
      next(error);
    }
  }

  async deletePortfolio(req, res, next) {
    try {
      await portfolioService.deletePortfolio(req.user.userId, req.params.id);
      res.json({
        status: 'success',
        message: 'Portfolio deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
  async optimizePortfolio(req, res, next) {
  try {
    const { optimizePortfolio } = require('../utils/portfolio');
    const portfolio = await portfolioService.ensureUserPortfolio(req.user.userId);
    const { objective = 'sharpe', constraints = {} } = req.body;

    const history = await portfolioService.getPortfolioHistory(req.user.userId, '1y');

    // Build per-asset price series from history (simplified: use total value series)
    const symbols = portfolio.assets.map(a => a.symbol);
    const historicalData = symbols.map(() => history.map(h => h.value || 0));

    const result = await optimizePortfolio(
      portfolio.assets.map(a => ({ symbol: a.symbol, amount: a.amount })),
      historicalData,
      constraints,
      objective
    );

    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}
}

module.exports = new PortfolioController();