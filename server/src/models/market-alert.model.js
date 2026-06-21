const mongoose = require('mongoose');

const marketAlertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },
  condition: {
    type: String,
    enum: ['above', 'below'],
    required: true
  },
  targetPrice: {
    type: Number,
    required: true
  },
  notificationTypes: [{
    type: String,
    enum: ['email', 'push', 'sms']
  }],
  active: {
    type: Boolean,
    default: true
  },
  triggered: {
    type: Boolean,
    default: false
  },
  triggeredAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient querying
marketAlertSchema.index({ userId: 1, symbol: 1, triggered: 1 });
marketAlertSchema.index({ active: 1, triggered: 1 });

const MarketAlert = mongoose.model('MarketAlert', marketAlertSchema);

module.exports = MarketAlert;