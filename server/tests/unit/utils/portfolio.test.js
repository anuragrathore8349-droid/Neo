'use strict';

jest.mock('../../api/middlewares/logger.middleware', () => require('../__mocks__/logger.mock'));
jest.mock('../../utils/openai-integration', () => ({
  generateStrategyRecommendation: jest.fn().mockResolvedValue('Buy more BTC'),
}));

const {
  calculateAssetReturns,
  calculateAssetStatistics,
  calculateCovarianceMatrix,
  calculatePortfolioMetrics,
  calculateSharpeRatio,
  calculatePortfolioReturn,
  calculatePortfolioVolatility,
  generateRandomWeights,
  createEqualWeight,
  normalizeWeights,
  applyConstraints,
  calculateCorrelationMatrix,
  optimizePortfolio,
} = require('../../utils/portfolio');

// ─── helpers ─────────────────────────────────────────────────────────────────
const makeHistoricalData = (n = 30, start = 100, step = 1) =>
  [Array.from({ length: n }, (_, i) => start + i * step)];

// ─── createEqualWeight ───────────────────────────────────────────────────────
describe('createEqualWeight', () => {
  test('weights sum to 1', () => {
    const w = createEqualWeight(5);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
  });

  test('all weights are equal', () => {
    const w = createEqualWeight(4);
    w.forEach(wi => expect(wi).toBeCloseTo(0.25, 8));
  });

  test('works for n=1', () => {
    expect(createEqualWeight(1)).toEqual([1]);
  });
});

// ─── normalizeWeights ────────────────────────────────────────────────────────
describe('normalizeWeights', () => {
  test('normalized weights sum to 1', () => {
    const w = normalizeWeights([1, 2, 3, 4]);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
  });

  test('preserves relative proportions', () => {
    const w = normalizeWeights([1, 3]);
    expect(w[1] / w[0]).toBeCloseTo(3, 4);
  });

  test('works with equal weights', () => {
    const w = normalizeWeights([2, 2, 2]);
    w.forEach(wi => expect(wi).toBeCloseTo(1 / 3, 6));
  });
});

// ─── generateRandomWeights ───────────────────────────────────────────────────
describe('generateRandomWeights', () => {
  test('weights sum to 1', () => {
    const w = generateRandomWeights(5);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
  });

  test('all weights are positive', () => {
    const w = generateRandomWeights(5);
    w.forEach(wi => expect(wi).toBeGreaterThanOrEqual(0));
  });

  test('returns correct number of weights', () => {
    expect(generateRandomWeights(3)).toHaveLength(3);
    expect(generateRandomWeights(10)).toHaveLength(10);
  });
});

// ─── applyConstraints ────────────────────────────────────────────────────────
describe('applyConstraints', () => {
  test('clips weights below minWeight', () => {
    const weights = [0.001, 0.5, 0.499];
    const result = applyConstraints(weights, { minWeight: 0.05, maxWeight: 1 });
    result.forEach(w => expect(w).toBeGreaterThanOrEqual(0.05 - 1e-9));
  });

  test('clips weights above maxWeight', () => {
    const weights = [0.8, 0.1, 0.1];
    const result = applyConstraints(weights, { minWeight: 0, maxWeight: 0.5 });
    result.forEach(w => expect(w).toBeLessThanOrEqual(0.5 + 1e-9));
  });

  test('re-normalized weights sum to 1', () => {
    const weights = [0.8, 0.1, 0.1];
    const result = applyConstraints(weights, { minWeight: 0, maxWeight: 0.5 });
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });

  test('no-op when weights already within bounds', () => {
    const weights = createEqualWeight(4);
    const result = applyConstraints(weights, { minWeight: 0, maxWeight: 1 });
    result.forEach((w, i) => expect(w).toBeCloseTo(weights[i], 6));
  });
});

// ─── calculateAssetReturns ───────────────────────────────────────────────────
describe('calculateAssetReturns', () => {
  test('returns array of arrays', () => {
    const historical = [[100, 110, 105], [50, 55, 52]];
    const result = calculateAssetReturns(historical);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(2);
  });

  test('computes percentage returns correctly', () => {
    const result = calculateAssetReturns([[100, 120]]);
    expect(result[0][0]).toBeCloseTo(0.2, 5);
  });

  test('filters out non-finite returns', () => {
    const result = calculateAssetReturns([[0, 100]]);
    // (100-0)/0 = Infinity -> should be filtered
    expect(result[0]).toEqual([]);
  });
});

// ─── calculateAssetStatistics ────────────────────────────────────────────────
describe('calculateAssetStatistics', () => {
  test('returns mean, stdDev, variance for each asset', () => {
    const returns = [[0.1, 0.2, 0.3]];
    const stats = calculateAssetStatistics(returns);
    expect(stats[0]).toHaveProperty('mean');
    expect(stats[0]).toHaveProperty('stdDev');
    expect(stats[0]).toHaveProperty('variance');
  });

  test('mean matches expected value', () => {
    const returns = [[0.1, 0.2, 0.3]];
    const stats = calculateAssetStatistics(returns);
    expect(stats[0].mean).toBeCloseTo(0.2, 5);
  });

  test('handles multiple assets', () => {
    const returns = [[0.01, 0.02], [-0.01, 0.00]];
    const stats = calculateAssetStatistics(returns);
    expect(stats).toHaveLength(2);
  });
});

// ─── calculateCovarianceMatrix ───────────────────────────────────────────────
describe('calculateCovarianceMatrix', () => {
  test('returns n×n matrix for n assets', () => {
    const returns = [[0.1, 0.2], [0.3, 0.1]];
    const matrix = calculateCovarianceMatrix(returns);
    expect(matrix).toHaveLength(2);
    matrix.forEach(row => expect(row).toHaveLength(2));
  });

  test('matrix is symmetric', () => {
    const returns = [[0.01, 0.02, -0.01], [0.02, -0.01, 0.03]];
    const matrix = calculateCovarianceMatrix(returns);
    expect(matrix[0][1]).toBeCloseTo(matrix[1][0], 8);
  });

  test('diagonal elements equal individual variances', () => {
    const returns = [[0.1, 0.3, 0.2]];
    const stats = calculateAssetStatistics(returns);
    const matrix = calculateCovarianceMatrix(returns);
    expect(matrix[0][0]).toBeCloseTo(stats[0].variance, 6);
  });
});

// ─── calculatePortfolioReturn ────────────────────────────────────────────────
describe('calculatePortfolioReturn', () => {
  test('equal weights give average return', () => {
    const weights = [0.5, 0.5];
    const stats = [{ mean: 0.1 }, { mean: 0.2 }];
    expect(calculatePortfolioReturn(weights, stats)).toBeCloseTo(0.15, 5);
  });

  test('full allocation to one asset returns its return', () => {
    const weights = [1, 0];
    const stats = [{ mean: 0.15 }, { mean: 0.05 }];
    expect(calculatePortfolioReturn(weights, stats)).toBeCloseTo(0.15, 5);
  });
});

// ─── calculatePortfolioVolatility / SharpeRatio ──────────────────────────────
describe('calculatePortfolioVolatility and SharpeRatio', () => {
  const weights = createEqualWeight(2);
  const stats = [
    { mean: 0.10, stdDev: 0.2, variance: 0.04 },
    { mean: 0.05, stdDev: 0.1, variance: 0.01 },
  ];
  const covariance = [[0.04, 0.01], [0.01, 0.01]];

  test('portfolio volatility is non-negative', () => {
    const vol = calculatePortfolioVolatility(weights, covariance);
    expect(vol).toBeGreaterThanOrEqual(0);
  });

  test('sharpe ratio is finite number', () => {
    const sharpe = calculateSharpeRatio(weights, stats, covariance, 0.02);
    expect(isFinite(sharpe)).toBe(true);
  });

  test('sharpe returns 0 when volatility is 0', () => {
    const zeroCovariance = [[0, 0], [0, 0]];
    const sharpe = calculateSharpeRatio(weights, stats, zeroCovariance, 0.02);
    expect(sharpe).toBe(0);
  });
});

// ─── calculatePortfolioMetrics ───────────────────────────────────────────────
describe('calculatePortfolioMetrics', () => {
  test('returns expected fields', () => {
    const weights = createEqualWeight(2);
    const stats = [
      { mean: 0.10, stdDev: 0.2, variance: 0.04 },
      { mean: 0.05, stdDev: 0.1, variance: 0.01 },
    ];
    const covariance = [[0.04, 0.01], [0.01, 0.01]];
    const metrics = calculatePortfolioMetrics(weights, stats, covariance);

    expect(metrics).toHaveProperty('expectedReturn');
    expect(metrics).toHaveProperty('volatility');
    expect(metrics).toHaveProperty('sharpeRatio');
    expect(metrics).toHaveProperty('expectedReturnAnnual');
    expect(metrics).toHaveProperty('volatilityAnnual');
  });

  test('annual return is approximately 252x daily return', () => {
    const weights = [1];
    const stats = [{ mean: 0.01, stdDev: 0.02, variance: 0.0004 }];
    const covariance = [[0.0004]];
    const metrics = calculatePortfolioMetrics(weights, stats, covariance);
    expect(metrics.expectedReturnAnnual).toBeCloseTo(metrics.expectedReturn * 252, 0);
  });
});

// ─── calculateCorrelationMatrix ──────────────────────────────────────────────
describe('calculateCorrelationMatrix', () => {
  test('diagonal is 1 for each asset with itself', () => {
    const returns = [[0.1, 0.2, 0.3], [0.1, 0.2, 0.3]];
    const stats = calculateAssetStatistics(returns);
    const covariance = calculateCovarianceMatrix(returns);
    const corr = calculateCorrelationMatrix(covariance, stats);
    corr.forEach((row, i) => expect(row[i]).toBeCloseTo(1, 4));
  });

  test('values are bounded between -1 and 1', () => {
    const returns = [[0.1, -0.2, 0.3], [0.2, 0.1, -0.1]];
    const stats = calculateAssetStatistics(returns);
    const covariance = calculateCovarianceMatrix(returns);
    const corr = calculateCorrelationMatrix(covariance, stats);
    corr.forEach(row => row.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(-1 - 1e-9);
      expect(v).toBeLessThanOrEqual(1 + 1e-9);
    }));
  });
});

// ─── optimizePortfolio ───────────────────────────────────────────────────────
describe('optimizePortfolio', () => {
  const assets = [
    { symbol: 'BTC', amount: 1 },
    { symbol: 'ETH', amount: 2 },
  ];
  const historicalData = [
    Array.from({ length: 30 }, (_, i) => 100 + i * 2),
    Array.from({ length: 30 }, (_, i) => 50 + i * 1),
  ];

  test('throws when no assets provided', async () => {
    await expect(optimizePortfolio([], historicalData)).rejects.toThrow('No assets provided');
  });

  test('returns allocation with correct number of entries', async () => {
    const result = await optimizePortfolio(assets, historicalData);
    expect(result.allocation).toHaveLength(2);
  });

  test('allocation weights sum to 100%', async () => {
    const result = await optimizePortfolio(assets, historicalData);
    const total = result.allocation.reduce((s, a) => s + a.weight, 0);
    expect(total).toBeCloseTo(100, 1);
  });

  test('returns metrics object', async () => {
    const result = await optimizePortfolio(assets, historicalData);
    expect(result).toHaveProperty('metrics');
    expect(result.metrics).toHaveProperty('expectedReturn');
  });

  test('returns objective field', async () => {
    const result = await optimizePortfolio(assets, historicalData, {}, 'minvar');
    expect(result.objective).toBe('minvar');
  });

  test('supports maxreturn objective', async () => {
    const result = await optimizePortfolio(assets, historicalData, {}, 'maxreturn');
    expect(result.allocation).toHaveLength(2);
  });

  test('supports default equal-weight for unknown objective', async () => {
    const result = await optimizePortfolio(assets, historicalData, {}, 'unknown');
    const total = result.allocation.reduce((s, a) => s + a.weight, 0);
    expect(total).toBeCloseTo(100, 1);
  });
});
