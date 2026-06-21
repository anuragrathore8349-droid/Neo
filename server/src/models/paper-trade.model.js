const mongoose = require('mongoose');

const paperTradeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    tradeId: {
      type: String,
      unique: true,
      required: true
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true
    },
    side: {
      type: String,
      enum: ['buy', 'sell'],
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    totalValue: {
      type: Number,
      required: true,
      min: 0
    },
    type: {
      type: String,
      enum: ['market', 'limit'],
      default: 'market'
    },
    status: {
      type: String,
      enum: ['pending', 'filled', 'cancelled'],
      default: 'filled'
    },
    profitLoss: {
      type: Number,
      default: 0
    },
    profitLossPercentage: {
      type: Number,
      default: 0
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: false
  }
);

// Index for quick lookups
paperTradeSchema.index({ userId: 1, timestamp: -1 });
paperTradeSchema.index({ userId: 1, symbol: 1 });

const PaperTrade = mongoose.model('PaperTrade', paperTradeSchema);

module.exports = PaperTrade;
