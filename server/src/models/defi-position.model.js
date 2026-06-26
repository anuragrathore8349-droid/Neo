'use strict';
const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  symbol:    { type: String },
  amount:    { type: Number, default: 0 },
  address:   { type: String },
  claimedAt: { type: Date, default: Date.now }
}, { _id: false });

const defiPositionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Protocol identifier: 'lido', 'aave', 'uniswap', 'curve'
  protocol: { type: String, index: true },
  // Alias used by some parts of the codebase
  protocolId: { type: String },

  // ── Asset (nested object so service can read asset.symbol / asset.amount) ──
  asset: {
    symbol:       { type: String, default: '' },
    amount:       { type: Number, default: 0 },
    address:      { type: String, default: '' },
    currentValue: { type: Number, default: 0 }
  },

  // Position type — matches ALL values used across service + controller
  type: {
    type: String,
    enum: ['staking', 'yield_farm', 'farming', 'liquidity', 'lending'],
    required: true
  },

  walletAddress: { type: String },
  network:       { type: String, default: 'ethereum' },

  // APY as plain number (e.g. 3.82 means 3.82%)
  apy: { type: Number, default: 0 },

  // Rewards array — each claim is pushed here
  rewards: [rewardSchema],

  // Timestamps for reward calculations
  startedAt:      { type: Date },
  lastClaimedAt:  { type: Date },
  unstakedAt:     { type: Date },
  lastHarvestedAt:{ type: Date },
  endedAt:        { type: Date },

  transactionHash: { type: String },

  // Status — superset of all values used in service/controller
  status: {
    type: String,
    enum: ['pending', 'active', 'unstaking', 'withdrawing', 'partial_exit', 'completed', 'closed'],
    default: 'pending'
  },

  lockPeriod: { type: Number, default: 0 }, // seconds

  // Pool-specific data for liquidity positions
  poolData: {
    poolId:    { type: String },
    lpTokens:  { type: String },
    usdValue:  { type: String }
  },

  // Farm-specific data
  farmData: {
    farmId:   { type: String },
    amount:   { type: String },
    stakedAt: { type: Date }
  },

  // Flexible metadata for protocol-specific extras
  metadata: { type: mongoose.Schema.Types.Mixed }
}, {
  timestamps: true
});

defiPositionSchema.index({ userId: 1, protocol: 1 });
defiPositionSchema.index({ userId: 1, type: 1, status: 1 });
defiPositionSchema.index({ status: 1 });
defiPositionSchema.index({ walletAddress: 1 });
defiPositionSchema.index({ createdAt: -1 });
defiPositionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('DefiPosition', defiPositionSchema);