const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    trim: true,
    default: ''
  },
  country: {
    type: String,
    trim: true,
    default: ''
  },
  dateOfBirth: {
    type: String,
    trim: true,
    default: ''
  },
  profession: {
    type: String,
    trim: true,
    default: ''
  },
  avatar: {
    type: String,
    trim: true,
    default: ''
  },
  bio: {
    type: String,
    trim: true,
    default: ''
  },
  plan: {
    type: String,
    enum: ['basic', 'pro', 'enterprise'],
    default: 'basic'
  },
  subscription: {
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    planId: String,
    status: {
      type: String,
      enum: ['active', 'inactive', 'cancelled', 'pending'],
      default: 'inactive'
    },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelledAt: Date,
    autoRenew: {
      type: Boolean,
      default: true
    }
  },
  preferences: {
    notifications: {
      marketAlerts: {
        type: Boolean,
        default: true
      },
      securityAlerts: {
        type: Boolean,
        default: true
      },
      newsDigest: {
        type: Boolean,
        default: false
      },
      tradingUpdates: {
        type: Boolean,
        default: true
      },
      portfolioSummary: {
        type: Boolean,
        default: true
      }
    },
    appearance: {
      theme: {
        type: String,
        default: 'dark'
      },
      accent: {
        type: String,
        default: 'primary'
      },
      fontSize: {
        type: String,
        default: 'medium'
      }
    }
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  twoFactorSecret: String,
  isTwoFactorEnabled: {
    type: Boolean,
    default: false
  },
  lastLogin: Date,
  activityLog: [{
    action: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now },
  }],
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  refreshTokens: [{
    token: String,
    expiresAt: Date
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Lock account after failed attempts
userSchema.methods.incrementLoginAttempts = async function() {
  const LOCK_TIME = 1 * 60 * 60 * 1000; // 1 hour
  const MAX_LOGIN_ATTEMPTS = 5;

  this.failedLoginAttempts += 1;

  if (this.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
    this.lockUntil = new Date(Date.now() + LOCK_TIME);
  }

  await this.save();
};

// Check if account is locked
userSchema.methods.isLocked = function() {
  return this.lockUntil && this.lockUntil > Date.now();
};

const User = mongoose.model('User', userSchema);

module.exports = User;
