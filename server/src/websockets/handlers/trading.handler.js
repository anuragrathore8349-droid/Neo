const { Server } = require('socket.io');
const { logger } = require('../../api/middlewares/logger.middleware');

class TradingHandler {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.of('/trading').on('connection', (socket) => {
      logger.info(`Client connected to trading websocket: ${socket.id}`);

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
      const orderBookRoom = `orderbook:${symbol}`;
      const tradesRoom = `trades:${symbol}`;
      
      socket.join([orderBookRoom, tradesRoom]);
      
      if (!this.rooms.has(socket.id)) {
        this.rooms.set(socket.id, new Set());
      }
      this.rooms.get(socket.id).add(orderBookRoom);
      this.rooms.get(socket.id).add(tradesRoom);

      logger.info(`Client ${socket.id} subscribed to ${symbol} trading updates`);
    });
  }

  handleUnsubscribe(socket, symbols) {
    if (!Array.isArray(symbols)) {
      symbols = [symbols];
    }

    symbols.forEach(symbol => {
      const orderBookRoom = `orderbook:${symbol}`;
      const tradesRoom = `trades:${symbol}`;
      
      socket.leave([orderBookRoom, tradesRoom]);
      
      if (this.rooms.has(socket.id)) {
        this.rooms.get(socket.id).delete(orderBookRoom);
        this.rooms.get(socket.id).delete(tradesRoom);
      }

      logger.info(`Client ${socket.id} unsubscribed from ${symbol} trading updates`);
    });
  }

  handleDisconnect(socket) {
    if (this.rooms.has(socket.id)) {
      this.rooms.delete(socket.id);
    }
    logger.info(`Client disconnected from trading websocket: ${socket.id}`);
  }

  // Broadcast order book updates
  broadcastOrderBook(symbol, orderBook) {
    const room = `orderbook:${symbol}`;
    this.io.of('/trading').to(room).emit('orderbook', {
      symbol,
      data: orderBook
    });
  }

  // Broadcast trade updates
  broadcastTrade(symbol, trade) {
    const room = `trades:${symbol}`;
    this.io.of('/trading').to(room).emit('trade', {
      symbol,
      data: trade
    });
  }

  // Broadcast order status updates
  broadcastOrderUpdate(userId, order) {
    this.io.of('/trading').to(`user:${userId}`).emit('orderUpdate', {
      orderId: order.id,
      status: order.status,
      filledAmount: order.filledAmount,
      remainingAmount: order.remainingAmount,
      averagePrice: order.averagePrice
    });
  }

  // Broadcast execution report
  broadcastExecutionReport(userId, execution) {
    this.io.of('/trading').to(`user:${userId}`).emit('execution', {
      orderId: execution.orderId,
      tradeId: execution.tradeId,
      price: execution.price,
      amount: execution.amount,
      side: execution.side,
      timestamp: execution.timestamp
    });
  }
}

module.exports = TradingHandler;