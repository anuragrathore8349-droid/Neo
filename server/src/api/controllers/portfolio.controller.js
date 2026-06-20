const portfolioService = require('../../services/portfolio.service');
const { logger } = require('../middlewares/logger.middleware');

class PortfolioController {
  async getPortfolioSummary(req, res, next) {
    try {
      const summary = await portfolioService.getPortfolioSummary(req.user.userId);
      res.json({ status: 'success', data: summary });
    } catch (error) { next(error); }
  }

  async getAllAssets(req, res, next) {
    try {
      const assets = await portfolioService.getAllAssets(req.user.userId);
      res.json({ status: 'success', data: assets });
    } catch (error) { next(error); }
  }

  async getAssetDetails(req, res, next) {
    try {
      const asset = await portfolioService.getAssetDetails(req.user.userId, req.params.id);
      res.json({ status: 'success', data: asset });
    } catch (error) { next(error); }
  }

  async getPortfolioHistory(req, res, next) {
    try {
      const { timeframe } = req.query;
      const history = await portfolioService.getPortfolioHistory(req.user.userId, timeframe);
      res.json({ status: 'success', data: history });
    } catch (error) { next(error); }
  }

  async getPortfolioExport(req, res, next) {
    try {
      const data = await portfolioService.getPortfolioExport(req.user.userId);
      res.json({ status: 'success', data });
    } catch (error) { next(error); }
  }

  async getPerformanceMetrics(req, res, next) {
    try {
      const { timeframe } = req.query;
      const metrics = await portfolioService.getPerformanceMetrics(req.user.userId, timeframe);
      res.json({ status: 'success', data: metrics });
    } catch (error) { next(error); }
  }

  async getRebalanceSuggestions(req, res, next) {
    try {
      const suggestions = await portfolioService.getRebalanceSuggestions(req.user.userId);
      res.json({ status: 'success', data: suggestions });
    } catch (error) { next(error); }
  }

  async getAssetPriceHistory(req, res, next) {
    try {
      const { symbol } = req.params;
      const { timeframe } = req.query;
      const history = await portfolioService.getAssetPriceHistory(req.user.userId, symbol, timeframe);
      res.json({ status: 'success', data: history });
    } catch (error) { next(error); }
  }

  // ── Asset CRUD ────────────────────────────────────────────────────────────

  async addAsset(req, res, next) {
    try {
      const asset = await portfolioService.addAsset(req.user.userId, req.validatedData.body);
      res.status(201).json({ status: 'success', data: asset });
    } catch (error) { next(error); }
  }

  async updateAsset(req, res, next) {
    try {
      const asset = await portfolioService.updateAsset(
        req.user.userId, req.params.id, req.validatedData.body
      );
      res.json({ status: 'success', data: asset });
    } catch (error) { next(error); }
  }

  async deleteAsset(req, res, next) {
    try {
      await portfolioService.deleteAsset(req.user.userId, req.params.id);
      res.json({ status: 'success', message: 'Asset removed' });
    } catch (error) { next(error); }
  }

  // ── Transactions ──────────────────────────────────────────────────────────

  async getTransactions(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const data = await portfolioService.getTransactions(req.user.userId, { page: +page, limit: +limit });
      res.json({ status: 'success', data });
    } catch (error) { next(error); }
  }

  async importTransactionsCSV(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ status: 'error', message: 'No CSV file uploaded' });
      const result = await portfolioService.importTransactionsCSV(req.user.userId, req.file.buffer.toString());
      res.json({ status: 'success', data: result });
    } catch (error) { next(error); }
  }
}

module.exports = new PortfolioController();
      }

      const csvText = req.file.buffer.toString('utf-8');
      const lines   = csvText.split('\n').filter(Boolean);
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      const assets = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const row  = Object.fromEntries(headers.map((h, j) => [h, cols[j]?.trim()]));

        if (row.symbol && row.amount) {
          assets.push({
            symbol:   row.symbol.toUpperCase(),
            name:     row.name || row.symbol.toUpperCase(),
            type:     row.type || 'crypto',
            amount:   parseFloat(row.amount),
            costBasis: parseFloat(row.cost_basis || row.costbasis || 0),
            purchaseDate: row.date ? new Date(row.date) : new Date(),
          });
        }
      }

      const result = await portfolioService.addMultipleAssets(req.user.userId, assets);
      res.json({ status: 'success', data: result, imported: assets.length });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PortfolioController();
