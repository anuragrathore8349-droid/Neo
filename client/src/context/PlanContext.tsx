import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as paymentService from '../services/payment.service';
import { useAuth } from './AuthContext';

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

const normalizePlanId = (planId?: string | null): string => {
  if (!planId) return 'basic';
  const normalized = String(planId).trim().toLowerCase();
  if (normalized.includes('enterprise')) return 'enterprise';
  if (normalized.includes('pro')) return 'pro';
  if (normalized.includes('basic') || normalized.includes('free') || normalized.includes('starter')) return 'basic';
  return normalized;
};

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

// Feature access mapping — single source of truth on the client
const FEATURE_ACCESS: Record<string, string[]> = {
  advancedAnalytics: ['pro', 'enterprise'],
  realTimeData: ['pro', 'enterprise'],
  aiInsights: ['pro', 'enterprise'],
  defiIntegration: ['enterprise'],
  customIntegrations: ['enterprise'],
  dedicatedSupport: ['enterprise'],
  apiAccess: ['enterprise'],
  unlimitedTransactions: ['pro', 'enterprise'],
};

export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { updateUserPlan } = useAuth();   // ← consume AuthContext
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const fetchUserSubscription = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await paymentService.getUserSubscription();

      let resolvedPlanId: string | null = null;

      if (response.subscription) {
        resolvedPlanId = normalizePlanId(response.subscription.planId);
        setUserSubscription({
          planId: resolvedPlanId,
          status: response.subscription.status,
          currentPeriodStart: response.subscription.currentPeriodStart,
          currentPeriodEnd: response.subscription.currentPeriodEnd,
        });
        const plan = allPlans.find(p => p.id === resolvedPlanId);
        if (plan) setCurrentPlan(plan);
      } else if (response.currentPlan) {
        resolvedPlanId = normalizePlanId(response.currentPlan);
        setUserSubscription({ planId: resolvedPlanId, status: 'active' });
        const plan = allPlans.find(p => p.id === resolvedPlanId);
        if (plan) setCurrentPlan(plan);
      }

      // ← KEY FIX: sync plan into AuthContext so Header reflects the real plan
      if (resolvedPlanId) {
        updateUserPlan(resolvedPlanId);
      }

      setError(null);
    } catch (err: any) {
      if (err?.status !== 401) {
        setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
      }
    } finally {
      setIsLoading(false);
    }
  }, [allPlans, updateUserPlan]);

  const canAccessFeature = useCallback((featureName: string): boolean => {
    const planId = normalizePlanId(userSubscription?.planId);
    if (!planId) return false;
    const allowedPlans = FEATURE_ACCESS[featureName] || [];
    return allowedPlans.includes(planId);
  }, [userSubscription]);

  const getPlanLimits = useCallback((limitType: string) => {
    if (!currentPlan) return null;
    return currentPlan.limits?.[limitType] ?? null;
  }, [currentPlan]);

  const upgradeToPlans = useCallback(async (planId: string) => {
    try {
      setIsLoading(true);
      const response = await paymentService.createCheckoutSession(planId);
      if (response.url) {
        window.location.href = response.url;
      } else if (response.free) {
        const normalizedPlanId = normalizePlanId(response.planId || planId);
        setUserSubscription({ planId: normalizedPlanId, status: response.status === 'active' ? 'active' : 'pending' });
        updateUserPlan(normalizedPlanId);
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

  const refreshSubscription = useCallback(async () => {
    await fetchUserSubscription();
  }, [fetchUserSubscription]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

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
    refreshSubscription,
  };

  return (
    <PlanContext.Provider value={value}>
      {children}
    </PlanContext.Provider>
  );
};

export const usePlan = (): PlanContextType => {
  const context = useContext(PlanContext);
  if (!context) throw new Error('usePlan must be used within PlanProvider');
  return context;
};
