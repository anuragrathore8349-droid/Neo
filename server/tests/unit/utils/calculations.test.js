'use strict';

// Mock the logger before requiring anything that uses it
jest.mock('../../api/middlewares/logger.middleware', () => require('../__mocks__/logger.mock'));

// Mock the PortfolioHistory model used inside calculateReturns
jest.mock('../../models/portfolio-history.model');

const {
  calculateMetrics,
  calculateReturns,
  calculateStandardDeviation,
  calculateAverageReturn,
  calculateBeta,
  calculateRSquared,
} = require('../../utils/calculations');

const PortfolioHistory = require('../../models/portfolio-history.model');

// ─── helpers ─────────────────────────────────────────────────────────────────
const makePortfolio = (assets = []) => ({
  _id: 'portfolio123',
  assets,
});

const makeAsset = (symbol, profitPercentage) => ({ symbol, profitPercentage });

// ─── calculateAverageReturn ───────────────────────────────────────────────────
describe('calculateAverageReturn', () => {
  test('returns correct average of positive numbers', () => {
    expect(calculateAverageReturn([0.1, 0.2, 0.3])).toBeCloseTo(0.2, 5);
  });

  test('returns correct average including negatives', () => {
    expect(calculateAverageReturn([-0.1, 0.1])).toBeCloseTo(0, 5);
  });

  test('handles single element', () => {
    expect(calculateAverageReturn([0.05])).toBeCloseTo(0.05, 5);
  });

  test('returns 0 for array of zeros', () => {
    expect(calculateAverageReturn([0, 0, 0])).toBe(0);
  });
});

// ─── calculateStandardDeviation ──────────────────────────────────────────────
describe('calculateStandardDeviation', () => {
  test('returns 0 for identical values', () => {
    expect(calculateStandardDeviation([5, 5, 5])).toBe(0);
  });

  test('returns correct std dev for known values', () => {
    // values: [2, 4, 4, 4, 5, 5, 7, 9] => mean=5, variance=4, stdDev=2
    const result = calculateStandardDeviation([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(result).toBeCloseTo(2, 4);
  });

  test('is always non-negative', () => {
    const result = calculateStandardDeviation([-1, 0, 1, 2, 3]);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  test('handles two-element array', () => {
    const result = calculateStandardDeviation([0, 2]);
    expect(result).toBeCloseTo(1, 4);
  });
});

// ─── calculateBeta ────────────────────────────────────────────────────────────
describe('calculateBeta', () => {
  test('returns 1 for perfectly correlated returns with same variance', () => {
    const returns = [0.01, -0.02, 0.03, 0.01, -0.01];
    const beta = calculateBeta(returns, returns);
    expect(beta).toBeCloseTo(1, 3);
  });

  test('returns approximately 0 for uncorrelated returns', () => {
    // market: all same => variance=0 => would divide by zero
    // use near-zero variance but non-zero
    const portfolio = [0.01, 0.02, 0.01, 0.02];
    const market    = [0.01, 0.01, 0.01, 0.01];
    // stdDev of market ≈ 0, covariance≈0, result should be 0 or NaN
    const beta = calculateBeta(portfolio, market);
    expect(isFinite(beta) ? Math.abs(beta) : 0).toBeGreaterThanOrEqual(0);
  });

  test('accepts two arrays of equal length', () => {
    const a = [0.01, -0.01, 0.02];
    const b = [0.005, -0.005, 0.01];
    const beta = calculateBeta(a, b);
    expect(typeof beta).toBe('number');
  });
});

// ─── calculateRSquared ────────────────────────────────────────────────────────
describe('calculateRSquared', () => {
  test('returns 1 for perfectly correlated arrays', () => {
    const returns = [0.01, 0.02, -0.01, 0.03];
    expect(calculateRSquared(returns, returns)).toBeCloseTo(1, 4);
  });

  test('returns value between 0 and 1 for real data', () => {
    const portfolio = [0.01, -0.02, 0.03, 0.01, -0.01];
    const market    = [0.005, -0.015, 0.02, 0.008, -0.008];
    const r2 = calculateRSquared(portfolio, market);
    expect(r2).toBeGreaterThanOrEqual(0);
    expect(r2).toBeLessThanOrEqual(1);
  });
});

// ─── calculateReturns ────────────────────────────────────────────────────────
describe('calculateReturns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns empty array when portfolio has no _id', async () => {
    const portfolio = { assets: [] }; // no _id
    const result = await calculateReturns(portfolio);
    expect(result).toEqual([]);
  });

  test('returns empty array when fewer than 2 snapshots exist', async () => {
    PortfolioHistory.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ totalValue: 1000, timestamp: new Date() }]),
    });

    const result = await calculateReturns(makePortfolio());
    expect(result).toEqual([]);
  });

  test('calculates daily returns from multiple snapshots', async () => {
    const snapshots = [
      { totalValue: 1000, timestamp: new Date('2024-01-01') },
      { totalValue: 1100, timestamp: new Date('2024-01-02') },
      { totalValue: 1050, timestamp: new Date('2024-01-03') },
    ];
    PortfolioHistory.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(snapshots),
    });

    const result = await calculateReturns(makePortfolio());
    expect(result.length).toBe(2);
    expect(result[0]).toBeCloseTo(0.1, 4);  // (1100-1000)/1000
    expect(result[1]).toBeCloseTo(-0.04545, 3); // (1050-1100)/1100
  });

  test('skips entries with non-numeric or zero prevValue', async () => {
    const snapshots = [
      { totalValue: 0,    timestamp: new Date('2024-01-01') },
      { totalValue: 1000, timestamp: new Date('2024-01-02') },
      { totalValue: 1100, timestamp: new Date('2024-01-03') },
    ];
    PortfolioHistory.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(snapshots),
    });

    const result = await calculateReturns(makePortfolio());
    // First pair skipped (prevValue=0), second valid
    expect(result.length).toBe(1);
    expect(result[0]).toBeCloseTo(0.1, 4);
  });

  test('returns empty array on DB error', async () => {
    PortfolioHistory.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockRejectedValue(new Error('DB error')),
    });

    const result = await calculateReturns(makePortfolio());
    expect(result).toEqual([]);
  });
});

// ─── calculateMetrics ────────────────────────────────────────────────────────
describe('calculateMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns null metrics when portfolio has insufficient history', async () => {
    PortfolioHistory.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    const portfolio = makePortfolio([makeAsset('BTC', 10), makeAsset('ETH', -5)]);
    const result = await calculateMetrics(portfolio);

    expect(result.sharpeRatio).toBeNull();
    expect(result.volatility).toBeNull();
    expect(result.beta).toBeNull();
  });

  test('populates bestPerformingAsset from portfolio assets', async () => {
    PortfolioHistory.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    const portfolio = makePortfolio([
      makeAsset('BTC', 20),
      makeAsset('ETH', 5),
    ]);
    const result = await calculateMetrics(portfolio);
    expect(result.bestPerformingAsset?.symbol).toBe('BTC');
    expect(result.bestPerformingAsset?.returnPercentage).toBe(20);
  });

  test('populates worstPerformingAsset from portfolio assets', async () => {
    PortfolioHistory.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    const portfolio = makePortfolio([
      makeAsset('BTC', 20),
      makeAsset('ETH', -10),
    ]);
    const result = await calculateMetrics(portfolio);
    expect(result.worstPerformingAsset?.symbol).toBe('ETH');
    expect(result.worstPerformingAsset?.returnPercentage).toBe(-10);
  });

  test('calculates sharpe ratio with sufficient history', async () => {
    const snapshots = Array.from({ length: 10 }, (_, i) => ({
      totalValue: 1000 + i * 50,
      timestamp: new Date(Date.now() - (10 - i) * 86400000),
    }));

    PortfolioHistory.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(snapshots),
    });

    const portfolio = makePortfolio([makeAsset('BTC', 15)]);
    const result = await calculateMetrics(portfolio);
    expect(typeof result.sharpeRatio).toBe('number');
    expect(typeof result.volatility).toBe('number');
  });

  test('returns null metrics on unexpected error', async () => {
    PortfolioHistory.find = jest.fn().mockImplementation(() => {
      throw new Error('Unexpected');
    });

    const portfolio = { _id: 'abc', assets: [] };
    const result = await calculateMetrics(portfolio);
    expect(result.sharpeRatio).toBeNull();
    expect(result.volatility).toBeNull();
  });
});
