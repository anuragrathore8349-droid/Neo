const { canAccessFeature, getPlanLimits } = require('../../config/plans.config');

/**
 * Middleware to check if user can access a feature
 */
const featureAccess = (requiredFeature) => {
  return (req, res, next) => {
    try {
      const userPlan = req.user?.plan || 'basic';

      if (!canAccessFeature(userPlan, requiredFeature)) {
        return res.status(403).json({
          success: false,
          message: `Feature '${requiredFeature}' requires a higher plan`,
          requiredPlan: getRequiredPlan(requiredFeature),
          currentPlan: userPlan
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error checking feature access'
      });
    }
  };
};

/**
 * Middleware to check transaction limits
 */
const checkTransactionLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userPlan = req.user.plan || 'basic';
    const limits = getPlanLimits(userPlan);

    // Get transaction count for current period
    const Transaction = require('../../models/transaction.model');
    const startOfMonth = new Date();
    startOfMonth.setDate(1);

    const transactionCount = await Transaction.countDocuments({
      userId,
      createdAt: { $gte: startOfMonth }
    });

    if (
      limits.maxTransactions !== 'Unlimited' &&
      transactionCount >= limits.maxTransactions
    ) {
      return res.status(403).json({
        success: false,
        message: `Transaction limit reached for your plan`,
        limit: limits.maxTransactions,
        current: transactionCount,
        requiresUpgrade: true
      });
    }

    // Attach limits to request for later use
    req.planLimits = limits;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking transaction limits'
    });
  }
};

/**
 * Middleware to check API call limits
 */
const checkApiLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userPlan = req.user.plan || 'basic';
    const limits = getPlanLimits(userPlan);

    // For now, just attach to request
    // In production, use Redis to track API calls
    req.apiLimit = limits.apiCallsPerDay;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking API limits'
    });
  }
};

/**
 * Get required plan for a feature
 */
const getRequiredPlan = (feature) => {
  const featureMap = {
    advancedAnalytics: 'pro',
    realTimeData: 'pro',
    aiInsights: 'pro',
    defiIntegration: 'enterprise',
    customIntegrations: 'enterprise',
    dedicatedSupport: 'enterprise',
    apiAccess: 'enterprise'
  };

  return featureMap[feature] || 'pro';
};

/**
 * Middleware to check if plan is active
 */
const checkSubscriptionStatus = async (req, res, next) => {
  try {
    const user = req.user;

    // Check if subscription is active (not cancelled)
    if (user.plan !== 'basic' && user.subscription?.status === 'cancelled') {
      return res.status(403).json({
        success: false,
        message: 'Your subscription has been cancelled. Please renew to continue.',
        requiresRenewal: true
      });
    }

    // Check if trial has expired
    if (user.subscription?.isTrialActive && user.subscription?.trialEndsAt) {
      if (new Date() > new Date(user.subscription.trialEndsAt)) {
        return res.status(403).json({
          success: false,
          message: 'Your trial period has expired. Please upgrade your plan.',
          requiresUpgrade: true
        });
      }
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking subscription status'
    });
  }
};

/**
 * Middleware to require paid plan
 */
const requirePaidPlan = (req, res, next) => {
  try {
    const userPlan = req.user?.plan || 'basic';

    if (userPlan === 'basic') {
      return res.status(403).json({
        success: false,
        message: 'This feature requires a paid plan upgrade',
        currentPlan: 'basic',
        requiresUpgrade: true
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking plan requirement'
    });
  }
};

module.exports = {
  featureAccess,
  checkTransactionLimit,
  checkApiLimit,
  checkSubscriptionStatus,
  requirePaidPlan,
  getRequiredPlan
};
