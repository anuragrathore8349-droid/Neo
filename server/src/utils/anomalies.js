const { logger } = require('../api/middlewares/logger.middleware');
const { getOpenAIInsights, getBasicExplanation } = require('./openai-integration');

/**
 * Detects statistical anomalies in financial data using z-score method
 * Modern, lightweight implementation with no ML framework dependencies
 * Fully Node 20+ compatible, no native build dependencies
 */

/**
 * Configuration for anomaly detection
 * Can be customized per use case
 */
const DEFAULT_CONFIG = {
  threshold: 3, // Z-score threshold (3 = 99.7% confidence)
  minDataPoints: 10, // Minimum data points required
  enrichWithAI: true, // Attempt to enrich with OpenAI
  enableLogging: true
};

/**
 * Main anomaly detection function
 * @param {Array} data - Array of {symbol, values: [numbers]}
 * @param {Number} threshold - Z-score threshold for anomaly detection
 * @param {Object} options - Additional options {enrichWithAI, maxResults, etc}
 * @returns {Promise<Array>} Enriched anomalies sorted by severity
 */
const detectAnomalies = async (data, threshold = 3, options = {}) => {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      logger.warn('No data provided for anomaly detection');
      return [];
    }

    const config = { ...DEFAULT_CONFIG, ...options, threshold };
    const anomalies = [];

    // Detect anomalies for each symbol
    for (const item of data) {
      if (!item.symbol || !item.values || !Array.isArray(item.values)) {
        logger.warn(`Skipping invalid item - missing symbol or values: ${JSON.stringify(item)}`);
        continue;
      }

      const itemAnomalies = detectStatisticalAnomalies(
        item.symbol,
        item.values,
        threshold,
        config
      );

      if (itemAnomalies.length > 0) {
        anomalies.push(...itemAnomalies);
      }
    }

    // Sort by severity (highest first)
    const sorted = anomalies.sort((a, b) => b.severity - a.severity);
    
    // Limit results
    const maxResults = options.maxResults || 10;
    const limited = sorted.slice(0, maxResults);

    // Enrich with AI insights if enabled
    let enriched = limited;
    if (config.enrichWithAI && limited.length > 0) {
      enriched = await enrichAnomaliesWithInsights(limited);
    }
    
    if (config.enableLogging) {
      logger.info(`Anomaly detection complete: found ${anomalies.length} anomalies, enriched ${enriched.length}`);
    }
    
    return enriched;
  } catch (error) {
    logger.error('Error detecting anomalies:', error);
    return [];
  }
};

/**
 * Core statistical anomaly detection using z-score method
 * Handles edge cases: empty data, zero stdDev, invalid numbers
 * 
 * @param {String} symbol - Asset symbol/identifier
 * @param {Array<Number>} values - Price or metric values
 * @param {Number} threshold - Z-score threshold
 * @param {Object} config - Configuration object
 * @returns {Array} Array of detected anomalies
 */
const detectStatisticalAnomalies = (symbol, values, threshold = 3, config = DEFAULT_CONFIG) => {
  try {
    // Validate input
    if (!values || values.length === 0) {
      return [];
    }

    // Check minimum data points requirement
    if (values.length < (config.minDataPoints || 10)) {
      logger.debug(`Insufficient data for ${symbol} (${values.length} < ${config.minDataPoints})`);
      return [];
    }

    const anomalies = [];
    
    // Calculate statistics from the dataset
    const stats = calculateStatistics(values);
    
    // If stdDev is 0 (all values identical), no anomalies possible
    if (stats.stdDev === 0) {
      logger.debug(`No variance detected for ${symbol} - all values identical`);
      return [];
    }

    // Check each value for anomalies
    values.forEach((value, index) => {
      // Skip invalid values
      if (typeof value !== 'number' || isNaN(value)) {
        return;
      }

      const zScore = calculateZScore(value, stats.mean, stats.stdDev);
      
      // Anomaly if z-score exceeds threshold
      // Default threshold 3 = 99.7% confidence level
      if (Math.abs(zScore) > Math.abs(threshold)) {
        anomalies.push({
          symbol,
          value: parseFloat(value.toFixed(4)),
          zScore: parseFloat(zScore.toFixed(2)),
          mean: stats.mean,
          stdDev: stats.stdDev,
          severity: calculateSeverity(zScore),
          timestamp: new Date().toISOString(),
          dataPointIndex: index,
          percentileDeviation: parseFloat(((Math.abs(zScore) / threshold) * 100).toFixed(1)),
          type: zScore > 0 ? 'spike' : 'dip',
          confidenceLevel: getConfidenceLevel(Math.abs(zScore))
        });
      }
    });

    return anomalies;
  } catch (error) {
    logger.error(`Error detecting anomalies for ${symbol}:`, error);
    return [];
  }
};

/**
 * Calculate mean, standard deviation, min, max from numeric values
 * Robust handling of edge cases (empty, NaN, non-numeric)
 */
const calculateStatistics = (values) => {
  if (!values || values.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0, count: 0 };
  }

  // Filter out non-numeric and NaN values
  const numericValues = values
    .filter(v => typeof v === 'number' && isFinite(v));
  
  if (numericValues.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0, count: 0 };
  }

  const mean = numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
  
  // Calculate variance and standard deviation
  const squaredDiffs = numericValues.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numericValues.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean: parseFloat(mean.toFixed(4)),
    stdDev: parseFloat(stdDev.toFixed(4)),
    min: Math.min(...numericValues),
    max: Math.max(...numericValues),
    count: numericValues.length
  };
};

/**
 * Calculate z-score: how many standard deviations from mean
 * Safe division with 0 check
 * 
 * Formula: z = (x - mean) / stdDev
 */
const calculateZScore = (value, mean, stdDev) => {
  if (stdDev === 0 || !isFinite(stdDev)) {
    return 0; // No anomaly if no variance
  }
  return (value - mean) / stdDev;
};

/**
 * Calculate severity score (0-1 scale)
 * Maps z-score magnitude to severity
 * - 3σ = 0.3 (moderate)
 * - 6σ = 0.6 (high)
 * - 10σ = 1.0 (critical)
 */
const calculateSeverity = (zScore) => {
  const absZ = Math.abs(zScore);
  return Math.min(1, absZ / 10);
};

/**
 * Get confidence level based on z-score
 * Returns human-readable confidence description
 */
const getConfidenceLevel = (absZScore) => {
  if (absZScore >= 4) return '99.99%';
  if (absZScore >= 3) return '99.7%';
  if (absZScore >= 2.5) return '98.8%';
  if (absZScore >= 2) return '95.4%';
  return 'Low';
};

/**
 * Enrich anomalies with OpenAI insights
 * Explains why anomalies occurred in financial context
 * Graceful fallback if OpenAI unavailable
 */
const enrichAnomaliesWithInsights = async (anomalies) => {
  if (!anomalies || anomalies.length === 0) {
    return [];
  }

  try {
    const enriched = await Promise.all(
      anomalies.map(async (anomaly) => {
        try {
          // Attempt to get AI insights
          const insight = await getOpenAIInsights({
            symbol: anomaly.symbol,
            value: anomaly.value,
            mean: anomaly.mean,
            stdDev: anomaly.stdDev,
            zScore: anomaly.zScore,
            type: anomaly.type,
            severity: anomaly.severity
          });

          return {
            ...anomaly,
            explanation: insight,
            enriched: true,
            enrichmentMethod: 'openai'
          };
        } catch (error) {
          // Fallback to basic explanation
          logger.debug(`OpenAI enrichment failed for ${anomaly.symbol}, using fallback`);
          return {
            ...anomaly,
            explanation: getBasicExplanation(anomaly),
            enriched: false,
            enrichmentMethod: 'fallback',
            enrichmentError: error.message
          };
        }
      })
    );

    return enriched;
  } catch (error) {
    logger.error('Error enriching anomalies:', error);
    // Return unencriched anomalies rather than failing completely
    return anomalies.map(a => ({
      ...a,
      enriched: false,
      enrichmentMethod: 'none'
    }));
  }
};

/**
 * Batch anomaly detection for multiple symbols with aggregated results
 * Useful for portfolio-wide anomaly monitoring
 * 
 * @param {Array} dataArray - Array of {symbol, values} objects
 * @param {Object} options - {threshold, minAnomalies, maxResults}
 * @returns {Promise<Object>} Aggregated anomaly report
 */
const detectAnomaliesBatch = async (dataArray, options = {}) => {
  try {
    const {
      threshold = 3,
      minSeverity = 0,
      maxResults = 10,
      enableAIEnrichment = true
    } = options;

    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      return {
        total: 0,
        critical: 0,
        anomalies: [],
        summary: {
          highestSeverity: 0,
          avgSeverity: 0,
          detectionMethod: 'statistical_zscore'
        }
      };
    }

    const allAnomalies = [];

    // Detect anomalies for all symbols
    for (const data of dataArray) {
      if (!data.symbol || !data.values) continue;
      
      const anomalies = detectStatisticalAnomalies(
        data.symbol,
        data.values,
        threshold
      );
      allAnomalies.push(...anomalies);
    }

    // Filter and sort by severity
    const filtered = allAnomalies
      .filter(a => a.severity >= minSeverity)
      .sort((a, b) => b.severity - a.severity)
      .slice(0, maxResults);

    // Enrich with insights if enabled
    const enriched = enableAIEnrichment 
      ? await enrichAnomaliesWithInsights(filtered)
      : filtered.map(a => ({ ...a, enriched: false }));

    // Calculate summary statistics
    const severities = enriched.map(a => a.severity);
    const avgSeverity = severities.length > 0
      ? severities.reduce((s, a) => s + a, 0) / severities.length
      : 0;

    return {
      total: allAnomalies.length,
      filtered: enriched.length,
      anomalies: enriched,
      summary: {
        highestSeverity: Math.max(...severities, 0),
        avgSeverity: parseFloat(avgSeverity.toFixed(3)),
        threshold,
        detectionMethod: 'statistical_zscore',
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    logger.error('Error in batch anomaly detection:', error);
    throw error;
  }
};

module.exports = {
  detectAnomalies,
  detectStatisticalAnomalies,
  detectAnomaliesBatch,
  calculateStatistics,
  calculateZScore,
  calculateSeverity,
  getConfidenceLevel,
  enrichAnomaliesWithInsights,
  DEFAULT_CONFIG
};