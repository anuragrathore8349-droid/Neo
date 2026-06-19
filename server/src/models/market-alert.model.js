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
  type: {
    type: String,
    enum: ['above', 'below'],
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  notificationTypes: [{
    type: String,
    enum: ['email', 'push', 'sms']
  }],
  isTriggered: {
    type: Boolean,
    default: false
  },
  triggeredAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient querying
marketAlertSchema.index({ userId: 1, symbol: 1, isTriggered: 1 });

const MarketAlert = mongoose.model('MarketAlert', marketAlertSchema);

module.exports = MarketAlert;