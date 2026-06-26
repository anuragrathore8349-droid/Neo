const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  assetId: {
    type: String,
    required: true
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },name: {
  type: String,
  trim: true,
  default: ''
},
type: {
  // already exists — also add 'forex' if missing
  type: String,
  required: true,
  enum: ['crypto', 'stock', 'fiat', 'commodity', 'forex']
},
change24h: {
  type: Number,
  default: 0
},
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  costBasis: {
    type: Number,
    required: true,
    min: 0
  },
  currentPrice: {
    type: Number,
    required: true,
    min: 0
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  profit: {
    type: Number,
    default: 0
  },
  profitPercentage: {
    type: Number,
    default: 0
  },
  allocation: {
    type: Number,
    default: 0
  },
  acquiredAt: {
    type: Date,
    default: Date.now
  }
});

const portfolioSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  assets: [assetSchema],
  totalValue: {
    type: Number,
    default: 0
  },
  totalCost: {
    type: Number,
    default: 0
  },
  totalProfit: {
    type: Number,
    default: 0
  },
  totalProfitPercentage: {
    type: Number,
    default: 0
  },
  dailyChange: {
    type: Number,
    default: 0
  },
  dailyChangePercentage: {
    type: Number,
    default: 0
  },
  metrics: {
    sharpeRatio: Number,
    volatility: Number,
    beta: Number,
    alpha: Number,
    rSquared: Number
  },
  rebalanceTarget: [{
    symbol: String,
    allocation: Number
  }],
  lastRebalanced: Date,
  lastUpdated: Date
}, {
  timestamps: true
});

// Indexes
portfolioSchema.index({ userId: 1 });
portfolioSchema.index({ userId: 1, name: 1 }, { unique: true });
portfolioSchema.index({ 'assets.symbol': 1 });
portfolioSchema.index({ updatedAt: -1 });
portfolioSchema.index({ createdAt: -1 });
portfolioSchema.index({ userId: 1, createdAt: -1 });

const Portfolio = mongoose.model('Portfolio', portfolioSchema);

module.exports = Portfolio;