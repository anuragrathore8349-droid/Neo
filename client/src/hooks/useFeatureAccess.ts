import { useMemo } from 'react';
import { usePlan } from '../context/PlanContext';

/**
 * Hook to check feature access based on user's plan
 */
export const useFeatureAccess = () => {
  const { userSubscription, canAccessFeature: contextCanAccessFeature } = usePlan();

  const featureAccess = useMemo(() => ({
    // Analytics features
    advancedAnalytics: contextCanAccessFeature('advancedAnalytics'),
    realTimeData: contextCanAccessFeature('realTimeData'),
    aiInsights: contextCanAccessFeature('aiInsights'),
    priceAlerts: contextCanAccessFeature('realTimeData'),
    
    // Trading features
    unlimitedTransactions: contextCanAccessFeature('unlimitedTransactions'),
    advancedOrders: contextCanAccessFeature('realTimeData'),
    
    // DeFi features
    defiIntegration: contextCanAccessFeature('defiIntegration'),
    
    // Integration features
    customIntegrations: contextCanAccessFeature('customIntegrations'),
    apiAccess: contextCanAccessFeature('apiAccess'),
    
    // Support features
    dedicatedSupport: contextCanAccessFeature('dedicatedSupport'),
    
    // Check if user can upgrade
    isPaidPlan: userSubscription?.planId !== 'basic',
    isBasicPlan: userSubscription?.planId === 'basic',
    isProPlan: userSubscription?.planId === 'pro',
    isEnterprisePlan: userSubscription?.planId === 'enterprise',
    
    // Get current plan
    currentPlan: userSubscription?.planId
  }), [userSubscription, contextCanAccessFeature]);

  return featureAccess;
};

/**
 * Hook to get feature limits based on user's plan
 */
export const useFeatureLimits = () => {
  const { getPlanLimits, userSubscription } = usePlan();

  const limits = useMemo(() => {
    if (!userSubscription?.planId) {
      return null;
    }

    return {
      maxTransactions: getPlanLimits('maxTransactions'),
      maxPortfolios: getPlanLimits('maxPortfolios'),
      maxWatchlists: getPlanLimits('maxWatchlists'),
      maxAlerts: getPlanLimits('maxAlerts'),
      apiCallsPerDay: getPlanLimits('apiCallsPerDay'),
      dataRetentionDays: getPlanLimits('dataRetentionDays')
    };
  }, [userSubscription, getPlanLimits]);

  return limits;
};

/**
 * Component wrapper for feature gating
 */
export interface FeatureGateProps {
  feature: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  fallback = null,
  children
}) => {
  const { canAccessFeature } = usePlan();

  if (!canAccessFeature(feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

/**
 * Utility to check if feature is available
 */
export const isFeatureAvailable = (plan: string, feature: string): boolean => {
  const featureMap: Record<string, string[]> = {
    advancedAnalytics: ['pro', 'enterprise'],
    realTimeData: ['pro', 'enterprise'],
    aiInsights: ['pro', 'enterprise'],
    defiIntegration: ['enterprise'],
    customIntegrations: ['enterprise'],
    dedicatedSupport: ['enterprise'],
    apiAccess: ['enterprise'],
    unlimitedTransactions: ['pro', 'enterprise']
  };

  return featureMap[feature]?.includes(plan) || false;
};

/**
 * Get upgrade message for a feature
 */
export const getUpgradeMessage = (feature: string, currentPlan: string): string => {
  const messages: Record<string, Record<string, string>> = {
    advancedAnalytics: {
      basic: 'Upgrade to Pro or Enterprise to access advanced analytics'
    },
    realTimeData: {
      basic: 'Upgrade to Pro or Enterprise for real-time market data'
    },
    aiInsights: {
      basic: 'Upgrade to Pro or Enterprise to access AI-powered insights'
    },
    defiIntegration: {
      basic: 'Upgrade to Enterprise for DeFi integration',
      pro: 'Upgrade to Enterprise for DeFi integration'
    },
    customIntegrations: {
      basic: 'Upgrade to Enterprise for custom integrations',
      pro: 'Upgrade to Enterprise for custom integrations'
    },
    dedicatedSupport: {
      basic: 'Upgrade to Enterprise for dedicated support',
      pro: 'Upgrade to Enterprise for dedicated support'
    },
    apiAccess: {
      basic: 'Upgrade to Enterprise for API access',
      pro: 'Upgrade to Enterprise for API access'
    }
  };

  return messages[feature]?.[currentPlan] || `Upgrade your plan to access this feature`;
};
