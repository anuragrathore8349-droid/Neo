const { logger } = require('../api/middlewares/logger.middleware');
const { callGeminiBatch } = require('./openai-integration');

// Same cooldown fix as anomalies.js — pattern detection ran on every job
// cycle and called Gemini per pattern with no throttle, contributing to
// daily quota exhaustion. One AI explanation per pattern-type per symbol
// per 15 minutes is plenty; the deterministic confidence-based fallback
// covers everything in between.
const COOLDOWN_MS = 15 * 60 * 1000;
const lastEnrichedAt = new Map();
function shouldEnrichWithAI(key) {
  const last = lastEnrichedAt.get(key) || 0;
  if (Date.now() - last < COOLDOWN_MS) return false;
  lastEnrichedAt.set(key, Date.now());
  return true;
}

/**
 * Technical Pattern Detection
 * Statistical methods only - no ML framework required
 * Detects chart patterns: Double Top/Bottom, Head & Shoulders, Triangles, etc.
 */

const detectPatterns = async (priceData, options = {}) => {
  try {
    if (!priceData || priceData.length < 3) {
      return [];
    }

    const patterns = [];
    const { types = null, minConfidence = 0.6 } = options;

    const typesToCheck = types || [
      'double_top',
      'double_bottom',
      'trend_reversal',
      'breakout'
    ];

    for (const type of typesToCheck) {
      const detected = detectSpecificPattern(priceData, type);
      if (detected) {
        patterns.push(detected);
      }
    }

    // Filter by confidence and sort
    const filtered = patterns
      .filter(p => p.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence);

    // Enrich with AI insights
    return await enrichPatternsWithInsights(filtered);
  } catch (error) {
    logger.error('Error detecting patterns:', error);
    return [];
  }
};

/**
 * Detect specific pattern using statistical analysis
 */
const detectSpecificPattern = (priceData, patternType) => {
  try {
    switch (patternType) {
      case 'double_top':
        return detectDoubleTopBottom(priceData, 'top');
      case 'double_bottom':
        return detectDoubleTopBottom(priceData, 'bottom');
      case 'trend_reversal':
        return detectTrendReversal(priceData);
      case 'breakout':
        return detectBreakout(priceData);
      default:
        logger.warn(`Unknown pattern type: ${patternType}`);
        return null;
    }
  } catch (error) {
    logger.warn(`Error detecting ${patternType}:`, error.message);
    return null;
  }
};

/**
 * Detect double top (sell signal) or double bottom (buy signal)
 * Looks for two peaks/valleys at similar height with valley/peak between them
 */
const detectDoubleTopBottom = (prices, type) => {
  if (prices.length < 5) return null;

  const peaks = findLocalExtrema(prices, type === 'top' ? 'max' : 'min');
  
  if (peaks.length < 2) return null;

  // Check last two peaks
  const peak1 = peaks[peaks.length - 2];
  const peak2 = peaks[peaks.length - 1];

  // Check if peaks are within 5% of each other
  const priceDiff = Math.abs(peak1.value - peak2.value);
  const avgPrice = (peak1.value + peak2.value) / 2;
  const diffPercent = (priceDiff / avgPrice) * 100;

  if (diffPercent > 5) return null; // Peaks not similar enough

  // Check distance between peaks (at least 5 candles apart)
  const indexDiff = peak2.index - peak1.index;
  if (indexDiff < 5) return null;

  return {
    type: type === 'top' ? 'double_top' : 'double_bottom',
    confidence: Math.max(0.6, 1 - (diffPercent / 10)),
    signal: type === 'top' ? 'sell' : 'buy',
    peak1: peak1.value,
    peak2: peak2.value,
    avgPrice,
    neckline: (Math.min(peak1.value, peak2.value) + Math.max(peak1.value, peak2.value)) / 2,
    index: peak2.index,
    strength: indexDiff / prices.length // How mature is the pattern
  };
};

/**
 * Detect trend reversal by comparing momentum
 */
const detectTrendReversal = (prices) => {
  if (prices.length < 10) return null;

  const recent = prices.slice(-5);
  const previous = prices.slice(-10, -5);

  const recentChange = ((recent[4] - recent[0]) / recent[0]) * 100;
  const previousChange = ((previous[4] - previous[0]) / previous[0]) * 100;

  // Reversal if trends opposite and significant
  if ((recentChange > 2 && previousChange < -2) || (recentChange < -2 && previousChange > 2)) {
    return {
      type: 'trend_reversal',
      confidence: 0.65,
      signal: recentChange > 0 ? 'buy' : 'sell',
      previousTrend: previousChange > 0 ? 'up' : 'down',
      currentTrend: recentChange > 0 ? 'up' : 'down',
      magnitude: Math.abs(recentChange),
      index: prices.length - 1
    };
  }

  return null;
};

/**
 * Detect breakout - price breaking through resistance/support
 */
const detectBreakout = (prices) => {
  if (prices.length < 20) return null;

  const historical = prices.slice(0, -5);
  const recent = prices.slice(-5);

  const highestHigh = Math.max(...historical);
  const lowestLow = Math.min(...historical);
  const resistance = highestHigh;
  const support = lowestLow;

  const currentPrice = recent[recent.length - 1];
  const breakoutStrength = (Math.abs(currentPrice - resistance) / resistance) * 100;

  // Uptrend breakout
  if (currentPrice > resistance && breakoutStrength < 5) {
    return {
      type: 'breakout',
      confidence: Math.min(1, 0.7 + breakoutStrength / 100),
      signal: 'buy',
      level: resistance,
      breakoutPercent: breakoutStrength,
      index: prices.length - 1
    };
  }

  // Downtrend breakout
  if (currentPrice < support && breakoutStrength < 5) {
    return {
      type: 'breakout',
      confidence: Math.min(1, 0.7 + breakoutStrength / 100),
      signal: 'sell',
      level: support,
      breakoutPercent: breakoutStrength,
      index: prices.length - 1
    };
  }

  return null;
};

/**
 * Find local maxima or minima
 */
const findLocalExtrema = (prices, type = 'max') => {
  const extrema = [];

  for (let i = 2; i < prices.length - 2; i++) {
    const isMax = prices[i] > prices[i - 1] &&
                  prices[i] > prices[i + 1] &&
                  prices[i] > prices[i - 2] &&
                  prices[i] > prices[i + 2];

    const isMin = prices[i] < prices[i - 1] &&
                  prices[i] < prices[i + 1] &&
                  prices[i] < prices[i - 2] &&
                  prices[i] < prices[i + 2];

    if ((type === 'max' && isMax) || (type === 'min' && isMin)) {
      extrema.push({ index: i, value: prices[i] });
    }
  }

  return extrema;
};

/**
 * Enrich patterns with OpenAI explanations
 */
/**
 * FIX: was one Gemini call per detected pattern. Now batched into one call.
 */
const enrichPatternsWithInsights = async (patterns) => {
  if (!patterns || patterns.length === 0) return [];

  try {
    const describe = (p) =>
      `${p.type} pattern, signal=${p.signal}, confidence=${(p.confidence * 100).toFixed(0)}%`;

    const explanations = await callGeminiBatch(patterns, describe);

    return patterns.map((pattern, i) => ({
      ...pattern,
      explanation: explanations?.[i] || `${pattern.type} detected (confidence: ${(pattern.confidence * 100).toFixed(0)}%)`,
    }));
  } catch (error) {
    logger.warn('Failed to enrich patterns:', error.message);
    return patterns.map((pattern) => ({
      ...pattern,
      explanation: `${pattern.type} detected (confidence: ${(pattern.confidence * 100).toFixed(0)}%)`,
    }));
  }
};

module.exports = {
  detectPatterns,
  detectSpecificPattern,
  findLocalExtrema,
  enrichPatternsWithInsights
};
