// server/src/models/subscription.model.js
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  planId: {
    type: String,
    required: true,
    enum: ['basic', 'pro', 'enterprise']
  },
  planName: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'annual'],
    default: 'monthly'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled', 'pending', 'failed', 'past_due'],
    default: 'pending'
  },
  // Stripe Integration Fields
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  stripePaymentMethodId: String,

  // Dates
  startDate: {
    type: Date,
    required: true
  },
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  nextBillingDate: Date,
  cancelledAt: Date,

  // ✅ FIX: Added missing cancel fields
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  cancelAt: Date,

  // Auto-renewal
  autoRenew: {
    type: Boolean,
    default: true
  },

  // Features included
  features: {
    maxTransactions: {
      type: mongoose.Schema.Types.Mixed, // number or 'Unlimited'
      default: 0
    },
    advancedAnalytics: {
      type: Boolean,
      default: false
    },
    realTimeData: {
      type: Boolean,
      default: false
    },
    aiInsights: {
      type: Boolean,
      default: false
    },
    defiIntegration: {
      type: Boolean,
      default: false
    },
    customIntegrations: {
      type: Boolean,
      default: false
    },
    dedicatedSupport: {
      type: Boolean,
      default: false
    },
    apiAccess: {
      type: Boolean,
      default: false
    }
  },

  // Billing history
  payments: [{
    id: String,
    stripePaymentIntentId: String,
    amount: Number,
    date: Date,
    status: {
      type: String,
      enum: ['succeeded', 'pending', 'failed'],
      default: 'pending'
    },
    invoiceUrl: String
  }],

  // Trial period
  trialEndsAt: Date,
  isTrialActive: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient queries
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ stripeSubscriptionId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ createdAt: -1 });
subscriptionSchema.index({ userId: 1, createdAt: -1 });

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;
