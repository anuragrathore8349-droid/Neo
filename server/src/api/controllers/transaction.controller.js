const transactionService = require('../../services/transaction.service');

class TransactionController {
  async getRecentTransactions(req, res, next) {
    try {
      const { limit = 50, skip = 0 } = req.validatedData?.query || {};
      const result = await transactionService.getRecentTransactions(
        req.user.userId,
        limit,
        skip
      );
      res.json({
        status: 'success',
        data: result.items,
        pagination: { limit, skip, total: result.total }
      });
    } catch (error) {
      next(error);
    }
  }

  async getTransactionById(req, res, next) {
    try {
      const transaction = await transactionService.getTransactionById(
        req.user.userId,
        req.params.id
      );
      res.json({
        status: 'success',
        data: transaction
      });
    } catch (error) {
      next(error);
    }
  }

  async getTransactionsByAsset(req, res, next) {
    try {
      const { asset } = req.params;
      const { limit = 50, skip = 0 } = req.validatedData?.query || {};
      const result = await transactionService.getTransactionsByAsset(
        req.user.userId,
        asset,
        limit,
        skip
      );
      res.json({
        status: 'success',
        data: result.items,
        pagination: { limit, skip, total: result.total }
      });
    } catch (error) {
      next(error);
    }
  }

  async getTransactionsByType(req, res, next) {
    try {
      const { type } = req.params;
      const { limit = 50, skip = 0 } = req.validatedData?.query || {};
      const result = await transactionService.getTransactionsByType(
        req.user.userId,
        type,
        limit,
        skip
      );
      res.json({
        status: 'success',
        data: result.items,
        pagination: { limit, skip, total: result.total }
      });
    } catch (error) {
      next(error);
    }
  }

  async getTransactionStats(req, res, next) {
    try {
      const stats = await transactionService.getTransactionStats(req.user.userId);
      res.json({
        status: 'success',
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  async createTransaction(req, res, next) {
    try {
      const transaction = await transactionService.createTransaction(
        req.user.userId,
        req.validatedData.body
      );
      res.status(201).json({
        status: 'success',
        data: transaction
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TransactionController();