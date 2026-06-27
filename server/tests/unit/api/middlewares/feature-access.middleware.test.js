'use strict';

// Mock Transaction model used in checkTransactionLimit
jest.mock('../../models/transaction.model', () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
}));

const {
  featureAccess,
  checkTransactionLimit,
  checkApiLimit,
  checkSubscriptionStatus,
  requirePaidPlan,
  getRequiredPlan,
} = require('../../api/middlewares/feature-access.middleware');

// ─── helpers ─────────────────────────────────────────────────────────────────
const makeReq = (plan = 'basic', overrides = {}) => ({
  user: { id: 'user1', plan, ...overrides.user },
  ...overrides,
});

const makeRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

// ─── featureAccess ───────────────────────────────────────────────────────────
describe('featureAccess middleware', () => {
  let next;

  beforeEach(() => {
    next = jest.fn();
  });

  test('calls next() for PRO user accessing advancedAnalytics', () => {
    const mw = featureAccess('advancedAnalytics');
    const req = makeReq('pro');
    const res = makeRes();

    mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('returns 403 for BASIC user accessing advancedAnalytics', () => {
    const mw = featureAccess('advancedAnalytics');
    const req = makeReq('basic');
    const res = makeRes();

    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 for PRO user accessing defiIntegration', () => {
    const mw = featureAccess('defiIntegration');
    const req = makeReq('pro');
    const res = makeRes();

    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('calls next() for ENTERPRISE user accessing defiIntegration', () => {
    const mw = featureAccess('defiIntegration');
    const req = makeReq('enterprise');
    const res = makeRes();

    mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('includes requiredPlan in 403 response', () => {
    const mw = featureAccess('aiInsights');
    const req = makeReq('basic');
    const res = makeRes();

    mw(req, res, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ requiredPlan: expect.any(String) })
    );
  });

  test('defaults to basic plan when req.user.plan is missing', () => {
    const mw = featureAccess('advancedAnalytics');
    const req = { user: {} };
    const res = makeRes();

    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 500 when an error is thrown internally', () => {
    // Force error by passing bad plan config
    const mw = featureAccess(null); // null feature
    const req = makeReq('pro');
    const res = makeRes();

    // Should not throw; should respond 500 or call next
    expect(() => mw(req, res, next)).not.toThrow();
  });
});

// ─── requirePaidPlan ─────────────────────────────────────────────────────────
describe('requirePaidPlan middleware', () => {
  let next;

  beforeEach(() => next = jest.fn());

  test('calls next() for pro user', () => {
    requirePaidPlan(makeReq('pro'), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('calls next() for enterprise user', () => {
    requirePaidPlan(makeReq('enterprise'), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('returns 403 for basic user', () => {
    const res = makeRes();
    requirePaidPlan(makeReq('basic'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ requiresUpgrade: true }));
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── checkSubscriptionStatus ─────────────────────────────────────────────────
describe('checkSubscriptionStatus middleware', () => {
  let next;

  beforeEach(() => next = jest.fn());

  test('calls next() when subscription is active', async () => {
    const req = { user: { plan: 'pro', subscription: { status: 'active' } } };
    const res = makeRes();
    await checkSubscriptionStatus(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('returns 403 when subscription is cancelled', async () => {
    const req = { user: { plan: 'pro', subscription: { status: 'cancelled' } } };
    const res = makeRes();
    await checkSubscriptionStatus(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ requiresRenewal: true }));
  });

  test('allows basic plan even if subscription field is missing', async () => {
    const req = { user: { plan: 'basic' } };
    const res = makeRes();
    await checkSubscriptionStatus(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('returns 403 when trial has expired', async () => {
    const req = {
      user: {
        plan: 'pro',
        subscription: {
          status: 'active',
          isTrialActive: true,
          trialEndsAt: new Date(Date.now() - 1000).toISOString(), // expired
        },
      },
    };
    const res = makeRes();
    await checkSubscriptionStatus(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ requiresUpgrade: true }));
  });

  test('calls next() when trial is still active', async () => {
    const req = {
      user: {
        plan: 'pro',
        subscription: {
          status: 'active',
          isTrialActive: true,
          trialEndsAt: new Date(Date.now() + 86400000).toISOString(), // future
        },
      },
    };
    const res = makeRes();
    await checkSubscriptionStatus(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ─── checkTransactionLimit ───────────────────────────────────────────────────
describe('checkTransactionLimit middleware', () => {
  const Transaction = require('../../models/transaction.model');
  let next;

  beforeEach(() => {
    next = jest.fn();
    jest.clearAllMocks();
  });

  test('calls next() when under limit', async () => {
    Transaction.countDocuments.mockResolvedValue(10);
    const req = makeReq('basic', { user: { id: 'u1', plan: 'basic' } });
    const res = makeRes();
    await checkTransactionLimit(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('returns 403 when at limit for basic plan (50 txns)', async () => {
    Transaction.countDocuments.mockResolvedValue(50);
    const req = makeReq('basic', { user: { id: 'u1', plan: 'basic' } });
    const res = makeRes();
    await checkTransactionLimit(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ requiresUpgrade: true }));
  });

  test('attaches planLimits to req on success', async () => {
    Transaction.countDocuments.mockResolvedValue(5);
    const req = makeReq('pro', { user: { id: 'u1', plan: 'pro' } });
    const res = makeRes();
    await checkTransactionLimit(req, res, next);
    expect(req.planLimits).toBeDefined();
  });
});

// ─── checkApiLimit ───────────────────────────────────────────────────────────
describe('checkApiLimit middleware', () => {
  test('attaches apiLimit to req and calls next()', async () => {
    const next = jest.fn();
    const req = { user: { id: 'u1', plan: 'pro' } };
    const res = makeRes();
    await checkApiLimit(req, res, next);
    expect(req.apiLimit).toBeDefined();
    expect(next).toHaveBeenCalled();
  });
});

// ─── getRequiredPlan ─────────────────────────────────────────────────────────
describe('getRequiredPlan', () => {
  test('advancedAnalytics requires pro', () => {
    expect(getRequiredPlan('advancedAnalytics')).toBe('pro');
  });

  test('defiIntegration requires enterprise', () => {
    expect(getRequiredPlan('defiIntegration')).toBe('enterprise');
  });

  test('unknown feature defaults to pro', () => {
    expect(getRequiredPlan('unknownFeature')).toBe('pro');
  });
});
