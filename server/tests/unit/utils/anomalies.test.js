'use strict';

jest.mock('../../api/middlewares/logger.middleware', () => require('../__mocks__/logger.mock'));
jest.mock('../../utils/openai-integration', () => ({
  getOpenAIInsights: jest.fn().mockResolvedValue('AI insight text'),
  getBasicExplanation: jest.fn().mockReturnValue('Basic explanation'),
}));

const {
  detectAnomalies,
  detectStatisticalAnomalies,
  detectAnomaliesBatch,
  calculateStatistics,
  calculateZScore,
  calculateSeverity,
  getConfidenceLevel,
  DEFAULT_CONFIG,
} = require('../../utils/anomalies');

// ─── helpers ─────────────────────────────────────────────────────────────────
// Generate an array with a clear outlier
const makeDataWithSpike = (n = 20, normal = 100, spikeValue = 1000) => {
  const values = Array(n).fill(normal);
  values[n - 1] = spikeValue;
  return values;
};

// ─── calculateStatistics ─────────────────────────────────────────────────────
describe('calculateStatistics', () => {
  test('returns zeros for empty array', () => {
    const stats = calculateStatistics([]);
    expect(stats).toEqual({ mean: 0, stdDev: 0, min: 0, max: 0, count: 0 });
  });

  test('returns zeros for array with no valid numbers', () => {
    const stats = calculateStatistics([NaN, null, undefined]);
    expect(stats.count).toBe(0);
  });

  test('calculates correct mean', () => {
    const stats = calculateStatistics([1, 2, 3, 4, 5]);
    expect(stats.mean).toBeCloseTo(3, 4);
  });

  test('calculates correct stdDev for known values', () => {
    // values [2,4,4,4,5,5,7,9] => stdDev=2
    const stats = calculateStatistics([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(stats.stdDev).toBeCloseTo(2, 1);
  });

  test('stdDev is 0 for identical values', () => {
    const stats = calculateStatistics([5, 5, 5, 5]);
    expect(stats.stdDev).toBe(0);
  });

  test('min and max are correct', () => {
    const stats = calculateStatistics([3, 1, 4, 1, 5, 9]);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(9);
  });

  test('filters out non-finite values', () => {
    const stats = calculateStatistics([1, Infinity, 2, NaN, 3]);
    expect(stats.count).toBe(3);
    expect(stats.mean).toBeCloseTo(2, 4);
  });
});

// ─── calculateZScore ─────────────────────────────────────────────────────────
describe('calculateZScore', () => {
  test('returns 0 when stdDev is 0', () => {
    expect(calculateZScore(5, 5, 0)).toBe(0);
  });

  test('returns positive z-score for value above mean', () => {
    expect(calculateZScore(13, 10, 1)).toBeCloseTo(3, 4);
  });

  test('returns negative z-score for value below mean', () => {
    expect(calculateZScore(7, 10, 1)).toBeCloseTo(-3, 4);
  });

  test('returns 0 when value equals mean', () => {
    expect(calculateZScore(10, 10, 2)).toBe(0);
  });
});

// ─── calculateSeverity ───────────────────────────────────────────────────────
describe('calculateSeverity', () => {
  test('returns value between 0 and 1', () => {
    [-10, -3, 0, 3, 10].forEach(z => {
      const s = calculateSeverity(z);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    });
  });

  test('severity increases with |zScore|', () => {
    expect(calculateSeverity(6)).toBeGreaterThan(calculateSeverity(3));
  });

  test('caps at 1.0 for very high z-scores', () => {
    expect(calculateSeverity(100)).toBe(1);
    expect(calculateSeverity(-100)).toBe(1);
  });

  test('z-score of 10 gives severity 1.0', () => {
    expect(calculateSeverity(10)).toBe(1);
  });
});

// ─── getConfidenceLevel ──────────────────────────────────────────────────────
describe('getConfidenceLevel', () => {
  test('returns 99.99% for absZScore >= 4', () => {
    expect(getConfidenceLevel(4)).toBe('99.99%');
    expect(getConfidenceLevel(10)).toBe('99.99%');
  });

  test('returns 99.7% for absZScore between 3 and 4', () => {
    expect(getConfidenceLevel(3)).toBe('99.7%');
    expect(getConfidenceLevel(3.5)).toBe('99.7%');
  });

  test('returns 98.8% for absZScore between 2.5 and 3', () => {
    expect(getConfidenceLevel(2.5)).toBe('98.8%');
  });

  test('returns 95.4% for absZScore between 2 and 2.5', () => {
    expect(getConfidenceLevel(2)).toBe('95.4%');
  });

  test('returns Low for absZScore below 2', () => {
    expect(getConfidenceLevel(1)).toBe('Low');
  });
});

// ─── detectStatisticalAnomalies ──────────────────────────────────────────────
describe('detectStatisticalAnomalies', () => {
  test('returns empty array for empty values', () => {
    const result = detectStatisticalAnomalies('BTC', [], 3);
    expect(result).toEqual([]);
  });

  test('returns empty array when fewer than minDataPoints values', () => {
    const result = detectStatisticalAnomalies('BTC', [1, 2, 3], 3, { minDataPoints: 10 });
    expect(result).toEqual([]);
  });

  test('returns empty array when all values are identical (no variance)', () => {
    const result = detectStatisticalAnomalies('BTC', Array(15).fill(100), 3);
    expect(result).toEqual([]);
  });

  test('detects a clear spike', () => {
    const values = makeDataWithSpike(20, 100, 5000);
    const result = detectStatisticalAnomalies('BTC', values, 3);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].symbol).toBe('BTC');
    expect(result[0].type).toBe('spike');
  });

  test('detects a clear dip', () => {
    const values = Array(20).fill(100);
    values[19] = -5000;
    const result = detectStatisticalAnomalies('BTC', values, 3);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].type).toBe('dip');
  });

  test('anomaly object has required fields', () => {
    const values = makeDataWithSpike(20, 100, 5000);
    const [anomaly] = detectStatisticalAnomalies('ETH', values, 3);
    expect(anomaly).toHaveProperty('symbol', 'ETH');
    expect(anomaly).toHaveProperty('value');
    expect(anomaly).toHaveProperty('zScore');
    expect(anomaly).toHaveProperty('severity');
    expect(anomaly).toHaveProperty('type');
    expect(anomaly).toHaveProperty('confidenceLevel');
    expect(anomaly).toHaveProperty('percentileDeviation');
  });

  test('uses threshold to filter: higher threshold means fewer anomalies', () => {
    const values = makeDataWithSpike(20, 100, 500);
    const loose  = detectStatisticalAnomalies('BTC', values, 2);
    const strict = detectStatisticalAnomalies('BTC', values, 10);
    expect(loose.length).toBeGreaterThanOrEqual(strict.length);
  });
});

// ─── detectAnomalies ─────────────────────────────────────────────────────────
describe('detectAnomalies', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns empty array for empty input', async () => {
    const result = await detectAnomalies([], 3, { enrichWithAI: false });
    expect(result).toEqual([]);
  });

  test('returns empty array for non-array input', async () => {
    const result = await detectAnomalies(null, 3, { enrichWithAI: false });
    expect(result).toEqual([]);
  });

  test('skips items missing symbol or values', async () => {
    const result = await detectAnomalies(
      [{ symbol: 'BTC' }, { values: [1, 2, 3] }],
      3,
      { enrichWithAI: false }
    );
    expect(result).toEqual([]);
  });

  test('detects anomalies across multiple symbols', async () => {
    const data = [
      { symbol: 'BTC', values: makeDataWithSpike(20, 100, 5000) },
      { symbol: 'ETH', values: makeDataWithSpike(20, 50, 3000) },
    ];
    const result = await detectAnomalies(data, 3, { enrichWithAI: false });
    expect(result.length).toBeGreaterThan(0);
  });

  test('sorts results by severity descending', async () => {
    const data = [
      { symbol: 'BTC', values: makeDataWithSpike(20, 100, 10000) },
      { symbol: 'ETH', values: makeDataWithSpike(20, 100, 500) },
    ];
    const result = await detectAnomalies(data, 3, { enrichWithAI: false });
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].severity).toBeGreaterThanOrEqual(result[i].severity);
    }
  });

  test('respects maxResults option', async () => {
    const data = Array.from({ length: 5 }, (_, i) => ({
      symbol: `COIN${i}`,
      values: makeDataWithSpike(20, 100, 5000),
    }));
    const result = await detectAnomalies(data, 3, { enrichWithAI: false, maxResults: 2 });
    expect(result.length).toBeLessThanOrEqual(2);
  });
});

// ─── detectAnomaliesBatch ────────────────────────────────────────────────────
describe('detectAnomaliesBatch', () => {
  test('returns empty report for empty input', async () => {
    const result = await detectAnomaliesBatch([], { enableAIEnrichment: false });
    expect(result.total).toBe(0);
    expect(result.anomalies).toEqual([]);
  });

  test('returns aggregated summary', async () => {
    const dataArray = [
      { symbol: 'BTC', values: makeDataWithSpike(20, 100, 5000) },
    ];
    const result = await detectAnomaliesBatch(dataArray, { enableAIEnrichment: false });
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('anomalies');
    expect(result).toHaveProperty('summary');
    expect(result.summary).toHaveProperty('threshold');
    expect(result.summary).toHaveProperty('detectionMethod', 'statistical_zscore');
  });

  test('summary.highestSeverity reflects worst anomaly', async () => {
    const dataArray = [
      { symbol: 'BTC', values: makeDataWithSpike(20, 100, 50000) },
    ];
    const result = await detectAnomaliesBatch(dataArray, { enableAIEnrichment: false });
    expect(result.summary.highestSeverity).toBeGreaterThan(0);
  });
});

// ─── DEFAULT_CONFIG ──────────────────────────────────────────────────────────
describe('DEFAULT_CONFIG', () => {
  test('has expected fields', () => {
    expect(DEFAULT_CONFIG).toHaveProperty('threshold');
    expect(DEFAULT_CONFIG).toHaveProperty('minDataPoints');
    expect(DEFAULT_CONFIG).toHaveProperty('enrichWithAI');
    expect(DEFAULT_CONFIG).toHaveProperty('enableLogging');
  });

  test('default threshold is 3', () => {
    expect(DEFAULT_CONFIG.threshold).toBe(3);
  });
});
