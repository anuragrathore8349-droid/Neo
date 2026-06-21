// server/src/websockets/handlers/trading.handler.js
'use strict';
const WebSocket = require('ws');
const { logger } = require('../../api/middlewares/logger.middleware');

class TradingHandler {
  constructor(io) {
    this.io             = io;
    this.socketRooms    = new Map();   // socketId -> Set<room>
    this.symbolStreams   = new Map();   // symbol   -> { ws, subscribers: Set<socketId> }
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.of('/trading').on('connection', (socket) => {
      logger.info(`[Trading WS] connected: ${socket.id}, user: ${socket.user?.userId}`);

      // Join personal room for order updates
      if (socket.user?.userId) {
        socket.join(`user:${socket.user.userId}`);
      }

      // ── Subscribe to orderbook (camelCase — matches client) ───────────────
      socket.on('subscribeOrderbook', ({ symbol } = {}) => {
        if (!symbol) return;
        this._joinOrderbookStream(socket, symbol.toUpperCase());
      });

      socket.on('unsubscribeOrderbook', ({ symbol } = {}) => {
        if (!symbol) return;
        this._leaveOrderbookStream(socket, symbol.toUpperCase());
      });

      // ── Legacy snake_case aliases ─────────────────────────────────────────
      socket.on('subscribe_orderbook',   ({ symbol } = {}) => symbol && this._joinOrderbookStream(socket, symbol.toUpperCase()));
      socket.on('unsubscribe_orderbook', ({ symbol } = {}) => symbol && this._leaveOrderbookStream(socket, symbol.toUpperCase()));

      // ── Trade stream ──────────────────────────────────────────────────────
      socket.on('subscribeTrades', ({ symbol } = {}) => {
        if (!symbol) return;
        const room = `trades:${symbol.toUpperCase()}`;
        socket.join(room);
        this._trackRoom(socket.id, room);
      });

      socket.on('unsubscribeTrades', ({ symbol } = {}) => {
        if (!symbol) return;
        const room = `trades:${symbol.toUpperCase()}`;
        socket.leave(room);
        this._untrackRoom(socket.id, room);
      });

      socket.on('disconnect', () => {
        this._handleDisconnect(socket);
      });
    });
  }

  // ── Shared per-symbol Binance orderbook stream ────────────────────────────
  _joinOrderbookStream(socket, symbol) {
    const room = `orderbook:${symbol}`;
    socket.join(room);
    this._trackRoom(socket.id, room);

    if (!this.symbolStreams.has(symbol)) {
      this._openBinanceStream(symbol);
    } else {
      this.symbolStreams.get(symbol).subscribers.add(socket.id);
    }
    logger.info(`[Trading WS] ${socket.id} subscribed orderbook:${symbol}`);
  }

  _leaveOrderbookStream(socket, symbol) {
    const room = `orderbook:${symbol}`;
    socket.leave(room);
    this._untrackRoom(socket.id, room);

    const stream = this.symbolStreams.get(symbol);
    if (stream) {
      stream.subscribers.delete(socket.id);
      if (stream.subscribers.size === 0) {
        this._closeBinanceStream(symbol);
      }
    }
  }

  _openBinanceStream(symbol) {
    const pair = `${symbol.toLowerCase()}usdt@depth20@100ms`;
    const url  = `wss://stream.binance.com:9443/ws/${pair}`;

    let reconnectTimer = null;
    const connect = () => {
      const ws = new WebSocket(url);

      ws.on('open', () => {
        logger.info(`[Binance WS] opened: ${pair}`);
      });

      ws.on('message', (raw) => {
        try {
          const parsed = JSON.parse(raw.toString());
          const orderBook = {
            symbol,
            bids: (parsed.bids || []).map(([p, q]) => ({ price: parseFloat(p), amount: parseFloat(q) })),
            asks: (parsed.asks || []).map(([p, q]) => ({ price: parseFloat(p), amount: parseFloat(q) })),
            timestamp: Date.now(),
          };
          this.io.of('/trading').to(`orderbook:${symbol}`).emit('orderbook', orderBook);
        } catch { /* skip malformed */ }
      });

      ws.on('error', (err) => logger.warn(`[Binance WS] error ${symbol}: ${err.message}`));

      ws.on('close', () => {
        logger.warn(`[Binance WS] closed: ${pair}. Reconnecting in 3s…`);
        if (this.symbolStreams.has(symbol)) {
          reconnectTimer = setTimeout(connect, 3000);
          this.symbolStreams.get(symbol).ws = null;
        }
      });

      const entry = this.symbolStreams.get(symbol);
      if (entry) {
        entry.ws = ws;
      } else {
        this.symbolStreams.set(symbol, { ws, subscribers: new Set(), reconnectTimer });
      }
    };

    this.symbolStreams.set(symbol, { ws: null, subscribers: new Set(), reconnectTimer: null });
    connect();
  }

  _closeBinanceStream(symbol) {
    const stream = this.symbolStreams.get(symbol);
    if (!stream) return;
    clearTimeout(stream.reconnectTimer);
    if (stream.ws && stream.ws.readyState === WebSocket.OPEN) stream.ws.close();
    this.symbolStreams.delete(symbol);
    logger.info(`[Binance WS] closed stream for ${symbol} (no subscribers)`);
  }

  // ── Room tracking helpers ─────────────────────────────────────────────────
  _trackRoom(socketId, room) {
    if (!this.socketRooms.has(socketId)) this.socketRooms.set(socketId, new Set());
    this.socketRooms.get(socketId).add(room);
  }

  _untrackRoom(socketId, room) {
    this.socketRooms.get(socketId)?.delete(room);
  }

  _handleDisconnect(socket) {
    this.socketRooms.delete(socket.id);
    // Remove from all symbol stream subscriber sets
    for (const [symbol, stream] of this.symbolStreams.entries()) {
      stream.subscribers.delete(socket.id);
      if (stream.subscribers.size === 0) this._closeBinanceStream(symbol);
    }
    logger.info(`[Trading WS] disconnected: ${socket.id}`);
  }

  // ── Public broadcast methods (used by trading.service.js) ─────────────────
  broadcastOrderBook(symbol, orderBook) {
    this.io.of('/trading').to(`orderbook:${symbol}`).emit('orderbook', orderBook);
  }

  broadcastTrade(symbol, trade) {
    this.io.of('/trading').to(`trades:${symbol}`).emit('trade', { symbol, data: trade });
  }

  broadcastOrderUpdate(userId, order) {
    this.io.of('/trading').to(`user:${userId}`).emit('orderUpdate', {
      orderId:         order._id || order.id,
      status:          order.status,
      filledAmount:    order.filledAmount,
      remainingAmount: order.remainingAmount,
      averagePrice:    order.averageFilledPrice,
    });
  }

  broadcastOrderFill(userId, fill) {
    this.io.of('/trading').to(`user:${userId}`).emit('orderFill', fill);
  }
}

module.exports = TradingHandler;
