'use strict';

const {
  PLANS,
  FEATURE_ACCESS,
  getPlanById,
  getAllPlans,
  canAccessFeature,
  getPlanLimits,
  getRemainingLimit,
} = require('../../config/plans.config');

// ─── PLANS object ────────────────────────────────────────────────────────────
describe('PLANS', () => {
  test('has BASIC, PRO, ENTERPRISE entries', () => {
    expect(PLANS).toHaveProperty('BASIC');
    expect(PLANS).toHaveProperty('PRO');
    expect(PLANS).toHaveProperty('ENTERPRISE');
  });

  test('BASIC plan is free (price=0)', () => {
    expect(PLANS.BASIC.price).toBe(0);
  });

  test('PRO plan price is 29', () => {
    expect(PLANS.PRO.price).toBe(29);
  });

  test('ENTERPRISE plan price is 99', () => {
    expect(PLANS.ENTERPRISE.price).toBe(99);
  });

  test('each plan has required keys', () => {
    Object.values(PLANS).forEach(plan => {
      expect(plan).toHaveProperty('id');
      expect(plan).toHaveProperty('features');
      expect(plan).toHaveProperty('limits');
    });
  });
});

// ─── getPlanById ─────────────────────────────────────────────────────────────
describe('getPlanById', () => {
  test('returns BASIC plan for id "basic"', () => {
    const plan = getPlanById('basic');
    expect(plan.id).toBe('basic');
  });

  test('returns PRO plan for id "pro"', () => {
    const plan = getPlanById('pro');
    expect(plan.id).toBe('pro');
  });

  test('returns ENTERPRISE plan for id "enterprise"', () => {
    const plan = getPlanById('enterprise');
    expect(plan.id).toBe('enterprise');
  });

  test('throws for unknown plan id', () => {
    expect(() => getPlanById('unknown')).toThrow('Plan not found: unknown');
  });
});

// ─── getAllPlans ──────────────────────────────────────────────────────────────
describe('getAllPlans', () => {
  test('returns array of 3 plans', () => {
    expect(getAllPlans()).toHaveLength(3);
  });

  test('all plans have an id field', () => {
    getAllPlans().forEach(plan => expect(plan).toHaveProperty('id'));
  });
});

// ─── canAccessFeature ────────────────────────────────────────────────────────
describe('canAccessFeature', () => {
  test('basic plan cannot access advancedAnalytics', () => {
    expect(canAccessFeature('basic', 'advancedAnalytics')).toBe(false);
  });

  test('pro plan can access advancedAnalytics', () => {
    expect(canAccessFeature('pro', 'advancedAnalytics')).toBe(true);
  });

  test('enterprise plan can access advancedAnalytics', () => {
    expect(canAccessFeature('enterprise', 'advancedAnalytics')).toBe(true);
  });

  test('basic plan cannot access aiInsights', () => {
    expect(canAccessFeature('basic', 'aiInsights')).toBe(false);
  });

  test('pro plan can access aiInsights', () => {
    expect(canAccessFeature('pro', 'aiInsights')).toBe(true);
  });

  test('only enterprise can access defiIntegration', () => {
    expect(canAccessFeature('basic', 'defiIntegration')).toBe(false);
    expect(canAccessFeature('pro', 'defiIntegration')).toBe(false);
    expect(canAccessFeature('enterprise', 'defiIntegration')).toBe(true);
  });

  test('only enterprise can access apiAccess', () => {
    expect(canAccessFeature('enterprise', 'apiAccess')).toBe(true);
    expect(canAccessFeature('pro', 'apiAccess')).toBe(false);
  });

  test('returns false for unknown feature', () => {
    expect(canAccessFeature('enterprise', 'nonExistentFeature')).toBe(false);
  });
});

// ─── getPlanLimits ───────────────────────────────────────────────────────────
describe('getPlanLimits', () => {
  test('returns limits object for basic plan', () => {
    const limits = getPlanLimits('basic');
    expect(limits).toHaveProperty('maxPortfolios');
    expect(limits).toHaveProperty('maxAlerts');
    expect(limits).toHaveProperty('apiCallsPerDay');
  });

  test('basic plan maxPortfolios is 1', () => {
    expect(getPlanLimits('basic').maxPortfolios).toBe(1);
  });

  test('enterprise plan limits are Unlimited', () => {
    const limits = getPlanLimits('enterprise');
    expect(limits.maxPortfolios).toBe('Unlimited');
    expect(limits.maxAlerts).toBe('Unlimited');
  });

  test('pro plan maxAlerts is 50', () => {
    expect(getPlanLimits('pro').maxAlerts).toBe(50);
  });
});

// ─── getRemainingLimit ───────────────────────────────────────────────────────
describe('getRemainingLimit', () => {
  test('returns "Unlimited" for enterprise maxPortfolios', () => {
    expect(getRemainingLimit('enterprise', 'maxPortfolios', 99)).toBe('Unlimited');
  });

  test('returns correct remaining count for basic plan', () => {
    // basic maxAlerts=5, currently 3 used => 2 remaining
    expect(getRemainingLimit('basic', 'maxAlerts', 3)).toBe(2);
  });

  test('returns 0 when limit exactly met', () => {
    expect(getRemainingLimit('basic', 'maxAlerts', 5)).toBe(0);
  });

  test('returns negative when over limit', () => {
    expect(getRemainingLimit('basic', 'maxAlerts', 10)).toBe(-5);
  });

  test('throws for unknown plan id', () => {
    expect(() => getRemainingLimit('ghost', 'maxAlerts', 0)).toThrow();
  });
});

// ─── FEATURE_ACCESS ──────────────────────────────────────────────────────────
describe('FEATURE_ACCESS', () => {
  test('is an object', () => {
    expect(typeof FEATURE_ACCESS).toBe('object');
  });

  test('contains expected feature keys', () => {
    const keys = ['advancedAnalytics', 'realTimeData', 'aiInsights', 'defiIntegration'];
    keys.forEach(k => expect(FEATURE_ACCESS).toHaveProperty(k));
  });

  test('values are arrays of plan ids', () => {
    Object.values(FEATURE_ACCESS).forEach(plans => {
      expect(Array.isArray(plans)).toBe(true);
    });
  });
});
