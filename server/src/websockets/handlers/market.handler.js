const { Server } = require('socket.io');
const { logger } = require('../../api/middlewares/logger.middleware');

class MarketHandler {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.of('/market').on('connection', (socket) => {
      logger.info(`Client connected to market websocket: ${socket.id}`);

      socket.on('subscribe', (symbols) => {
        this.handleSubscribe(socket, symbols);
      });

      socket.on('unsubscribe', (symbols) => {
        this.handleUnsubscribe(socket, symbols);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  handleSubscribe(socket, symbols) {
    if (!Array.isArray(symbols)) {
      symbols = [symbols];
    }

    symbols.forEach(symbol => {
      const room = `price:${symbol}`;
      socket.join(room);
      
      if (!this.rooms.has(socket.id)) {
        this.rooms.set(socket.id, new Set());
      }
      this.rooms.get(socket.id).add(room);

      logger.info(`Client ${socket.id} subscribed to ${symbol} price updates`);
    });
  }

  handleUnsubscribe(socket, symbols) {
    if (!Array.isArray(symbols)) {
      symbols = [symbols];
    }

    symbols.forEach(symbol => {
      const room = `price:${symbol}`;
      socket.leave(room);
      
      if (this.rooms.has(socket.id)) {
        this.rooms.get(socket.id).delete(room);
      }

      logger.info(`Client ${socket.id} unsubscribed from ${symbol} price updates`);
    });
  }

  handleDisconnect(socket) {
    if (this.rooms.has(socket.id)) {
      this.rooms.delete(socket.id);
    }
    logger.info(`Client disconnected from market websocket: ${socket.id}`);
  }

  // Broadcast price updates
  broadcastPriceUpdate(symbol, priceData) {
    // Accept either a number (legacy) or a full PriceUpdate object
    const payload = typeof priceData === 'number'
      ? { symbol, price: priceData, change24h: 0, volume24h: 0, timestamp: Date.now() }
      : {
          symbol,
          price:     priceData.price     ?? 0,
          change24h: priceData.change24h ?? 0,
          volume24h: priceData.volume24h ?? 0,
          timestamp: Date.now()
        };
    const room = `price:${symbol}`;
    this.io.of('/market').to(room).emit('priceUpdate', payload);
  }

  // Broadcast market news
  broadcastMarketNews(news) {
    this.io.of('/market').emit('marketNews', {
      ...news,
      timestamp: Date.now()
    });
  }

  // Broadcast market status
  broadcastMarketStatus(symbol, status) {
    const room = `price:${symbol}`;
    this.io.of('/market').to(room).emit('marketStatus', {
      symbol,
      status,
      timestamp: Date.now()
    });
  }

  // Broadcast technical indicators
  broadcastTechnicalIndicators(symbol, indicators) {
    const room = `price:${symbol}`;
    this.io.of('/market').to(room).emit('technicalIndicators', {
      symbol,
      indicators,
      timestamp: Date.now()
    });
  }
}

module.exports = MarketHandler;