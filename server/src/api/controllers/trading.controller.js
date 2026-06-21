const tradingService = require('../../services/trading.service');
const paperTradingService = require('../../services/paper-trading.service');
const { logger } = require('../middlewares/logger.middleware');

class TradingController {
  async placeOrder(req, res, next) {
    try {
      const order = await tradingService.placeOrder(req.user.userId, req.validatedData.body);
      res.status(201).json({
        status: 'success',
        data: order
      });
    } catch (error) {
      next(error);
    }
  }

  // Paper Trading Endpoints
  async initializePaperAccount(req, res, next) {
    try {
      const portfolio = await paperTradingService.initializePaperAccount(req.user.userId);
      res.status(201).json({
        status: 'success',
        message: 'Paper trading account initialized',
        data: portfolio
      });
    } catch (error) {
      next(error);
    }
  }

  async placePaperTrade(req, res, next) {
    try {
      const result = await paperTradingService.placePaperTrade(req.user.userId, req.validatedData.body);
      res.status(201).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getPaperPortfolio(req, res, next) {
    try {
      const portfolio = await paperTradingService.getPaperPortfolio(req.user.userId);
      res.json({
        status: 'success',
        data: portfolio
      });
    } catch (error) {
      next(error);
    }
  }

  async getPaperTradeHistory(req, res, next) {
    try {
      const { symbol, limit } = req.validatedData.query || {};
      const trades = await paperTradingService.getPaperTradeHistory(
        req.user.userId,
        symbol,
        limit
      );
      res.json({
        status: 'success',
        data: trades
      });
    } catch (error) {
      next(error);
    }
  }

  async resetPaperAccount(req, res, next) {
    try {
      const portfolio = await paperTradingService.resetPaperAccount(req.user.userId);
      res.json({
        status: 'success',
        message: 'Paper trading account reset',
        data: portfolio
      });
    } catch (error) {
      next(error);
    }
  }

  async closePaperAccount(req, res, next) {
    try {
      const result = await paperTradingService.closePaperAccount(req.user.userId);
      res.json({
        status: 'success',
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  // Original Trading Endpoints

  async getOpenOrders(req, res, next) {
    try {
      const { symbol } = req.validatedData.query || {};
      const orders = await tradingService.getOpenOrders(req.user.userId, symbol);
      res.json({
        status: 'success',
        data: orders
      });
    } catch (error) {
      next(error);
    }
  }

  async getOrderHistory(req, res, next) {
    try {
      const { symbol, from, to, limit } = req.validatedData.query || {};
      const orders = await tradingService.getOrderHistory(
        req.user.userId,
        symbol,
        from,
        to,
        limit
      );
      res.json({
        status: 'success',
        data: orders
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelOrder(req, res, next) {
    try {
      const { id } = req.validatedData.params;
      await tradingService.cancelOrder(req.user.userId, id);
      res.json({
        status: 'success',
        message: 'Order cancelled successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async getOrderBook(req, res, next) {
    try {
      const { symbol, limit } = req.validatedData.query || {};
      const orderBook = await tradingService.getOrderBook(symbol, limit);
      res.json({
        status: 'success',
        data: orderBook
      });
    } catch (error) {
      next(error);
    }
  }

  async getRecentTrades(req, res, next) {
    try {
      const { symbol, limit } = req.validatedData.query || {};
      const trades = await tradingService.getRecentTrades(symbol, limit);
      res.json({
        status: 'success',
        data: trades
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TradingController();