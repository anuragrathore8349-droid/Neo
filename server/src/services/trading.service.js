const ccxt = require('ccxt');
const { v4: uuidv4 } = require('uuid');
const Order = require('../models/order.model');
const Portfolio = require('../models/portfolio.model');
const { logger } = require('../api/middlewares/logger.middleware');
const { redisClient } = require('../config/database');
const paperTradingService = require('./paper-trading.service');
const { scheduleOrderSync } = require('../jobs/orderSync.job');

class TradingService {
  constructor() {
    // Initialize exchange clients safely
    this.exchanges = {
      public: {},
      private: {}
    };

    // Public Binance client for market data
    try {
      this.exchanges.public.binance = new ccxt.binance({
        enableRateLimit: true
      });
    } catch (error) {
      logger.error('Failed to initialize public Binance exchange:', error);
    }

    // Private Binance client for authenticated trading
    const binanceApiKey = process.env.BINANCE_API_KEY?.trim();
    const binanceSecret = process.env.BINANCE_API_SECRET?.trim();

    if (binanceApiKey && binanceSecret) {
      try {
        this.exchanges.private.binance = new ccxt.binance({
          apiKey: binanceApiKey,
          secret: binanceSecret,
          enableRateLimit: true
        });
      } catch (error) {
        logger.error('Failed to initialize private Binance exchange:', error);
      }
    }

    // Coinbase (coinbasepro removed in newer ccxt)
    try {
      this.exchanges.public.coinbase = new ccxt.coinbase({
        enableRateLimit: true
      });
    } catch (error) {
      logger.error('Failed to initialize public Coinbase exchange:', error);
    }

    const coinbaseApiKey = process.env.COINBASE_API_KEY?.trim();
    const coinbaseSecret = process.env.COINBASE_API_SECRET?.trim();
    const coinbasePassword = process.env.COINBASE_PASSPHRASE?.trim();

    if (coinbaseApiKey && coinbaseSecret && coinbasePassword) {
      try {
        this.exchanges.private.coinbase = new ccxt.coinbase({
          apiKey: coinbaseApiKey,
          secret: coinbaseSecret,
          password: coinbasePassword,
          enableRateLimit: true
        });
      } catch (error) {
        logger.error('Failed to initialize private Coinbase exchange:', error);
      }
    }

    // Cache durations (seconds)
    this.CACHE_DURATION = {
      ORDERBOOK: 5,
      TRADES: 10
    };
  }

  getDefaultExchange() {
    return this.exchanges.public.binance ? 'binance' : Object.keys(this.exchanges.public)[0];
  }

  getExchange(exchangeId = 'binance', authenticated = false) {
    if (authenticated) {
      return this.exchanges.private[exchangeId] || null;
    }
    return this.exchanges.public[exchangeId] || null;
  }

  /**
   * Load per-user API keys for live trading
   * Creates an authenticated exchange client with the user's own credentials
   */
  async loadUserApiKeys(userId, exchangeId) {
    try {
      const ApiKey = require('../models/api-key.model');
      const record = await ApiKey.findOne({ userId, exchange: exchangeId, isActive: true });
      if (!record) return null;

      // Dynamically create authenticated exchange client with user's keys
      const ExchangeClass = ccxt[exchangeId.toLowerCase()];
      if (!ExchangeClass) return null;

      return new ExchangeClass({
        apiKey: record.apiKey,
        secret: record.apiSecret,
        password: record.passphrase || undefined,
        enableRateLimit: true,
      });
    } catch (err) {
      logger.warn(`Could not load user API keys for ${exchangeId}:`, err.message);
      return null;
    }
  }

  /**
   * Exchange-specific symbol mappings
   * Different exchanges use different symbols for the same asset
   */
  getExchangeSymbolMap() {
    return {
      binance: {
        'BTC': 'BTCUSDT',
        'ETH': 'ETHUSDT',
        'SOL': 'SOLUSDT',
        'XRP': 'XRPUSDT',
        'ADA': 'ADAUSDT',
        'DOGE': 'DOGEUSDT',
        'DOT': 'DOTUSDT',
        'MATIC': 'MATICUSDT',
        'LINK': 'LINKUSDT',
        'AVAX': 'AVAXUSDT'
      },
      kraken: {
        'BTC': 'XBT',      // Kraken uses XBT instead of BTC
        'ETH': 'ETH',
        'SOL': 'SOL',
        'XRP': 'XRP',
        'ADA': 'ADA',
        'DOGE': 'DOGE',
        'DOT': 'DOT',
        'MATIC': 'MATIC',
        'LINK': 'LINK',
        'AVAX': 'AVAX'
      },
      coinbase: {
        'BTC': 'BTC-USD',
        'ETH': 'ETH-USD',
        'SOL': 'SOL-USD',
        'XRP': 'XRP-USD',
        'ADA': 'ADA-USD',
        'DOGE': 'DOGE-USD',
        'DOT': 'DOT-USD',
        'MATIC': 'MATIC-USD',
        'LINK': 'LINK-USD',
        'AVAX': 'AVAX-USD'
      }
    };
  }

  async normalizeSymbolForExchange(symbol, exchangeId = 'binance') {
    if (!symbol) return symbol;

    // Check exchange-specific mapping first
    const symbolMaps = this.getExchangeSymbolMap();
    const exchangeMap = symbolMaps[exchangeId.toLowerCase()];
    
    if (exchangeMap && exchangeMap[symbol.toUpperCase()]) {
      return exchangeMap[symbol.toUpperCase()];
    }

    // Fallback: use generic normalization for unknown symbols
    let normalized = symbol.toUpperCase().replace(/[-_]/g, '/').replace(/\/\//g, '/');
    if (!normalized.includes('/')) {
      normalized = `${normalized}/USDT`;
    }

    const exchange = this.exchanges.public[exchangeId] || this.exchanges.private[exchangeId];
    if (!exchange) {
      return normalized;
    }

    if (typeof exchange.loadMarkets === 'function') {
      await exchange.loadMarkets();
    }

    if (exchange.markets && exchange.markets[normalized]) {
      return normalized;
    }

    const alternates = [];
    if (normalized.endsWith('/USD')) {
      alternates.push(normalized.replace('/USD', '/USDT'));
      alternates.push(normalized.replace('/USD', '/BUSD'));
    }
    if (normalized.endsWith('/USDT')) {
      alternates.push(normalized.replace('/USDT', '/USD'));
      alternates.push(normalized.replace('/USDT', '/BUSD'));
    }
    if (!normalized.includes('/')) {
      alternates.push(`${normalized}/USDT`, `${normalized}/USD`);
    }

    for (const alt of alternates) {
      if (exchange.markets && exchange.markets[alt]) {
        return alt;
      }
    }

    return normalized;
  }


async placeOrder(userId, orderData) {
  try {
    const {
      symbol, exchange = 'binance', type, side, amount, price,
      stopPrice, timeInForce = 'GTC', postOnly = false, reduceOnly = false,
      stopLoss, takeProfit, clientOrderId,
      mode = 'live',   // 'paper' | 'live'
    } = orderData;

    // ── Paper mode: delegate to paper trading service ─────────────────────
    if (mode === 'paper' || exchange === 'paper') {
      const paperTradingService = require('./paper-trading.service');
      return paperTradingService.placePaperTrade(userId, {
        symbol, side, amount, price, type,
      });
    }

    // ── Validate user has sufficient balance ──────────────────────────────
    await this.validateUserBalance(userId, { symbol, side, amount, price });

    // ── Try user-specific API keys first, fall back to global ─────────────
    let authenticatedExchange = await this.loadUserApiKeys(userId, exchange);
    if (!authenticatedExchange) {
      authenticatedExchange = this.getExchange(exchange, true);
    }
    if (!authenticatedExchange) {
      throw new Error(`No API credentials for exchange: ${exchange}. Add API keys in Settings.`);
    }

    // ── Normalize symbol for exchange ─────────────────────────────────────
    const normalizedSymbol = await this.normalizeSymbolForExchange(symbol, exchange);

    // ── Create order record in DB ─────────────────────────────────────────
    const newOrder = new Order({
      userId,
      symbol:        normalizedSymbol,
      exchange,
      type,
      side,
      amount,
      price:         type !== 'market' ? price : undefined,
      stopPrice,
      timeInForce,
      postOnly,
      reduceOnly,
      status:        'open',
      filledAmount:  0,
      stopLoss,
      takeProfit,
      clientOrderId: clientOrderId || uuidv4(),
    });

    await newOrder.save();

    // ── Submit to exchange ────────────────────────────────────────────────
    try {
      const exchangeOrder = await this.placeExchangeOrder({
        ...orderData,
        symbol:       normalizedSymbol,
        clientOrderId: newOrder.clientOrderId,
      });

      newOrder.exchangeOrderId = exchangeOrder.id;

      // If immediately filled (market order)
      if (['filled', 'closed'].includes(exchangeOrder.status)) {
        newOrder.status             = 'filled';
        newOrder.filledAmount       = exchangeOrder.filled || amount;
        newOrder.averageFilledPrice = exchangeOrder.average || price;
        await newOrder.save();
        await this.updatePortfolio(userId, newOrder);
      } else {
        await newOrder.save();
        // Schedule background status sync
        try { scheduleOrderSync(newOrder._id.toString()); } catch { /* non-critical */ }
      }
    } catch (exchangeError) {
      newOrder.status = 'rejected';
      await newOrder.save();

      // Broadcast rejection to client via WS
      if (global.tradingHandler) {
        global.tradingHandler.broadcastOrderUpdate(userId.toString(), newOrder);
      }

      throw new Error(`Exchange rejected order: ${exchangeError.message}`);
    }

    // ── Broadcast new order via WebSocket ─────────────────────────────────
    if (global.tradingHandler) {
      global.tradingHandler.broadcastOrderUpdate(userId.toString(), newOrder);
    }

    return newOrder;
  } catch (error) {
    logger.error('Error placing order:', error);
    throw error;
  }
}
  normalizeOrderStatus(status) {
    const map = { open: 'open', closed: 'filled', canceled: 'cancelled', cancelled: 'cancelled',
                  partially_filled: 'partially_filled', expired: 'cancelled' };
    return map[status?.toLowerCase()] || 'open';
  }

  async getOpenOrders(userId, symbol = null, { limit = 50, skip = 0 } = {}) {
    try {
      const query = {
        userId,
        status: { $in: ['open', 'partially_filled', 'partially-filled'] }
      };

      if (symbol) {
        query.symbol = symbol;
      }

      const total = await Order.countDocuments(query);
      // Return current DB state — syncOrderStatus is handled asynchronously
      // by the orderSync Bull job, not inline on every GET request.
      const items = await Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
      return { items, total };
    } catch (error) {
      logger.error('Error fetching open orders:', error);
      throw error;
    }
  }

  async getOrderHistory(userId, symbol = null, from = null, to = null, limit = 50, skip = 0) {
    try {
      const query = {
        userId,
        // Include all completed order statuses (filled, partially filled, cancelled, expired, rejected)
        // 'closed' is not a valid status in the Order model, so it's removed
        status: { $in: ['filled', 'partially_filled', 'cancelled', 'expired', 'rejected'] }
      };

      if (symbol) {
        query.symbol = symbol;
      }

      if (from || to) {
        query.createdAt = {};
        if (from) query.createdAt.$gte = new Date(from);
        if (to) query.createdAt.$lte = new Date(to);
      }

      const total = await Order.countDocuments(query);
      const items = await Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit) || 50);

      return { items, total };
    } catch (error) {
      logger.error('Error fetching order history:', error);
      throw error;
    }
  }

  async cancelOrder(userId, orderId) {
    try {
      const order = await Order.findOne({ _id: orderId, userId });
      if (!order) {
        throw new Error('Order not found');
      }

      if (!['open', 'partially_filled', 'partially-filled'].includes(order.status)) {
        throw new Error('Order cannot be cancelled');
      }

      // ✅ FIX: look up in private first, then public
      const exchange =
        this.exchanges.private[order.exchange] ||
        this.exchanges.public[order.exchange];

      if (!exchange) {
        throw new Error(`Unsupported exchange: ${order.exchange}`);
      }

      // Only call exchange API if there is an actual exchange order ID
      if (order.exchangeOrderId) {
        await exchange.cancelOrder(order.exchangeOrderId, order.symbol);
      }

      // Update order status
      order.status = 'cancelled';
      await order.save();

      return order;
    } catch (error) {
      logger.error('Error cancelling order:', error);
      throw error;
    }
  }

  async getOrderBook(symbol, limit = 50) {
    try {
      const normalizedSymbol = await this.normalizeSymbolForExchange(symbol, 'binance');
      const cacheKey = `orderbook:${normalizedSymbol}:${limit}`;

      if (redisClient && typeof redisClient.get === 'function') {
        const cachedOrderBook = await redisClient.get(cacheKey);
        if (cachedOrderBook) {
          return JSON.parse(cachedOrderBook);
        }
      }

      const exchange = this.getExchange('binance', false);
      if (!exchange) {
        throw new Error('Public Binance exchange is not initialized');
      }

      const orderBook = await exchange.fetchOrderBook(normalizedSymbol, limit);
      const formattedOrderBook = {
        symbol: normalizedSymbol,
        timestamp: Date.now(),
        bids: Array.isArray(orderBook.bids)
          ? orderBook.bids.map(([price, amount]) => ({ price, amount }))
          : [],
        asks: Array.isArray(orderBook.asks)
          ? orderBook.asks.map(([price, amount]) => ({ price, amount }))
          : []
      };

      if (redisClient && typeof redisClient.setEx === 'function') {
        await redisClient.setEx(
          cacheKey,
          this.CACHE_DURATION.ORDERBOOK,
          JSON.stringify(formattedOrderBook)
        );
      }

      return formattedOrderBook;
    } catch (error) {
      logger.error('Error fetching order book:', error);
      throw error;
    }
  }

  async getRecentTrades(symbol, limit = 50) {
    try {
      const normalizedSymbol = await this.normalizeSymbolForExchange(symbol, 'binance');
      const cacheKey = `trades:${normalizedSymbol}:${limit}`;

      if (redisClient && typeof redisClient.get === 'function') {
        const cachedTrades = await redisClient.get(cacheKey);
        if (cachedTrades) {
          return JSON.parse(cachedTrades);
        }
      }

      const exchange = this.getExchange('binance', false);
      if (!exchange) {
        throw new Error('Public Binance exchange is not initialized');
      }

      const trades = await exchange.fetchTrades(normalizedSymbol, undefined, limit);
      const formattedTrades = Array.isArray(trades)
        ? trades.map(trade => ({
            id: trade.id,
            symbol: trade.symbol,
            price: trade.price,
            amount: trade.amount,
            side: trade.side,
            timestamp: trade.timestamp
          }))
        : [];

      if (redisClient && typeof redisClient.setEx === 'function') {
        await redisClient.setEx(
          cacheKey,
          this.CACHE_DURATION.TRADES,
          JSON.stringify(formattedTrades)
        );
      }

      return formattedTrades;
    } catch (error) {
      logger.error('Error fetching recent trades:', error);
      throw error;
    }
  }

  // -----------------------------
  // Private helper methods
  // -----------------------------

  async validateUserBalance(userId, orderData) {
    const portfolio = await Portfolio.findOne({ userId });
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const asset = Array.isArray(portfolio.assets)
      ? portfolio.assets.find(a => a.symbol === orderData.symbol)
      : null;

    if (orderData.side === 'sell') {
      if (!asset || asset.amount < orderData.amount) {
        throw new Error('Insufficient balance');
      }
    } else {
      // For buy orders, you can later implement quote currency check
      // Example: USDT / USD balance validation
    }
  }

  async placeExchangeOrder(order) {
    const exchange = this.getExchange(order.exchange, true);
    if (!exchange) {
      throw new Error(`Unsupported exchange or missing API credentials: ${order.exchange}`);
    }

    // Load markets to ensure symbol exists
    if (typeof exchange.loadMarkets === 'function') {
      await exchange.loadMarkets();
    }

    if (!exchange.markets || !exchange.markets[order.symbol]) {
      throw new Error(`Unsupported symbol ${order.symbol} on ${order.exchange}`);
    }

    const params = {};

    // Only attach optional params if they exist
    if (order.clientOrderId) params.clientOrderId = order.clientOrderId;
    if (order.timeInForce) params.timeInForce = order.timeInForce;
    if (order.postOnly !== undefined) params.postOnly = order.postOnly;
    if (order.reduceOnly !== undefined) params.reduceOnly = order.reduceOnly;
    if (order.stopPrice !== undefined && order.stopPrice !== null) {
      params.stopPrice = order.stopPrice;
    }

    // For market order, price should usually be undefined
    const price = order.type === 'market' ? undefined : order.price;

    return await exchange.createOrder(
      order.symbol,
      order.type,
      order.side,
      order.amount,
      price,
      params
    );
  }

  async syncOrderStatus(order) {
    try {
      const exchange =
        this.exchanges.private[order.exchange] ||
        this.exchanges.public[order.exchange];
      if (!exchange) {
        logger.warn(`Exchange not found for order ${order._id}: ${order.exchange}. Skipping sync.`);
        return order;
      }

      // Skip sync for paper trades — they have no real exchange order
      if (order.exchange === 'paper') {
        return order;
      }

      const exchangeOrder = await exchange.fetchOrder(
        order.exchangeOrderId,
        order.symbol
      );

      if (!exchangeOrder) {
        return order;
      }

      const newStatus = exchangeOrder.status || order.status;

      if (newStatus !== order.status) {
        order.status = newStatus;
      }

      if (exchangeOrder.filled !== undefined) {
        order.filledAmount = exchangeOrder.filled;
      }

      if (exchangeOrder.remaining !== undefined) {
        order.remainingAmount = exchangeOrder.remaining;
      }

      if (exchangeOrder.trades || exchangeOrder.fills) {
        order.fills = exchangeOrder.trades || exchangeOrder.fills;
      }

      if (order.fills && typeof order.calculateAverageFilledPrice === 'function') {
        order.averageFilledPrice = order.calculateAverageFilledPrice();
      } else if (exchangeOrder.average) {
        order.averageFilledPrice = exchangeOrder.average;
      }

      await order.save();

      // Update portfolio if order is filled
      if (['filled', 'partially_filled', 'partially-filled', 'closed'].includes(order.status)) {
        await this.updatePortfolio(order.userId, order);
      }

      return order;
    } catch (error) {
      logger.error(`Error syncing order status for order ${order._id}:`, error);
      return order;
    }
  }

  async updatePortfolio(userId, order) {
    try {
      const portfolio = await Portfolio.findOne({ userId });
      if (!portfolio) {
        throw new Error('Portfolio not found');
      }

      if (!Array.isArray(portfolio.assets)) {
        portfolio.assets = [];
      }

      const fillAmount = Number(order.filledAmount || 0);
      const avgPrice = Number(order.averageFilledPrice || order.price || 0);

      if (fillAmount <= 0) {
        return;
      }

      const fillValue = fillAmount * avgPrice;

      let asset = portfolio.assets.find(a => a.symbol === order.symbol);

      if (order.side === 'buy') {
        if (asset) {
          const oldAmount = Number(asset.amount || 0);
          const oldCostBasis = Number(asset.costBasis || 0);

          const newAmount = oldAmount + fillAmount;
          const totalOldValue = oldAmount * oldCostBasis;
          const totalNewValue = totalOldValue + fillValue;

          asset.amount = newAmount;
          asset.costBasis = newAmount > 0 ? totalNewValue / newAmount : avgPrice;
        } else {
          portfolio.assets.push({
            symbol: order.symbol,
            amount: fillAmount,
            costBasis: avgPrice
          });
        }
      } else if (order.side === 'sell') {
        if (!asset || Number(asset.amount || 0) < fillAmount) {
          throw new Error('Insufficient balance');
        }

        asset.amount = Number(asset.amount) - fillAmount;

        if (asset.amount <= 0) {
          portfolio.assets = portfolio.assets.filter(a => a.symbol !== order.symbol);
        }
      }

      await portfolio.save();

      // ── NEW: broadcast portfolio update via WebSocket ──────────────────────
      if (global.portfolioHandler) {
        try {
          const portfolioService = require('./portfolio.service');
          const summary = await portfolioService.getPortfolioSummary(userId);
          global.portfolioHandler.broadcastPortfolioUpdate(userId.toString(), summary);
        } catch (wsErr) {
          logger.warn('Portfolio WS broadcast failed (non-critical):', wsErr.message);
        }
      }
    } catch (error) {
      logger.error('Error updating portfolio:', error);
      throw error;
    }
  }
}

module.exports = new TradingService();