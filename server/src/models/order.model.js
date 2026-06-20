const mongoose = require('mongoose');

const fillSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  fee: {
    type: Number,
    required: true,
    min: 0
  }
});

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  type: {
    type: String,
    enum: ['market', 'limit', 'stop', 'stop_limit'],
    required: true
  },
  side: {
    type: String,
    enum: ['buy', 'sell'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  price: {
    type: Number,
    min: 0
  },
  total: {
    type: Number,
    min: 0
  },
  stopPrice: {
    type: Number,
    min: 0
  },
  status: {
    type: String,
    enum: ['open', 'filled', 'partially_filled', 'cancelled', 'expired', 'rejected'],
    default: 'open',
    index: true
  },
  filledAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  remainingAmount: {
    type: Number,
    min: 0
  },
  fills: [fillSchema],
  exchange: {
    type: String,
    required: true
  },
  timeInForce: {
    type: String,
    enum: ['GTC', 'IOC', 'FOK'],
    default: 'GTC'
  },
  expiresAt: Date,
  clientOrderId: {
    type: String,
    unique: true,
    sparse: true
  },
  postOnly: {
    type: Boolean,
    default: false
  },
  reduceOnly: {
    type: Boolean,
    default: false
  },
  stopLoss: {
    price: Number,
    triggerType: {
      type: String,
      enum: ['mark', 'last', 'index']
    }
  },
  takeProfit: {
    price: Number,
    triggerType: {
      type: String,
      enum: ['mark', 'last', 'index']
    }
  },
  totalFee: {
    type: Number,
    default: 0
  },
  averageFilledPrice: {
    type: Number
  }
}, {
  timestamps: true
});

// Indexes
orderSchema.index({ userId: 1, status: 1 });
orderSchema.index({ symbol: 1, status: 1 });
orderSchema.index({ createdAt: -1 });

// Calculate remaining amount before saving
orderSchema.pre('save', function(next) {
  this.remainingAmount = this.amount - this.filledAmount;
  next();
});

// Calculate average filled price
orderSchema.methods.calculateAverageFilledPrice = function() {
  if (this.fills.length === 0) return 0;
  
  const totalValue = this.fills.reduce((sum, fill) => sum + (fill.price * fill.amount), 0);
  const totalAmount = this.fills.reduce((sum, fill) => sum + fill.amount, 0);
  
  return totalValue / totalAmount;
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;