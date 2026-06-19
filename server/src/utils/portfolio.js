const { logger } = require('../api/middlewares/logger.middleware');
const { generateStrategyRecommendation } = require('./openai-integration');

/**
 * Portfolio Optimization & Management
 * Modern Portfolio Theory implementation without ML frameworks
 * Statistical methods only - works with Node 20+
 */

/**
 * Optimize portfolio allocation based on objective
 * Uses Modern Portfolio Theory: Markowitz optimization
 */
const optimizePortfolio = async (assets, historicalData, constraints = {}, objective = 'sharpe') => {
  try {
    if (!assets || assets.length === 0) {
      throw new Error('No assets provided');
    }

    // Calculate returns and statistics
    const returns = calculateAssetReturns(historicalData);
    const stats = calculateAssetStatistics(returns);
    const covariance = calculateCovarianceMatrix(returns);

    // Optimize based on objective
    let allocation;
    switch (objective) {
      case 'sharpe':
        allocation = optimizeSharpeRatio(stats, covariance, constraints, assets.length);
        break;
      case 'minvar':
        allocation = optimizeMinVariance(stats, covariance, constraints, assets.length);
        break;
      case 'maxreturn':
        allocation = optimizeMaxReturn(stats, constraints, assets.length);
        break;
      default:
        allocation = createEqualWeight(assets.length);
    }

    // Constrain to min/max limits
    const constrained = applyConstraints(allocation, constraints);

    // Calculate portfolio metrics
    const metrics = calculatePortfolioMetrics(constrained, stats, covariance);

    // Get AI recommendation
    const aiRecommendation = await generateStrategyRecommendation(
      { assets, allocation: constrained },
      { objective, metrics }
    );

    return {
      allocation: assets.map((asset, i) => ({
        symbol: asset.symbol,
        weight: parseFloat((constrained[i] * 100).toFixed(2)),
        amount: asset.amount ? asset.amount * constrained[i] : null
      })),
      metrics,
      recommendation: aiRecommendation,
      objective
    };
  } catch (error) {
    logger.error('Error optimizing portfolio:', error);
    throw error;
  }
};

/**
 * Calculate individual returns for each asset
 */
const calculateAssetReturns = (historicalData) => {
  return historicalData.map(prices => {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      const ret = (prices[i] - prices[i - 1]) / prices[i - 1];
      if (isFinite(ret)) {
        returns.push(ret);
      }
    }
    return returns;
  });
};

/**
 * Calculate mean return and volatility for each asset
 */
const calculateAssetStatistics = (returns) => {
  return returns.map(assetReturns => {
    const mean = assetReturns.reduce((a, b) => a + b, 0) / assetReturns.length;
    const variance = assetReturns
      .reduce((acc, ret) => acc + Math.pow(ret - mean, 2), 0) / assetReturns.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      stdDev,
      variance
    };
  });
};

/**
 * Calculate covariance matrix between assets
 */
const calculateCovarianceMatrix = (returns) => {
  const n = returns.length;
  const minLength = Math.min(...returns.map(r => r.length));
  
  const matrix = Array(n).fill(0).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      // Calculate covariance
      let cov = 0;
      const mean1 = returns[i].reduce((a, b) => a + b, 0) / returns[i].length;
      const mean2 = returns[j].reduce((a, b) => a + b, 0) / returns[j].length;

      for (let k = 0; k < minLength; k++) {
        cov += (returns[i][k] - mean1) * (returns[j][k] - mean2);
      }
      cov /= minLength;

      matrix[i][j] = cov;
      matrix[j][i] = cov;
    }
  }

  return matrix;
};

/**
 * Optimize for Sharpe Ratio (best risk-adjusted returns)
 * Simplified approach: efficient frontier via random portfolios
 */
const optimizeSharpeRatio = (stats, covariance, constraints, numAssets, riskFree = 0.02) => {
  const iterations = 10000;
  let bestSharpe = -Infinity;
  let bestWeights = createEqualWeight(numAssets);

  for (let i = 0; i < iterations; i++) {
    const weights = generateRandomWeights(numAssets);
    const sharpe = calculateSharpeRatio(weights, stats, covariance, riskFree);

    if (sharpe > bestSharpe) {
      bestSharpe = sharpe;
      bestWeights = weights;
    }
  }

  return bestWeights;
};

/**
 * Optimize for minimum variance
 */
const optimizeMinVariance = (stats, covariance, constraints, numAssets) => {
  const iterations = 5000;
  let bestVariance = Infinity;
  let bestWeights = createEqualWeight(numAssets);

  for (let i = 0; i < iterations; i++) {
    const weights = generateRandomWeights(numAssets);
    const variance = calculatePortfolioVariance(weights, covariance);

    if (variance < bestVariance) {
      bestVariance = variance;
      bestWeights = weights;
    }
  }

  return bestWeights;
};

/**
 * Optimize for maximum return
 */
const optimizeMaxReturn = (stats, constraints, numAssets) => {
  // Simple: weight more to highest return assets
  const means = stats.map(s => s.mean);
  const maxMeanIndex = means.indexOf(Math.max(...means));
  
  const weights = createEqualWeight(numAssets);
  weights[maxMeanIndex] += 0.3; // Increase allocation to best performer
  
  return normalizeWeights(weights);
};

/**
 * Calculate Sharpe Ratio: (return - riskFree) / volatility
 */
const calculateSharpeRatio = (weights, stats, covariance, riskFree = 0.02) => {
  const ret = calculatePortfolioReturn(weights, stats);
  const vol = calculatePortfolioVolatility(weights, covariance);
  
  if (vol === 0) return 0;
  return (ret - riskFree) / vol;
};

/**
 * Calculate portfolio expected return
 */
const calculatePortfolioReturn = (weights, stats) => {
  return weights.reduce((sum, w, i) => sum + w * stats[i].mean, 0);
};

/**
 * Calculate portfolio volatility (standard deviation)
 */
const calculatePortfolioVolatility = (weights, covariance) => {
  const variance = calculatePortfolioVariance(weights, covariance);
  return Math.sqrt(variance);
};

/**
 * Calculate portfolio variance
 */
const calculatePortfolioVariance = (weights, covariance) => {
  let variance = 0;
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) {
      variance += weights[i] * weights[j] * covariance[i][j];
    }
  }
  return variance;
};

/**
 * Calculate comprehensive portfolio metrics
 */
const calculatePortfolioMetrics = (weights, stats, covariance) => {
  const expectedReturn = calculatePortfolioReturn(weights, stats);
  const volatility = calculatePortfolioVolatility(weights, covariance);
  const sharpe = expectedReturn / (volatility || 1);

  return {
    expectedReturn: parseFloat((expectedReturn * 100).toFixed(2)),
    volatility: parseFloat((volatility * 100).toFixed(2)),
    sharpeRatio: parseFloat(sharpe.toFixed(2)),
    expectedReturnAnnual: parseFloat((expectedReturn * 252 * 100).toFixed(2)), // Trading days
    volatilityAnnual: parseFloat((volatility * Math.sqrt(252) * 100).toFixed(2))
  };
};

/**
 * Generate random portfolio weights that sum to 1
 */
const generateRandomWeights = (n) => {
  const weights = Array(n).fill(0).map(() => Math.random());
  return normalizeWeights(weights);
};

/**
 * Create equal-weight portfolio
 */
const createEqualWeight = (n) => {
  return Array(n).fill(1 / n);
};

/**
 * Normalize weights to sum to 1
 */
const normalizeWeights = (weights) => {
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map(w => w / sum);
};

/**
 * Apply min/max constraints to weights
 */
const applyConstraints = (weights, constraints) => {
  const { minWeight = 0, maxWeight = 1 } = constraints;
  
  let adjusted = weights.map(w => {
    if (w < minWeight) return minWeight;
    if (w > maxWeight) return maxWeight;
    return w;
  });

  // Re-normalize
  return normalizeWeights(adjusted);
};

/**
 * Calculate correlation matrix from covariance
 */
const calculateCorrelationMatrix = (covariance, stats) => {
  const n = covariance.length;
  const correlation = Array(n).fill(0).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const denominator = stats[i].stdDev * stats[j].stdDev;
      correlation[i][j] = denominator > 0 ? covariance[i][j] / denominator : 0;
    }
  }

  return correlation;
};

module.exports = {
  optimizePortfolio,
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
  calculateCorrelationMatrix
};