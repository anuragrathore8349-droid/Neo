// server/src/api/controllers/portfolio.controller.js — REPLACE ENTIRE FILE
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
      const { limit = 50, skip = 0 } = req.validatedData?.query || {};
      const result = await portfolioService.getAllAssets(req.user.userId, { limit, skip });
      res.json({
        status: 'success',
        data: result.items,
        pagination: { limit, skip, total: result.total }
      });
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

  async getAssetAllocation(req, res, next) {
    try {
      const data = await portfolioService.getAssetAllocation(req.user.userId);
      res.json({ status: 'success', data });
    } catch (error) { next(error); }
  }

  async getRebalanceSuggestions(req, res, next) {
    try {
      const suggestions = await portfolioService.getRebalanceSuggestions(req.user.userId);
      res.json({ status: 'success', data: suggestions });
    } catch (error) { next(error); }
  }

  // ── NEW: AI-powered portfolio rebalance (POST /:portfolioId/rebalance) ──
  async rebalancePortfolio(req, res, next) {
    try {
      const { portfolioId } = req.params;
      const { objective = 'sharpe', dryRun = false } = req.body || {};

      if (!portfolioId) {
        return res.status(400).json({ status: 'error', message: 'portfolioId is required' });
      }

      const result = await portfolioService.rebalancePortfolio(
        req.user.userId,
        portfolioId,
        objective,
        dryRun
      );

      // dryRun returns status 'preview', apply returns 'success'
      res.json({ status: result.status || 'success', data: result });
    } catch (error) {
      logger.error('Rebalance error:', error);
      next(error);
    }
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
      const { limit = 50, skip = 0 } = req.validatedData?.query || {};
      const result = await portfolioService.getTransactions(req.user.userId, {
        limit, skip
      });
      res.json({
        status: 'success',
        data: result.items,
        pagination: { limit, skip, total: result.total }
      });
    } catch (error) { next(error); }
  }

  async importTransactionsCSV(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'No CSV file uploaded' });
      }
      const result = await portfolioService.importTransactionsCSV(
        req.user.userId,
        req.file.buffer.toString('utf-8')
      );
      res.json({ status: 'success', data: result });
    } catch (error) { next(error); }
  }
}

module.exports = new PortfolioController();