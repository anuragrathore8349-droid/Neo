import { apiFetch } from './api';

export interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  description?: string;
  features: Record<string, any>;
  limits: Record<string, any>;
  stripePriceId?: string | null;
}

interface ApiResponse<T> {
  status: string;
  data: T;
  message?: string;
}

/**
 * Get all available plans (public, no auth required)
 */
export const getAvailablePlans = async (): Promise<Plan[]> => {
  const response = await apiFetch<ApiResponse<Plan[]>>('/api/payment/plans', {
    method: 'GET'
  });
  return response.data;
};

/**
 * Get user's current subscription
 */
export const getUserSubscription = async () => {
  const response = await apiFetch<ApiResponse<any>>('/api/payment/subscription', {
    method: 'GET'
  });
  return response.data;
};

/**
 * Create checkout session for a plan.
 * For the free "basic" plan, the backend activates it immediately and
 * returns { free: true, planId, status } instead of a Stripe session.
 */
export const createCheckoutSession = async (planId: string) => {
  const response = await apiFetch<ApiResponse<{ free?: boolean; sessionId?: string; url?: string; planId?: string; status?: string }>>(
    '/api/payment/checkout',
    {
      method: 'POST',
      body: { planId }
    }
  );
  return response.data;
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async () => {
  const response = await apiFetch<ApiResponse<{ message: string; cancelAt?: string }>>('/api/payment/cancel', {
    method: 'POST'
  });
  return response.data;
};

/**
 * Open the Stripe billing portal
 */
export const createPortalSession = async (returnUrl?: string) => {
  const response = await apiFetch<ApiResponse<{ url: string }>>('/api/payment/portal', {
    method: 'POST',
    body: { returnUrl }
  });
  return response.data;
};
