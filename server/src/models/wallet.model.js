const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: ['exchange', 'defi', 'external'],
    required: true
  },
  provider: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  network: {
    type: String,
    required: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  balances: [{
    assetId: String,
    symbol: String,
    amount: Number,
    usdValue: Number,
    updatedAt: Date
  }],
  lastSyncedAt: Date
}, {
  timestamps: true
});

// Indexes
walletSchema.index({ userId: 1, address: 1 }, { unique: true });
walletSchema.index({ address: 1 });
walletSchema.index({ provider: 1 });

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;