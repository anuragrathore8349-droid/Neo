// FILE: src/api/controllers/wallet.controller.js
const walletService = require('../../services/wallet.service');
const { logger } = require('../middlewares/logger.middleware');
const Wallet = require('../../models/wallet.model');
const Transaction = require('../../models/transaction.model');

class WalletController {
  async getWallets(req, res, next) {
    try {
      const wallets = await walletService.getWallets(req.user.userId);
      res.json({ status: 'success', data: wallets });
    } catch (error) { next(error); }
  }

  async connectWallet(req, res, next) {
    try {
      const wallet = await walletService.connectWallet(req.user.userId, req.validatedData.body);
      res.status(201).json({ status: 'success', data: wallet });
    } catch (error) { next(error); }
  }

  async removeWallet(req, res, next) {
    try {
      await walletService.removeWallet(req.user.userId, req.validatedData.params.id);
      res.json({ status: 'success', message: 'Wallet removed successfully' });
    } catch (error) { next(error); }
  }

  async getTransactions(req, res, next) {
    try {
      const { limit, skip } = req.validatedData.query;
      const transactions = await walletService.getTransactions(req.user.userId, { ...req.validatedData.query, limit, skip });
      res.json({ status: 'success', data: transactions });
    } catch (error) { next(error); }
  }

  async withdrawFunds(req, res, next) {
    try {
      const withdrawal = await walletService.withdrawFunds(req.user.userId, req.validatedData.body);
      res.json({ status: 'success', data: withdrawal });
    } catch (error) { next(error); }
  }

  async getDepositAddress(req, res, next) {
    try {
      const depositInfo = await walletService.getDepositAddress(req.user.userId, req.validatedData.body);
      if (!depositInfo || !depositInfo.address) {
        return res.status(422).json({ status: 'error', message: 'Could not generate a deposit address for this wallet type.' });
      }
      return res.json({ status: 'success', data: depositInfo });
    } catch (error) { next(error); }
  }

  // ✅ Live gas prices from on-chain
  async getGasPrices(req, res, next) {
    try {
      const prices = await walletService.getGasPrices();
      res.json({ status: 'success', data: prices });
    } catch (error) { next(error); }
  }

  async cacheTransactions(req, res, next) {
    try {
      const { walletId, transactions } = req.validatedData.body;

      const wallet = await Wallet.findOne({ _id: walletId, userId: req.user.userId });
      if (!wallet) throw new Error('Wallet not found');

      const txHashes = transactions.map(tx => tx.hash);

      await Transaction.deleteMany({ walletId, txHash: { $in: txHashes } });

      const txsToInsert = transactions.map(tx => ({
        userId:             req.user.userId,
        walletId,
        type:               tx.type === 'send' ? 'withdrawal' : tx.type === 'receive' ? 'deposit' : 'transfer',
        asset:              tx.asset,
        amount:             parseFloat(tx.value),
        sourceAddress:      tx.from,
        destinationAddress: tx.to,
        network:            tx.network,
        status:             tx.status,
        txHash:             tx.hash,
        timestamp:          new Date(tx.timestamp),
      }));

      await Transaction.insertMany(txsToInsert, { ordered: false }).catch(err => {
        if (err.code !== 11000) throw err;
      });

      res.json({
        status:  'success',
        message: `Cached ${txsToInsert.length} transactions`,
        data:    { count: txsToInsert.length },
      });
    } catch (error) { next(error); }
  }

  async getTransactionStatus(req, res, next) {
    try {
      const { txHash, network } = req.query;
      if (!txHash) return res.status(400).json({ status: 'error', message: 'txHash required' });

      const blockchainTransactionService = require('../../services/blockchain-transaction.service');
      const status = await blockchainTransactionService.getTransactionReceipt(txHash, network);
      res.json({ status: 'success', data: status });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WalletController();