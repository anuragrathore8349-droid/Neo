/**
 * Pricing Plans Configuration
 * Used by both frontend and backend
 */

const PLANS = {
  BASIC: {
    id: 'basic',
    name: 'Basic',
    price: 0,
    period: 'Free forever',
    description: 'Perfect for getting started',
    features: {
      maxTransactions: 50,
      advancedAnalytics: false,
      realTimeData: false,
      aiInsights: false,
      defiIntegration: false,
      customIntegrations: false,
      dedicatedSupport: false,
      apiAccess: false
    },
    stripePriceId: null, // No stripe ID for free plan
    limits: {
      maxPortfolios: 1,
      maxWatchlists: 1,
      maxAlerts: 5,
      apiCallsPerDay: 100,
      dataRetentionDays: 30
    }
  },
  
  PRO: {
    id: 'pro',
    name: 'Pro',
    price: 29,
    period: 'per month',
    description: 'For serious traders',
    features: {
      maxTransactions: 'Unlimited',
      advancedAnalytics: true,
      realTimeData: true,
      aiInsights: true,
      taxLossHarvesting: true,
      defiIntegration: false,
      customIntegrations: false,
      dedicatedSupport: false,
      apiAccess: false
    },
    stripePriceId: process.env.STRIPE_PRICE_ID_PRO || 'price_1234567890',
    limits: {
      maxPortfolios: 5,
      maxWatchlists: 10,
      maxAlerts: 50,
      apiCallsPerDay: 1000,
      dataRetentionDays: 365
    }
  },
  
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99,
    period: 'per month',
    description: 'For professional investors',
    features: {
      maxTransactions: 'Unlimited',
      advancedAnalytics: true,
      realTimeData: true,
      aiInsights: true,
      taxLossHarvesting: true,
      weeklyAIReport: true,
      defiIntegration: true,
      customIntegrations: true,
      dedicatedSupport: true,
      apiAccess: true
    },
    stripePriceId: process.env.STRIPE_PRICE_ID_ENTERPRISE || 'price_0987654321',
    limits: {
      maxPortfolios: 'Unlimited',
      maxWatchlists: 'Unlimited',
      maxAlerts: 'Unlimited',
      apiCallsPerDay: 'Unlimited',
      dataRetentionDays: 'Unlimited'
    }
  }
};

const FEATURE_ACCESS = {
  advancedAnalytics: ['pro', 'enterprise'],
  realTimeData: ['pro', 'enterprise'],
  aiInsights: ['pro', 'enterprise'],
  taxLossHarvesting: ['pro', 'enterprise'],
  weeklyAIReport: ['enterprise'],
  defiIntegration: ['enterprise'],
  customIntegrations: ['enterprise'],
  dedicatedSupport: ['enterprise'],
  apiAccess: ['enterprise'],
  unlimitedTransactions: ['pro', 'enterprise']
};

/**
 * Get plan by ID
 */
const getPlanById = (planId) => {
  const plan = Object.values(PLANS).find(p => p.id === planId);
  if (!plan) {
    throw new Error(`Plan not found: ${planId}`);
  }
  return plan;
};

/**
 * Get all plans
 */
const getAllPlans = () => {
  return Object.values(PLANS);
};

/**
 * Check if user has access to feature
 */
const canAccessFeature = (userPlanId, featureName) => {
  const allowedPlans = FEATURE_ACCESS[featureName] || [];
  return allowedPlans.includes(userPlanId);
};

/**
 * Get user limits based on plan
 */
const getPlanLimits = (planId) => {
  const plan = getPlanById(planId);
  return plan.limits;
};

/**
 * Get remaining limit for user
 */
const getRemainingLimit = (planId, limitType, currentValue) => {
  const plan = getPlanById(planId);
  const limit = plan.limits[limitType];
  
  if (limit === 'Unlimited') {
    return 'Unlimited';
  }
  
  return limit - currentValue;
};

module.exports = {
  PLANS,
  FEATURE_ACCESS,
  getPlanById,
  getAllPlans,
  canAccessFeature,
  getPlanLimits,
  getRemainingLimit
};
