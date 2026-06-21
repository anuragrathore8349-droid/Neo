const { Server } = require('socket.io');
const WebSocket = require('ws');
const { logger } = require('../../api/middlewares/logger.middleware');

class TradingHandler {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.binanceStreams = new Map(); // Store active Binance WebSocket connections
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

      socket.on('subscribe_orderbook', (symbol) => {
        this.handleSubscribeOrderBook(socket, symbol);
      });

      socket.on('unsubscribe_orderbook', (symbol) => {
        this.handleUnsubscribeOrderBook(socket, symbol);
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
    // Close any Binance WebSocket streams for this socket
    if (this.binanceStreams.has(socket.id)) {
      const streams = this.binanceStreams.get(socket.id);
      streams.forEach(ws => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
      this.binanceStreams.delete(socket.id);
    }
    logger.info(`Client disconnected from trading websocket: ${socket.id}`);
  }

  handleSubscribeOrderBook(socket, symbol) {
    try {
      const pair = `${symbol.toLowerCase()}usdt@depth20@100ms`;
      const binanceUrl = `wss://stream.binance.com:9443/ws/${pair}`;
      
      const ws = new WebSocket(binanceUrl);
      
      ws.on('open', () => {
        logger.info(`Binance WebSocket opened for ${symbol}: ${pair}`);
      });

      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          const orderBook = {
            symbol,
            asks: (parsed.asks || []).map(([p, q]) => ({ 
              price: parseFloat(p), 
              quantity: parseFloat(q) 
            })),
            bids: (parsed.bids || []).map(([p, q]) => ({ 
              price: parseFloat(p), 
              quantity: parseFloat(q) 
            })),
            timestamp: new Date().toISOString()
          };
          socket.emit('orderbook', orderBook);
        } catch (err) {
          logger.warn(`Failed to parse Binance message for ${symbol}:`, err.message);
        }
      });

      ws.on('error', (err) => {
        logger.error(`Binance WebSocket error for ${symbol}:`, err.message);
      });

      ws.on('close', () => {
        logger.info(`Binance WebSocket closed for ${symbol}`);
      });

      // Store WebSocket reference
      if (!this.binanceStreams.has(socket.id)) {
        this.binanceStreams.set(socket.id, new Set());
      }
      this.binanceStreams.get(socket.id).add(ws);

      logger.info(`Client ${socket.id} subscribed to Binance orderbook for ${symbol}`);
    } catch (err) {
      logger.error(`Error subscribing to Binance orderbook:`, err.message);
      socket.emit('error', { message: 'Failed to subscribe to orderbook' });
    }
  }

  handleUnsubscribeOrderBook(socket, symbol) {
    try {
      if (this.binanceStreams.has(socket.id)) {
        const streams = this.binanceStreams.get(socket.id);
        const pair = `${symbol.toLowerCase()}usdt@depth20@100ms`;
        
        // Close all WebSocket connections for this pair (simple approach)
        streams.forEach(ws => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        });
        
        this.binanceStreams.set(socket.id, new Set());
      }
      logger.info(`Client ${socket.id} unsubscribed from Binance orderbook for ${symbol}`);
    } catch (err) {
      logger.error(`Error unsubscribing from Binance orderbook:`, err.message);
    }
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