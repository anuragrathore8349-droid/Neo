const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: false,
    index: true
  },
type: {
  type: String,
  enum: ['deposit', 'withdrawal', 'transfer', 'buy', 'sell', 'swap', 'stake', 'unstake'],
  required: true,
  index: true
  },
  asset: {
    type: String,
    required: true,
    index: true
  },
  assetName: {
    type: String,
    default: ''   // populated at create time, fallback to symbol if empty
  },
  amount: {
    type: Number,
    required: true
  },
  fee: {
    type: Number,
    default: 0
  },
  sourceAddress: String,
  destinationAddress: String,
  network: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  txHash: String,
  confirmations: {
    type: Number,
    default: 0
  },
  memo: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ userId: 1, type: 1 });
transactionSchema.index({ userId: 1, timestamp: -1 });
transactionSchema.index({ walletId: 1, timestamp: -1 });
transactionSchema.index({ txHash: 1 }, { sparse: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;