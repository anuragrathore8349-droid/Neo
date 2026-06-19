const mongoose = require('mongoose');

const portfolioHistorySchema = new mongoose.Schema({
  portfolioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Portfolio',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  totalValue: {
    type: Number,
    required: true
  },
  assets: [{
    symbol: String,
    amount: Number,
    value: Number,
    price: Number
  }],
  metrics: {
    dailyReturn: Number,
    weeklyReturn: Number,
    monthlyReturn: Number,
    yearlyReturn: Number
  }
}, {
  timestamps: true
});

// Compound index for efficient querying
portfolioHistorySchema.index({ portfolioId: 1, timestamp: -1 });

const PortfolioHistory = mongoose.model('PortfolioHistory', portfolioHistorySchema);

module.exports = PortfolioHistory;