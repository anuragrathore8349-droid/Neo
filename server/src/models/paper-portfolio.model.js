const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema(
  {
    symbol: {
      type: String,
      required: true,
      uppercase: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    avgPrice: {
      type: Number,
      required: true,
      min: 0
    },
    lastPrice: {
      type: Number,
      required: true,
      min: 0
    },
    purchasedAt: {
      type: Date,
      default: Date.now
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const paperPortfolioSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    balance: {
      type: Number,
      required: true,
      default: 10000,
      min: 0
    },
    investedAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    holdings: [holdingSchema],
    trades: [
      {
        tradeId: String,
        symbol: String,
        side: { type: String, enum: ['buy', 'sell'] },
        quantity: Number,
        price: Number,
        totalValue: Number,
        type: { type: String, enum: ['market', 'limit'] },
        status: { type: String, enum: ['pending', 'filled', 'cancelled'] },
        profitLoss: Number,
        profitLossPercentage: Number,
        timestamp: Date
      }
    ],
    profitLoss: {
      type: Number,
      default: 0
    },
    profitLossPercentage: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Index for efficient queries
paperPortfolioSchema.index({ userId: 1 });
paperPortfolioSchema.index({ createdAt: -1 });

const PaperPortfolio = mongoose.model('PaperPortfolio', paperPortfolioSchema);

module.exports = PaperPortfolio;
