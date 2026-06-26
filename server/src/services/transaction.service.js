const Transaction = require('../models/transaction.model');
const { logger } = require('../api/middlewares/logger.middleware');
const marketService = require('./market.service');
const { inferAssetType } = require('../utils/assetTypes');

class TransactionService {
    
    
  

  async getRecentTransactions(userId, limit = 50, skip = 0) {
    // ✅ No dummy data - only return REAL transactions created by user
    const query = { userId };
    const total = await Transaction.countDocuments(query);
    const transactions = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    // Get unique symbols to fetch prices
    const symbols = [...new Set(transactions.map(tx => tx.asset))];
    let prices = {};
    
    try {
      prices = await marketService.getMarketPrices(symbols);
    } catch (error) {
      logger.warn('Failed to fetch market prices for transactions:', error.message);
      // Continue with price = 0 as fallback
    }

    // Transform to match frontend interface
    const items = transactions.map(tx => {
      // Get price for this asset (fallback to 0 if not available)
      let txPrice = 0;
      if (prices[tx.asset]) {
        const rawPrice = prices[tx.asset];
        if (typeof rawPrice === 'number') {
          txPrice = rawPrice;
        } else if (typeof rawPrice === 'object' && rawPrice !== null) {
          txPrice = rawPrice.price ?? rawPrice.value ?? rawPrice.p ?? rawPrice.c ?? 0;
        } else {
          txPrice = Number(rawPrice) || 0;
        }
      }

      const total = tx.amount * txPrice;

      return {
        id: tx._id.toString(),
        type: this.mapTransactionType(tx.type),
        asset: {
          id: tx.asset.toLowerCase(),
          name: tx.assetName || this.getAssetName(tx.asset),
          symbol: tx.asset,
          type: this.getAssetType(tx.asset),
          price: txPrice,
          change24h: 0
        },
        quantity: tx.amount,
        price: txPrice,
        total: total,
        fee: tx.fee,
        date: tx.timestamp.toISOString(),
        status: tx.status
      };
    });

    return { items, total };
  }

  async createTransaction(userId, transactionData) {
    const transaction = new Transaction({
      userId,
      ...transactionData,
      // Store name at creation time so it's always available
      assetName: transactionData.assetName || this.getAssetName(transactionData.asset)
    });

    return transaction.save();
  }

  async getTransactionById(userId, transactionId) {
    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return transaction;
  }

async getTransactionsByAsset(userId, asset, limit = 50, skip = 0) {
  const query = {
    userId,
    asset: asset.toUpperCase()
  };
  const total = await Transaction.countDocuments(query);
  const transactions = await Transaction.find(query)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit);

  // Fetch live price for this asset
  let price = 0;
  try {
    const prices = await marketService.getMarketPrices([asset.toUpperCase()]);
    const rawPrice = prices[asset.toUpperCase()];
    if (typeof rawPrice === 'number') {
      price = rawPrice;
    } else if (typeof rawPrice === 'object' && rawPrice !== null) {
      price = rawPrice.price ?? rawPrice.value ?? rawPrice.p ?? rawPrice.c ?? 0;
    }
  } catch (e) {
    logger.warn('Failed to fetch price for getTransactionsByAsset:', e.message);
  }

  // Transform exactly like getRecentTransactions()
  const items = transactions.map(tx => ({
    id: tx._id.toString(),
    type: this.mapTransactionType(tx.type),
    asset: {
      id: tx.asset.toLowerCase(),
      name: tx.assetName || this.getAssetName(tx.asset),
      symbol: tx.asset,
      type: this.getAssetType(tx.asset),
      price,
      change24h: 0
    },
    quantity: tx.amount,
    price,
    total: tx.amount * price,
    fee: tx.fee || 0,
    date: tx.timestamp ? tx.timestamp.toISOString() : tx.createdAt.toISOString(),
    status: tx.status
  }));

  return { items, total };
}
  async getTransactionsByType(userId, type, limit = 50, skip = 0) {
    const query = { userId, type };
    const total = await Transaction.countDocuments(query);
    const transactions = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    return { items: transactions, total };
  }

  async getTransactionStats(userId) {
    const stats = await Transaction.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalVolume: { $sum: '$amount' },
          totalFees: { $sum: '$fee' },
          completedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      }
    ]);

    return stats[0] || {
      totalTransactions: 0,
      totalVolume: 0,
      totalFees: 0,
      completedTransactions: 0
    };
  }

  // Helper methods
mapTransactionType(dbType) {
  const typeMap = {
    'deposit': 'buy',       // legacy mapping — deposits shown as buys
    'withdrawal': 'sell',   // legacy mapping — withdrawals shown as sells
    'transfer': 'transfer',
    // New types pass through unchanged:
    'buy': 'buy',
    'sell': 'sell',
    'swap': 'swap',
    'stake': 'stake',
    'unstake': 'unstake'
  };
  return typeMap[dbType] || dbType;
}
  getAssetName(symbol) {
    const names = {
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
      'USDT': 'Tether',
      'BNB': 'Binance Coin',
      'USDC': 'USD Coin',
      'XRP': 'Ripple',
      'ADA': 'Cardano',
      'SOL': 'Solana',
      'DOT': 'Polkadot',
      'DOGE': 'Dogecoin',
      'AVAX': 'Avalanche',
      'MATIC': 'Polygon',
      'LTC': 'Litecoin'
    };
    return names[symbol] || symbol;
  }

  getAssetType(symbol) {
    return inferAssetType(symbol);
  }
}

module.exports = new TransactionService();