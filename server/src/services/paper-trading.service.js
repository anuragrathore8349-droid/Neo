const { v4: uuidv4 } = require('uuid');
const { logger } = require('../api/middlewares/logger.middleware');
const { redisClient } = require('../config/database');
const PaperTrade = require('../models/paper-trade.model');
const PaperPortfolio = require('../models/paper-portfolio.model');
const krakenService = require('./kraken.service');
const marketService = require('./market.service');

/**
 * Paper Trading Service - Simulated trading for learning without risk
 * Users practice trading with virtual money at real market prices
 */
class PaperTradingService {
  constructor() {
    this.INITIAL_BALANCE = parseFloat(process.env.PAPER_TRADING_INITIAL_BALANCE) || 10000;
    this.CACHE_DURATION = 300; // 5 minutes
  }

  /**
   * Initialize paper trading account for a user
   */
  async initializePaperAccount(userId) {
    try {
      // Check if account already exists
      let portfolio = await PaperPortfolio.findOne({ userId });
      if (portfolio) {
        logger.info(`Paper trading account already exists for user ${userId}`);
        return portfolio;
      }

      // Create new paper portfolio
      portfolio = new PaperPortfolio({
        userId,
        balance: this.INITIAL_BALANCE,
        investedAmount: 0,
        holdings: [],
        trades: [],
        profitLoss: 0,
        profitLossPercentage: 0,
        createdAt: new Date()
      });

      await portfolio.save();
      logger.info(`Initialized paper trading account for user ${userId} with balance $${this.INITIAL_BALANCE}`);
      return portfolio;
    } catch (error) {
      logger.error('Error initializing paper trading:', error);
      throw error;
    }
  }

  /**
   * Place a simulated paper trade
   */
  async placePaperTrade(userId, tradeData) {
    try {
      const { symbol, side, amount, price: specifiedPrice, type = 'market' } = tradeData;

      // Validate input
      if (!symbol || !side || !amount) {
        throw new Error('Missing required trade data: symbol, side, amount');
      }

      if (!['buy', 'sell'].includes(side)) {
        throw new Error('Side must be "buy" or "sell"');
      }

      // Get current portfolio
      let portfolio = await PaperPortfolio.findOne({ userId });
      if (!portfolio) {
        portfolio = await this.initializePaperAccount(userId);
      }

      // Get current price (Kraken preferred, fallback to CoinGecko)
      let currentPrice = specifiedPrice;
      if (!currentPrice) {
        try {
          const priceData = await krakenService.getLivePrice(symbol);
          currentPrice = priceData.price;
        } catch (krakenError) {
          logger.warn(`Kraken failed for ${symbol}, falling back to marketService`, krakenError.message);
          const prices = await marketService.getLivePrices([symbol]);
          currentPrice = prices[symbol]?.price;
        }
      }

      if (!currentPrice || currentPrice <= 0) {
        throw new Error(`Could not get valid price for ${symbol}`);
      }

      const totalValue = amount * currentPrice;

      // Validate balance for buy orders
      if (side === 'buy' && totalValue > portfolio.balance) {
        throw new Error(`Insufficient balance. Need $${totalValue.toFixed(2)}, have $${portfolio.balance.toFixed(2)}`);
      }

      // Check holdings for sell orders
      if (side === 'sell') {
        const holding = portfolio.holdings.find(h => h.symbol.toUpperCase() === symbol.toUpperCase());
        if (!holding || holding.quantity < amount) {
          throw new Error(`Insufficient ${symbol} to sell. Have ${holding?.quantity || 0}, trying to sell ${amount}`);
        }
      }

      // Create trade record
      const trade = {
        tradeId: uuidv4(),
        symbol: symbol.toUpperCase(),
        side,
        quantity: amount,
        price: currentPrice,
        totalValue,
        type,
        status: 'filled',  // Paper trades execute immediately
        timestamp: new Date(),
        profitLoss: 0,
        profitLossPercentage: 0
      };

      // Update portfolio based on trade type
      if (side === 'buy') {
        portfolio.balance -= totalValue;
        portfolio.investedAmount += totalValue;

        // Update or add holding
        const existingHolding = portfolio.holdings.find(
          h => h.symbol.toUpperCase() === symbol.toUpperCase()
        );

        if (existingHolding) {
          const totalCost = (existingHolding.quantity * existingHolding.avgPrice) + totalValue;
          existingHolding.quantity += amount;
          existingHolding.avgPrice = totalCost / existingHolding.quantity;
          existingHolding.lastPrice = currentPrice;
          existingHolding.lastUpdated = new Date();
        } else {
          portfolio.holdings.push({
            symbol: symbol.toUpperCase(),
            quantity: amount,
            avgPrice: currentPrice,
            lastPrice: currentPrice,
            purchasedAt: new Date(),
            lastUpdated: new Date()
          });
        }
      } else if (side === 'sell') {
        const holding = portfolio.holdings.find(h => h.symbol.toUpperCase() === symbol.toUpperCase());
        const costBasis = holding.quantity * holding.avgPrice;
        const saleValue = amount * currentPrice;

        // Calculate profit/loss
        trade.profitLoss = saleValue - (amount * holding.avgPrice);
        trade.profitLossPercentage = (trade.profitLoss / (amount * holding.avgPrice)) * 100;

        portfolio.balance += saleValue;
        portfolio.investedAmount -= amount * holding.avgPrice;

        // Update holding
        holding.quantity -= amount;
        if (holding.quantity === 0) {
          portfolio.holdings = portfolio.holdings.filter(h => h.symbol !== holding.symbol);
        } else {
          holding.lastPrice = currentPrice;
          holding.lastUpdated = new Date();
        }
      }

      // Add trade to history
      portfolio.trades.push(trade);

      // Calculate portfolio P&L
      portfolio.profitLoss = 0;
      for (const holding of portfolio.holdings) {
        const holdingValue = holding.quantity * holding.lastPrice;
        const holdingCost = holding.quantity * holding.avgPrice;
        portfolio.profitLoss += (holdingValue - holdingCost);
      }
      portfolio.profitLoss += portfolio.trades
        .filter(t => t.side === 'sell')
        .reduce((sum, t) => sum + (t.profitLoss || 0), 0);

      portfolio.profitLossPercentage = this.INITIAL_BALANCE > 0
        ? (portfolio.profitLoss / this.INITIAL_BALANCE) * 100
        : 0;

      await portfolio.save();

      logger.info(`Paper trade executed: ${side.toUpperCase()} ${amount} ${symbol} at $${currentPrice}`);

      return {
        trade,
        portfolio: {
          balance: portfolio.balance,
          investedAmount: portfolio.investedAmount,
          holdings: portfolio.holdings,
          profitLoss: portfolio.profitLoss,
          profitLossPercentage: portfolio.profitLossPercentage
        }
      };
    } catch (error) {
      logger.error('Error placing paper trade:', error);
      throw error;
    }
  }

  /**
   * Get paper trading portfolio for a user
   */
  async getPaperPortfolio(userId) {
    try {
      let portfolio = await PaperPortfolio.findOne({ userId });
      if (!portfolio) {
        portfolio = await this.initializePaperAccount(userId);
      }

      // Update current prices for holdings
      if (portfolio.holdings && portfolio.holdings.length > 0) {
        const symbols = portfolio.holdings.map(h => h.symbol);
        let prices = {};

        try {
          prices = await krakenService.getLivePrices(symbols);
        } catch (krakenError) {
          logger.warn('Kraken failed for portfolio prices, falling back to marketService');
          prices = await marketService.getLivePrices(symbols);
        }

        // Update holding prices and P&L
        for (const holding of portfolio.holdings) {
          const priceData = prices[holding.symbol];
          if (priceData) {
            holding.lastPrice = priceData.price;
            holding.lastUpdated = new Date();
          }
        }
      }

      // Recalculate portfolio metrics
      let totalValue = portfolio.balance;
      portfolio.profitLoss = 0;

      for (const holding of portfolio.holdings) {
        const holdingValue = holding.quantity * holding.lastPrice;
        const holdingCost = holding.quantity * holding.avgPrice;
        const holdingPL = holdingValue - holdingCost;

        totalValue += holdingValue;
        portfolio.profitLoss += holdingPL;
      }

      // Add realized P&L from closed positions
      portfolio.profitLoss += portfolio.trades
        .filter(t => t.side === 'sell')
        .reduce((sum, t) => sum + (t.profitLoss || 0), 0);

      portfolio.profitLossPercentage = this.INITIAL_BALANCE > 0 ? 
        (portfolio.profitLoss / this.INITIAL_BALANCE) * 100 : 0;

      return portfolio;
    } catch (error) {
      logger.error('Error fetching paper portfolio:', error);
      throw error;
    }
  }

  /**
   * Get paper trading history
   */
  async getPaperTradeHistory(userId, symbol = null, limit = 50, skip = 0) {
    try {
      const portfolio = await PaperPortfolio.findOne({ userId });
      if (!portfolio) {
        return { items: [], total: 0 };
      }

      let trades = portfolio.trades || [];

      if (symbol) {
        trades = trades.filter(t => t.symbol.toUpperCase() === symbol.toUpperCase());
      }

      // Sort by most recent first
      trades = trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const total = trades.length;
      const items = trades.slice(skip, skip + limit);
      
      return { items, total };
    } catch (error) {
      logger.error('Error fetching paper trade history:', error);
      throw error;
    }
  }

  /**
   * Close paper trading account (optional)
   */
  async closePaperAccount(userId) {
    try {
      await PaperPortfolio.findOneAndDelete({ userId });
      logger.info(`Paper trading account closed for user ${userId}`);
      return { message: 'Paper trading account closed' };
    } catch (error) {
      logger.error('Error closing paper account:', error);
      throw error;
    }
  }

  /**
   * Reset paper trading account
   */
  async resetPaperAccount(userId) {
    try {
      const portfolio = await PaperPortfolio.findOne({ userId });
      if (!portfolio) {
        return this.initializePaperAccount(userId);
      }

      portfolio.balance = this.INITIAL_BALANCE;
      portfolio.investedAmount = 0;
      portfolio.holdings = [];
      portfolio.trades = [];
      portfolio.profitLoss = 0;
      portfolio.profitLossPercentage = 0;
      portfolio.createdAt = new Date();

      await portfolio.save();
      logger.info(`Paper trading account reset for user ${userId}`);
      return portfolio;
    } catch (error) {
      logger.error('Error resetting paper account:', error);
      throw error;
    }
  }
}

module.exports = new PaperTradingService();
