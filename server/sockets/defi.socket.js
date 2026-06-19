const defiService = require('../src/services/defi.service');
const priceService = require('../src/services/price.service');

class DefiSocket {
  constructor(io) {
    this.io = io;
    this.intervals = new Map();
    this.namespace = io.of('/defi');
    this.setup();
  }

  setup() {
    this.namespace.on('connection', (socket) => {
      socket.on('subscribe:gas', () => this.startGasFeed(socket));
      socket.on('subscribe:position', (positionId) => this.startPositionFeed(socket, positionId));
      socket.on('subscribe:prices', (symbols) => this.startPriceFeed(socket, symbols));
      socket.on('disconnect', () => this.clearIntervals(socket.id));
    });
  }

  startGasFeed(socket) {
    const interval = setInterval(async () => {
      const gas = await defiService.getGasPrices();
      socket.emit('gas:update', gas);
    }, 15000); // every 15 seconds
    this.storeInterval(socket.id, interval);
  }

  startPriceFeed(socket, symbols = ['ethereum','aave','curve-dao-token']) {
    const interval = setInterval(async () => {
      const prices = await priceService.getPrices(symbols);
      socket.emit('prices:update', prices);
    }, 30000); // every 30 seconds
    this.storeInterval(socket.id, interval);
  }

  startPositionFeed(socket, positionId) {
    const interval = setInterval(async () => {
      // Re-calculate rewards accrued since last check
      const reward = await defiService.calculateAccruedReward(positionId);
      socket.emit('position:update', { positionId, reward });
    }, 60000); // every 60 seconds
    this.storeInterval(socket.id, interval);
  }

  broadcastProtocolUpdate(protocolId, data) {
    this.namespace.emit('protocol:update', { protocolId, data, ts: Date.now() });
  }

  storeInterval(socketId, interval) {
    if (!this.intervals.has(socketId)) this.intervals.set(socketId, []);
    this.intervals.get(socketId).push(interval);
  }

  clearIntervals(socketId) {
    (this.intervals.get(socketId) || []).forEach(clearInterval);
    this.intervals.delete(socketId);
  }
}

module.exports = DefiSocket;
