const { logger } = require('../api/middlewares/logger.middleware');
const { generateStrategyRecommendation } = require('./openai-integration');

/**
 * Portfolio Optimization – Modern Portfolio Theory (MPT)
 * Three DISTINCT objectives with genuinely different logic:
 *
 *  1. 'sharpe'    – Max Risk-Adjusted Return  → Monte-Carlo + hill-climb on Sharpe ratio
 *  2. 'minvar'    – Minimum Volatility        → Analytical (closed-form) minimum-variance weights
 *  3. 'maxreturn' – Maximum Return            → Risk-budget on momentum/CAGR with concentration cap
 *
 * All use the same covariance matrix but produce materially different allocations.
 */

// ─── ANNUALISATION ──────────────────────────────────────────────────────────
const TRADING_DAYS = 252;
const RISK_FREE_DAILY = 0.045 / TRADING_DAYS;   // ~4.5% annual T-bill rate

// ─── MAIN ENTRY ─────────────────────────────────────────────────────────────
const optimizePortfolio = async (assets, historicalDataArrays, constraints = {}, objective = 'sharpe') => {
  try {
    if (!assets || assets.length === 0) throw new Error('No assets provided');
    if (!historicalDataArrays || historicalDataArrays.length < 2) {
      throw new Error('At least 2 assets with historical data required');
    }

    // Extract close prices from whatever format the market service returns
    const priceSeries = historicalDataArrays.map(data => extractPrices(Array.isArray(data) ? data : (data?.prices || [])));

    // Need at least 20 data points per asset
    const validPairs = assets
      .map((a, i) => ({ asset: a, prices: priceSeries[i] }))
      .filter(p => p.prices.length >= 20);

    if (validPairs.length < 2) {
      throw new Error('Insufficient price history. Need at least 20 daily observations per asset.');
    }

    const validAssets = validPairs.map(p => p.asset);
    const validPrices = validPairs.map(p => p.prices);

    // Align lengths (use the minimum common length)
    const minLen = Math.min(...validPrices.map(p => p.length));
    const aligned = validPrices.map(p => p.slice(p.length - minLen));

    // Core statistics
    const returns     = calculateDailyReturns(aligned);
    const stats       = calculateAssetStatistics(returns);          // mean, stdDev, cagr, momentum
    const covariance  = calculateCovarianceMatrix(returns);
    const n           = validAssets.length;

    // ── Objective-specific optimisation ─────────────────────────────────────
    let weights;
    let objectiveLabel;
    switch (objective) {
      case 'sharpe':
        weights = optimizeSharpeRatio(stats, covariance, constraints, n);
        objectiveLabel = 'Max Risk-Adjusted Return (Sharpe)';
        break;
      case 'minvar':
        weights = optimizeMinVariance(covariance, constraints, n);
        objectiveLabel = 'Minimum Volatility';
        break;
      case 'maxreturn':
        weights = optimizeMaxReturn(stats, constraints, n);
        objectiveLabel = 'Maximum Expected Return';
        break;
      default:
        weights = createEqualWeight(n);
        objectiveLabel = 'Equal Weight (fallback)';
    }

    const constrained = applyConstraints(weights, constraints);
    const metrics     = calculatePortfolioMetrics(constrained, stats, covariance);

    // Attempt AI recommendation (non-blocking)
    let aiRecommendation = null;
    try {
      aiRecommendation = await generateStrategyRecommendation(
        { assets: validAssets, allocation: constrained },
        { objective, metrics }
      );
    } catch (_) { /* Gemini optional */ }

    return {
      allocation: validAssets.map((asset, i) => ({
        symbol: asset.symbol,
        weight: parseFloat((constrained[i] * 100).toFixed(2)),
        amount: asset.amount ? asset.amount * constrained[i] : null
      })),
      // Flat allocationMap for downstream consumers
      allocationMap: validAssets.reduce((m, a, i) => { m[a.symbol] = constrained[i]; return m; }, {}),
      metrics: {
        ...metrics,
        // expose both naming conventions for backwards compat
        sharpe: metrics.sharpeRatio,
        volatility: metrics.volatilityAnnual,
        maxDrawdown: metrics.estimatedMaxDrawdown
      },
      recommendation: aiRecommendation,
      objectiveLabel,
      objective
    };
  } catch (error) {
    logger.error('Error optimizing portfolio:', error);
    throw error;
  }
};

// ─── PRICE EXTRACTION ────────────────────────────────────────────────────────
const extractPrices = (rawData) => {
  if (!Array.isArray(rawData) || rawData.length === 0) return [];
  const first = rawData[0];
  if (typeof first === 'number') return rawData;
  // OHLCV object
  return rawData.map(d => d.close ?? d.price ?? d.c ?? 0).filter(p => p > 0);
};

// ─── RETURNS ────────────────────────────────────────────────────────────────
const calculateDailyReturns = (priceSeries) =>
  priceSeries.map(prices => {
    const r = [];
    for (let i = 1; i < prices.length; i++) {
      const ret = (prices[i] - prices[i - 1]) / prices[i - 1];
      if (isFinite(ret)) r.push(ret);
    }
    return r;
  });

// ─── ASSET STATISTICS ────────────────────────────────────────────────────────
const calculateAssetStatistics = (returns) =>
  returns.map(r => {
    const n    = r.length;
    const mean = r.reduce((a, b) => a + b, 0) / n;
    const variance = r.reduce((acc, x) => acc + (x - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);

    // Simple momentum: last 20 days vs overall mean
    const recent20 = r.slice(-20);
    const momentum = recent20.reduce((a, b) => a + b, 0) / recent20.length;

    // Annualised CAGR proxy
    const cagr = mean * TRADING_DAYS;

    return { mean, stdDev, variance, cagr, momentum };
  });

// ─── COVARIANCE ──────────────────────────────────────────────────────────────
const calculateCovarianceMatrix = (returns) => {
  const n = returns.length;
  const minLen = Math.min(...returns.map(r => r.length));
  const means = returns.map(r => r.reduce((a, b) => a + b, 0) / r.length);
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let cov = 0;
      for (let k = 0; k < minLen; k++) {
        cov += (returns[i][k] - means[i]) * (returns[j][k] - means[j]);
      }
      cov /= minLen;
      matrix[i][j] = matrix[j][i] = cov;
    }
  }
  return matrix;
};

// ═══════════════════════════════════════════════════════════════════════════
// OBJECTIVE 1: MAX SHARPE  (Monte-Carlo 15k + gradient hill-climb polish)
// ═══════════════════════════════════════════════════════════════════════════
const optimizeSharpeRatio = (stats, covariance, constraints, n) => {
  const { minAllocation = 0.02, maxAllocation = 0.60 } = constraints;

  let best  = { sharpe: -Infinity, weights: createEqualWeight(n) };

  // Phase 1: Random search
  for (let i = 0; i < 15000; i++) {
    const w = generateDirichletWeights(n, minAllocation, maxAllocation);
    const s = calcSharpe(w, stats, covariance);
    if (isFinite(s) && s > best.sharpe) best = { sharpe: s, weights: w };
  }

  // Phase 2: Hill-climb from best found
  for (let iter = 0; iter < 500; iter++) {
    let improved = false;
    for (let i = 0; i < n; i++) {
      for (const delta of [0.02, -0.02, 0.01, -0.01]) {
        const w = [...best.weights];
        w[i] = Math.min(maxAllocation, Math.max(minAllocation, w[i] + delta));
        // Re-distribute from a random other asset
        const j = (i + 1) % n;
        w[j] = Math.max(minAllocation, w[j] - delta);
        const norm = normalizeWeights(w);
        const s = calcSharpe(norm, stats, covariance);
        if (isFinite(s) && s > best.sharpe + 1e-6) {
          best = { sharpe: s, weights: norm };
          improved = true;
        }
      }
    }
    if (!improved) break;
  }

  return best.weights;
};

// ═══════════════════════════════════════════════════════════════════════════
// OBJECTIVE 2: MINIMUM VARIANCE (Closed-form analytical solution)
// Uses the standard MPT formula: w* ∝ Σ⁻¹ · 1
// ═══════════════════════════════════════════════════════════════════════════
const optimizeMinVariance = (covariance, constraints, n) => {
  const { minAllocation = 0.02, maxAllocation = 0.60 } = constraints;

  // Invert the covariance matrix via Gaussian elimination
  const invCov = invertMatrix(covariance);

  if (!invCov) {
    // Fallback: use reciprocal of variance (diagonal only)
    const variances = covariance.map((row, i) => row[i]);
    const invVar = variances.map(v => v > 0 ? 1 / v : 0);
    return applyMinMaxConstraints(normalizeWeights(invVar), minAllocation, maxAllocation);
  }

  // w* ∝ Σ⁻¹ · 1 (ones vector)
  const ones = Array(n).fill(1);
  const raw  = invCov.map(row => row.reduce((s, v, j) => s + v * ones[j], 0));

  // Clip negatives to minAllocation
  const clipped = raw.map(v => Math.max(0, v));
  return applyMinMaxConstraints(normalizeWeights(clipped), minAllocation, maxAllocation);
};

// ═══════════════════════════════════════════════════════════════════════════
// OBJECTIVE 3: MAXIMUM RETURN (Risk-budgeted momentum tilt)
// Allocates proportionally to positive CAGR with 20-day momentum boost,
// respects concentration cap, min 2 assets must hold positive weight
// ═══════════════════════════════════════════════════════════════════════════
const optimizeMaxReturn = (stats, constraints, n) => {
  const { minAllocation = 0.05, maxAllocation = 0.60 } = constraints;

  // Score = 70% annualised return + 30% recent momentum
  const scores = stats.map(s => {
    const retScore  = s.cagr;
    const momScore  = s.momentum * TRADING_DAYS;       // annualise momentum
    return 0.70 * retScore + 0.30 * momScore;
  });

  // Shift to positive if any negatives exist
  const minScore = Math.min(...scores);
  const shifted  = minScore < 0 ? scores.map(s => s - minScore + 0.001) : scores.map(s => s + 0.001);

  // Apply convex power to sharpen concentration (power = 1.5 gives meaningful tilt)
  const powered  = shifted.map(s => Math.pow(s, 1.5));

  return applyMinMaxConstraints(normalizeWeights(powered), minAllocation, maxAllocation);
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const calcSharpe = (weights, stats, covariance) => {
  const ret  = weights.reduce((s, w, i) => s + w * stats[i].mean, 0);
  const vol  = Math.sqrt(
    weights.reduce((s, wi, i) =>
      s + weights.reduce((ss, wj, j) => ss + wi * wj * covariance[i][j], 0), 0)
  );
  if (vol <= 0 || !isFinite(vol)) return 0;
  return (ret - RISK_FREE_DAILY) / vol;
};

/** Dirichlet-inspired random weights respecting bounds */
const generateDirichletWeights = (n, minW = 0, maxW = 1) => {
  const raw = Array.from({ length: n }, () => Math.random() + 0.01);
  const sum = raw.reduce((a, b) => a + b, 0);
  const w   = raw.map(v => v / sum);
  return applyMinMaxConstraints(w, minW, maxW);
};

const applyMinMaxConstraints = (weights, minW, maxW) => {
  let w = weights.map(v => Math.max(minW, Math.min(maxW, v)));
  return normalizeWeights(w);
};

const normalizeWeights = (w) => {
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum === 0) return w.map(() => 1 / w.length);
  return w.map(v => v / sum);
};

const createEqualWeight = (n) => Array(n).fill(1 / n);

/** Apply user-facing min/max allocation constraints (from UI/config) */
const applyConstraints = (weights, constraints) => {
  const { minAllocation = 0.02, maxAllocation = 0.60,
          minWeight = 0,         maxWeight = 1 } = constraints;
  const lo = Math.max(minAllocation, minWeight);
  const hi = Math.min(maxAllocation, maxWeight);
  return applyMinMaxConstraints(weights, lo, hi);
};

// ─── PORTFOLIO METRICS ───────────────────────────────────────────────────────
const calculatePortfolioMetrics = (weights, stats, covariance) => {
  const dailyReturn = weights.reduce((s, w, i) => s + w * stats[i].mean, 0);
  const dailyVol    = Math.sqrt(
    weights.reduce((s, wi, i) =>
      s + weights.reduce((ss, wj, j) => ss + wi * wj * covariance[i][j], 0), 0)
  );

  const annualReturn = dailyReturn  * TRADING_DAYS;
  const annualVol    = dailyVol     * Math.sqrt(TRADING_DAYS);
  const annualRfr    = RISK_FREE_DAILY * TRADING_DAYS;

  const sharpeRatio = annualVol > 0
    ? (annualReturn - annualRfr) / annualVol
    : 0;

  // Sortino (penalise downside only)
  const downside = stats.map(s => Math.min(s.mean, 0));
  const downsideVol = Math.sqrt(
    weights.reduce((s, wi, i) =>
      s + weights.reduce((ss, wj, j) => ss + wi * wj * Math.min(downside[i], 0) * Math.min(downside[j], 0), 0), 0)
  ) * Math.sqrt(TRADING_DAYS);

  const sortinoRatio = downsideVol > 0
    ? (annualReturn - annualRfr) / downsideVol
    : sharpeRatio;

  // Rough Max Drawdown estimate: 2× monthly volatility
  const estimatedMaxDrawdown = -(annualVol / Math.sqrt(12)) * 2 * 100;

  return {
    expectedReturn:       parseFloat((dailyReturn  * 100).toFixed(4)),
    expectedReturnAnnual: parseFloat((annualReturn * 100).toFixed(2)),
    volatility:           parseFloat((dailyVol     * 100).toFixed(4)),
    volatilityAnnual:     parseFloat((annualVol    * 100).toFixed(2)),
    sharpeRatio:          parseFloat(sharpeRatio.toFixed(3)),
    sortinoRatio:         parseFloat(sortinoRatio.toFixed(3)),
    estimatedMaxDrawdown: parseFloat(estimatedMaxDrawdown.toFixed(2)),
    diversificationScore: calcDiversificationScore(weights, covariance)
  };
};

const calcDiversificationScore = (weights, covariance) => {
  // Diversification ratio: weighted-avg individual vol / portfolio vol
  const indVols = covariance.map((row, i) => Math.sqrt(Math.max(0, row[i])));
  const weightedAvgVol = weights.reduce((s, w, i) => s + w * indVols[i], 0);
  const portVol = Math.sqrt(
    weights.reduce((s, wi, i) =>
      s + weights.reduce((ss, wj, j) => ss + wi * wj * covariance[i][j], 0), 0)
  );
  return portVol > 0 ? parseFloat((weightedAvgVol / portVol).toFixed(3)) : 1;
};

// ─── MATRIX INVERSION (Gauss-Jordan) ─────────────────────────────────────────
const invertMatrix = (M) => {
  const n = M.length;
  // Augmented [M | I]
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
    }
    [A[col], A[maxRow]] = [A[maxRow], A[col]];

    if (Math.abs(A[col][col]) < 1e-12) return null; // singular

    const pivot = A[col][col];
    for (let j = col; j < 2 * n; j++) A[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = A[row][col];
        for (let j = col; j < 2 * n; j++) A[row][j] -= factor * A[col][j];
      }
    }
  }
  return A.map(row => row.slice(n));
};

// ─── CORRELATION MATRIX ───────────────────────────────────────────────────────
const calculateCorrelationMatrix = (covariance, stats) => {
  const n = covariance.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      const d = stats[i].stdDev * stats[j].stdDev;
      return d > 0 ? covariance[i][j] / d : 0;
    })
  );
};

module.exports = {
  optimizePortfolio,
  calculateDailyReturns,
  calculateAssetStatistics,
  calculateCovarianceMatrix,
  calculatePortfolioMetrics,
  calcSharpe,
  generateDirichletWeights,
  createEqualWeight,
  normalizeWeights,
  applyConstraints,
  calculateCorrelationMatrix,
  invertMatrix,
  // Legacy export names
  calculateAssetReturns: calculateDailyReturns,
  calculateSharpeRatio: calcSharpe,
  calculatePortfolioReturn: (w, stats) => w.reduce((s, v, i) => s + v * stats[i].mean, 0),
  calculatePortfolioVolatility: (w, cov) => Math.sqrt(
    w.reduce((s, wi, i) => s + w.reduce((ss, wj, j) => ss + wi * wj * cov[i][j], 0), 0)
  ),
  generateRandomWeights: generateDirichletWeights,
};
