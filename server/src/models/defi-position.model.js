const mongoose = require('mongoose');

const defiPositionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  protocolId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['staking', 'farming', 'lending', 'liquidity'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'completed', 'failed', 'unstaking', 'partial_exit'],
    default: 'active'
  },
  asset: {
    symbol: String,
    amount: Number,
    address: String
  },
  poolData: {
    poolId: String,
    lpTokens: Number,
    tokens: [{
      symbol: String,
      amount: Number,
      address: String
    }]
  },
  farmData: {
    farmId: String,
    amount: String,
    stakedAt: Date
  },
  rewards: [{
    symbol: String,
    amount: Number,
    address: String,
    claimedAt: Date
  }],
  apy: Number,
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: Date,
  lockPeriod: Number,
  transactionHash: String,
  walletAddress: String,
  network: String
}, {
  timestamps: true
});

// Indexes
defiPositionSchema.index({ userId: 1, protocolId: 1 });
defiPositionSchema.index({ status: 1 });
defiPositionSchema.index({ 'asset.symbol': 1 });
defiPositionSchema.index({ walletAddress: 1 });

const DefiPosition = mongoose.model('DefiPosition', defiPositionSchema);

module.exports = DefiPosition;