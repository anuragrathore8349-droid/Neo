const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'order',           // Trade/order filled
        'alert',           // Price alert triggered
        'security',        // Login, device added
        'subscription',    // Plan upgraded, payment processed
        'system',          // System maintenance, updates
        'defi',            // DeFi position liquidation warning
        'performance',     // Portfolio milestone
        'ai_insight',      // AI recommendation
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    icon: {
      type: String,
      default: 'Bell', // lucide-react icon name
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'error', 'success'],
      default: 'info',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    actionUrl: {
      type: String,
      default: null, // e.g., "/trading", "/portfolio", etc.
    },
    actionLabel: {
      type: String,
      default: null, // e.g., "View Order", "View Alert"
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}, // Store additional context: { orderId: '...', symbol: 'BTC', price: 50000 }
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      index: { expireAfterSeconds: 0 }, // TTL index — auto-delete after expiration
    },
  },
  {
    timestamps: true,
    collection: 'notifications',
  }
);

// Indexes for performance
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1 });

// Get unread count
notificationSchema.statics.getUnreadCount = async function (userId) {
  return this.countDocuments({ userId, isRead: false });
};

// Mark as read
notificationSchema.methods.markAsRead = function () {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);
