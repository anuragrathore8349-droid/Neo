const mongoose = require('mongoose');

const defiPositionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  protocol: {
    type: String,
    required: true,
    index: true,
    example: 'aave' // aave, lido, uniswap, curve, etc.
  },
  asset: {
    type: String,
    required: true,
    example: 'ETH' // BTC, ETH, USDC, etc.
  },
  type: {
    type: String,
    enum: ['staking', 'yield_farm', 'liquidity', 'lending'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  walletAddress: {
    type: String,
    required: true
  },
  externalId: {
    type: String,
    description: 'Farm ID, pool ID, or external protocol identifier'
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'unstaking', 'withdrawing', 'closed'],
    default: 'pending'
  },
  apy: {
    type: Number,
    default: 0
  },
  rewards: {
    type: Number,
    default: 0
  },
  stakedAt: Date,
  unstakedAt: Date,
  lastHarvestedAt: Date,
  txHash: String,
  metadata: mongoose.Schema.Types.Mixed // Flexible object for protocol-specific data
}, {
  timestamps: true
});

// Indexes
defiPositionSchema.index({ userId: 1, protocol: 1 });
defiPositionSchema.index({ status: 1 });
defiPositionSchema.index({ asset: 1 });
defiPositionSchema.index({ walletAddress: 1 });

const DefiPosition = mongoose.model('DefiPosition', defiPositionSchema);

module.exports = DefiPosition;