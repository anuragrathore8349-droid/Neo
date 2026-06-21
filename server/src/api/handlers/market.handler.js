'use strict';

const { Server } = require('socket.io');
const { logger } = require('../middlewares/logger.middleware');
const krakenService = require('../../services/kraken.service');

class MarketHandler {
  constructor(io) {
    this.io = io;
    this.subscriptions = new Map(); // socketId -> Set<symbol>
    this.priceIntervals = new Map(); // symbol -> intervalId
    this.symbolSubscriberCount = new Map(); // symbol -> count
    this.setupNamespace();
  }

  setupNamespace() {
    const ns = this.io.of('/market');

    ns.on('connection', (socket) => {
      logger.info(`[MarketSocket] Client connected: ${socket.id}`);
      this.subscriptions.set(socket.id, new Set());

      socket.on('subscribe', (symbols) => this.handleSubscribe(socket, symbols));
      socket.on('unsubscribe', (symbols) => this.handleUnsubscribe(socket, symbols));
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  handleSubscribe(socket, symbols) {
    if (!Array.isArray(symbols)) symbols = [symbols];

    symbols.forEach((symbol) => {
      const sym = symbol.toUpperCase();
      this.subscriptions.get(socket.id)?.add(sym);
      socket.join(`price:${sym}`);

      const prev = this.symbolSubscriberCount.get(sym) || 0;
      this.symbolSubscriberCount.set(sym, prev + 1);

      if (!this.priceIntervals.has(sym)) {
        this.startPriceBroadcast(sym);
      }
    });

    logger.info(`[MarketSocket] ${socket.id} subscribed to: ${symbols.join(', ')}`);
  }

  handleUnsubscribe(socket, symbols) {
    if (!Array.isArray(symbols)) symbols = [symbols];

    symbols.forEach((symbol) => {
      const sym = symbol.toUpperCase();
      this.subscriptions.get(socket.id)?.delete(sym);
      socket.leave(`price:${sym}`);

      const count = Math.max(0, (this.symbolSubscriberCount.get(sym) || 1) - 1);
      this.symbolSubscriberCount.set(sym, count);

      if (count === 0 && this.priceIntervals.has(sym)) {
        clearInterval(this.priceIntervals.get(sym));
        this.priceIntervals.delete(sym);
        logger.info(`[MarketSocket] Stopped broadcasting ${sym} (no subscribers)`);
      }
    });
  }

  handleDisconnect(socket) {
    const symbols = this.subscriptions.get(socket.id) || new Set();

    symbols.forEach((sym) => {
      const count = Math.max(0, (this.symbolSubscriberCount.get(sym) || 1) - 1);
      this.symbolSubscriberCount.set(sym, count);

      if (count === 0 && this.priceIntervals.has(sym)) {
        clearInterval(this.priceIntervals.get(sym));
        this.priceIntervals.delete(sym);
      }
    });

    this.subscriptions.delete(socket.id);
    logger.info(`[MarketSocket] Client disconnected: ${socket.id}`);
  }

  startPriceBroadcast(symbol) {
    // Broadcast every 5 seconds
    const intervalId = setInterval(async () => {
      try {
        const priceData = await krakenService.getLivePrice(symbol);
        if (!priceData || priceData.price === null) return;

        this.io.of('/market').to(`price:${symbol}`).emit('priceUpdate', {
          symbol,
          price: priceData.price,
          change24h: priceData.change24h ?? 0,
          volume24h: priceData.volume24h ?? 0,
          timestamp: Date.now(),
        });
      } catch (err) {
        logger.warn(`[MarketSocket] Price fetch failed for ${symbol}:`, err.message);
      }
    }, 5000);

    this.priceIntervals.set(symbol, intervalId);
    logger.info(`[MarketSocket] Started broadcasting ${symbol}`);
  }

  broadcastPriceUpdate(symbol, priceData) {
    this.io.of('/market').to(`price:${symbol}`).emit('priceUpdate', {
      symbol,
      price: priceData.price,
      change24h: priceData.change24h ?? 0,
      volume24h: priceData.volume24h ?? 0,
      timestamp: Date.now(),
    });
  }
}

module.exports = MarketHandler;
