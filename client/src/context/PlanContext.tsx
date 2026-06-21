import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as paymentService from '../services/payment.service';

interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  features: Record<string, any>;
  limits: Record<string, any>;
}

interface UserSubscription {
  planId: string;
  status: 'active' | 'inactive' | 'cancelled' | 'pending';
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
}

interface PlanContextType {
  currentPlan: Plan | null;
  userSubscription: UserSubscription | null;
  allPlans: Plan[];
  isLoading: boolean;
  error: string | null;
  fetchPlans: () => Promise<void>;
  fetchUserSubscription: () => Promise<void>;
  canAccessFeature: (featureName: string) => boolean;
  getPlanLimits: (limitType: string) => any;
  upgradeToPlans: (planId: string) => Promise<any>;
  cancelSubscription: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Feature access mapping
  const FEATURE_ACCESS: Record<string, string[]> = {
    advancedAnalytics: ['pro', 'enterprise'],
    realTimeData: ['pro', 'enterprise'],
    aiInsights: ['pro', 'enterprise'],
    defiIntegration: ['enterprise'],
    customIntegrations: ['enterprise'],
    dedicatedSupport: ['enterprise'],
    apiAccess: ['enterprise'],
    unlimitedTransactions: ['pro', 'enterprise']
  };

  // Fetch all available plans (public endpoint, no auth needed)
  const fetchPlans = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await paymentService.getAvailablePlans();
      setAllPlans(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch plans');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch user's subscription (requires auth - safe to fail silently
  // when called for a logged-out visitor, e.g. on the landing page)
  const fetchUserSubscription = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await paymentService.getUserSubscription();

      if (response.subscription) {
        setUserSubscription({
          planId: response.subscription.planId,
          status: response.subscription.status,
          currentPeriodStart: response.subscription.currentPeriodStart,
          currentPeriodEnd: response.subscription.currentPeriodEnd
        });

        const plan = allPlans.find(p => p.id === response.subscription.planId);
        if (plan) {
          setCurrentPlan(plan);
        }
      } else if (response.currentPlan) {
        setUserSubscription({
          planId: response.currentPlan,
          status: 'active'
        });

        const plan = allPlans.find(p => p.id === response.currentPlan);
        if (plan) {
          setCurrentPlan(plan);
        }
      }

      setError(null);
    } catch (err: any) {
      // A 401 here just means the visitor isn't logged in yet (e.g. on
      // the landing page) - that's expected and shouldn't surface as an
      // error banner.
      if (err?.status !== 401) {
        setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
      }
    } finally {
      setIsLoading(false);
    }
  }, [allPlans]);

  // Check if user can access a feature
  const canAccessFeature = useCallback((featureName: string): boolean => {
    if (!userSubscription) return false;
    const allowedPlans = FEATURE_ACCESS[featureName] || [];
    return allowedPlans.includes(userSubscription.planId);
  }, [userSubscription]);

  // Get plan limits
  const getPlanLimits = useCallback((limitType: string) => {
    if (!currentPlan) return null;
    return currentPlan.limits?.[limitType] || null;
  }, [currentPlan]);

  // Select/upgrade to a plan.
  // - Paid plans: backend returns { sessionId, url } -> redirect to Stripe.
  // - Free "basic" plan: backend activates immediately and returns
  //   { free: true, planId, status } -> just refresh local subscription state.
  const upgradeToPlans = useCallback(async (planId: string) => {
    try {
      setIsLoading(true);
      const response = await paymentService.createCheckoutSession(planId);

      if (response.url) {
        // Redirect to Stripe checkout for paid plans
        window.location.href = response.url;
      } else if (response.free) {
        // Free plan activated immediately - refresh subscription state
        await fetchUserSubscription();
      }

      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate checkout');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserSubscription]);

  // Cancel subscription
  const cancelSubscription = useCallback(async () => {
    try {
      setIsLoading(true);
      await paymentService.cancelSubscription();
      await fetchUserSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserSubscription]);

  // Refresh subscription
  const refreshSubscription = useCallback(async () => {
    await fetchUserSubscription();
  }, [fetchUserSubscription]);

  // Load plans on mount
  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Fetch user subscription once plans are loaded AND the user is logged in.
  // (Checking for a stored auth token avoids a guaranteed 401 + console
  // noise for anonymous visitors on the landing page.)
  useEffect(() => {
    if (allPlans.length === 0) return;
    const hasSession = !!localStorage.getItem('neofin_auth');
    if (hasSession) {
      fetchUserSubscription();
    } else {
      setIsLoading(false);
    }
  }, [allPlans.length, fetchUserSubscription]);

  const value: PlanContextType = {
    currentPlan,
    userSubscription,
    allPlans,
    isLoading,
    error,
    fetchPlans,
    fetchUserSubscription,
    canAccessFeature,
    getPlanLimits,
    upgradeToPlans,
    cancelSubscription,
    refreshSubscription
  };

  return (
    <PlanContext.Provider value={value}>
      {children}
    </PlanContext.Provider>
  );
};

// Hook to use PlanContext
export const usePlan = (): PlanContextType => {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error('usePlan must be used within PlanProvider');
  }
  return context;
};
