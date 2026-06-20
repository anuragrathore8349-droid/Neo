const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  side: {
    type: String,
    enum: ['buy', 'sell'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  fee: {
    amount: Number,
    currency: String
  },
  exchange: {
    type: String,
    required: true
  },
  exchangeTradeId: String,
  timestamp: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes
tradeSchema.index({ userId: 1, timestamp: -1 });
tradeSchema.index({ symbol: 1, timestamp: -1 });

const Trade = mongoose.model('Trade', tradeSchema);

module.exports = Trade;