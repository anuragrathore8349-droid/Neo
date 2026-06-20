
'use strict';
const mongoose = require('mongoose');

const defiPositionSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    protocol:      { type: String },                          // 'aave', 'lido', 'uniswap', etc.
    asset:         { type: String },                          // token symbol
    type:          { type: String, enum: ['staking','yield_farm','liquidity','lending'], default: 'staking' },
    amount:        { type: Number, default: 0 },
    walletAddress: { type: String },
    externalId:    { type: String },                          // farm ID, pool ID, etc.
    status:        { type: String, enum: ['pending','active','unstaking','withdrawing','closed'], default: 'pending' },
    apy:           { type: Number, default: 0 },
    rewards:       { type: Number, default: 0 },
    stakedAt:      { type: Date },
    unstakedAt:    { type: Date },
    lastHarvestedAt: { type: Date },
    txHash:        { type: String },                          // on-chain tx hash
    metadata:      { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DefiPosition', defiPositionSchema);
