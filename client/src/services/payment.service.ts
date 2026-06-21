const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003';

/**
 * Get all available plans
 */
export const getAvailablePlans = async () => {
  const response = await fetch(`${API_BASE_URL}/api/payment/plans`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch plans');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Get user's current subscription
 */
export const getUserSubscription = async () => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE_URL}/api/payment/subscription`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch subscription');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Create checkout session for plan upgrade
 */
export const createCheckoutSession = async (planId: string) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE_URL}/api/payment/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ planId })
  });

  if (!response.ok) {
    throw new Error('Failed to create checkout session');
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.message || 'Checkout failed');
  }
  
  return data;
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async () => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE_URL}/api/payment/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to cancel subscription');
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.message || 'Cancellation failed');
  }
  
  return data;
};

/**
 * Update payment method
 */
export const updatePaymentMethod = async (paymentMethodId: string) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE_URL}/api/payment/payment-method`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ paymentMethodId })
  });

  if (!response.ok) {
    throw new Error('Failed to update payment method');
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.message || 'Update failed');
  }
  
  return data;
};

/**
 * Get billing history
 */
export const getBillingHistory = async () => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE_URL}/api/payment/billing-history`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch billing history');
  }

  const data = await response.json();
  return data.data;
};
