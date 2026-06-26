const { logger } = require('../api/middlewares/logger.middleware');

/**
 * Price predictions using modern statistical methods
 * No ML framework dependencies - Node 20+ compatible
 * Methods: Exponential Moving Average, Momentum, Bollinger Bands
 */

/**
 * Predict prices using ensemble of statistical methods
 * Lightweight alternative to LSTM neural networks
 * 
 * @param {Array} historicalData - Array with {close, high, low, volume, timestamp}
 * @param {Number} horizon - Days ahead to predict (default: 7)
 * @returns {Object} Predictions with confidence intervals
 */
const predictPrices = async (historicalData, horizon = 7) => {
  try {
    if (!Array.isArray(historicalData) || historicalData.length < 30) {
      logger.warn('Insufficient historical data for predictions (need at least 30 data points)');
      return {
        predictions: [],
        confidence: 0,
        methodology: 'statistical',
        timestamp: new Date(),
        error: 'Insufficient data'
      };
    }

    // Sort data by timestamp (oldest first)
    const sortedData = [...historicalData].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    // Extract close prices
    const closePrices = sortedData.map(d => parseFloat(d.close) || 0).filter(p => p > 0);

    if (closePrices.length < 20) {
      return {
        predictions: [],
        confidence: 0,
        methodology: 'statistical',
        timestamp: new Date(),
        error: 'Insufficient valid price data'
      };
    }

    // Calculate trend indicators
    const ema20 = calculateEMA(closePrices, 20);
    const ema50 = calculateEMA(closePrices, 50);
    const momentum = calculateMomentum(closePrices);
    const volatility = calculateVolatility(closePrices);
    const rsi = calculateRSI(closePrices);

    // Generate predictions for each day in horizon
    const predictions = [];
    let currentPrice = closePrices[closePrices.length - 1];
    const trend = ema20 > ema50 ? 1 : -1; // 1 = uptrend, -1 = downtrend

    for (let i = 1; i <= horizon; i++) {
      // Apply trend + momentum + mean reversion
      const trendComponent = trend * (volatility * 0.02); // 2% daily movement
      const momentumComponent = momentum * 0.001; // Scale momentum
      const meansReversionComponent = (ema50 - currentPrice) / currentPrice * 0.01; // Small mean reversion

      // Ensemble prediction
      const dailyChange = trendComponent + momentumComponent + meansReversionComponent;
      const nextPrice = currentPrice * (1 + dailyChange);

      // Calculate confidence based on RSI (0-1, peaks at neutral 50)
      const rsiConfidence = 1 - Math.abs(rsi - 50) / 50; // Normalize 0-1

      predictions.push({
        timestamp: new Date(Date.now() + i * 86400000).toISOString(),
        price: parseFloat(nextPrice.toFixed(2)),
        confidence: parseFloat((rsiConfidence * 85).toFixed(1)), // Max 85% confidence
        lower: parseFloat((nextPrice * (1 - volatility)).toFixed(2)),
        upper: parseFloat((nextPrice * (1 + volatility)).toFixed(2)),
        trend: trend > 0 ? 'bullish' : 'bearish',
        rsi: parseFloat(rsi.toFixed(2))
      });

      currentPrice = nextPrice;
    }

    // Overall confidence: average of individual predictions
    const avgConfidence = predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length
      : 0;

    return {
      predictions,
      confidence: parseFloat(avgConfidence.toFixed(1)),
      methodology: 'statistical_ensemble', // EMA + Momentum + RSI + Volatility
      timestamp: new Date(),
      indicators: {
        ema20: parseFloat(ema20.toFixed(2)),
        ema50: parseFloat(ema50.toFixed(2)),
        rsi: parseFloat(rsi.toFixed(2)),
        volatility: parseFloat(volatility.toFixed(4)),
        momentum: parseFloat(momentum.toFixed(2))
      }
    };
  } catch (error) {
    logger.error('Error predicting prices:', error);
    return {
      predictions: [],
      confidence: 0,
      methodology: 'statistical',
      timestamp: new Date(),
      error: error.message
    };
  }
};

/**
 * Calculate Exponential Moving Average
 * Gives more weight to recent prices
 */
const calculateEMA = (prices, period) => {
  if (prices.length < period) return prices[prices.length - 1];

  const k = 2 / (period + 1); // Smoothing factor
  let ema = prices.slice(0, period).reduce((a, b) => a + b) / period;

  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }

  return ema;
};

/**
 * Calculate Momentum (Rate of change over 12 periods)
 * Positive = upward momentum, Negative = downward momentum
 */
const calculateMomentum = (prices) => {
  const period = Math.min(12, Math.floor(prices.length / 2));
  if (prices.length < period + 1) return 0;
  
  const current = prices[prices.length - 1];
  const previous = prices[prices.length - 1 - period];
  
  return ((current - previous) / previous) * 100;
};

/**
 * Calculate RSI (Relative Strength Index)
 * 0-100 scale. <30 = oversold, >70 = overbought, ~50 = neutral
 */
const calculateRSI = (prices, period = 14) => {
  if (prices.length < period + 1) {
    return 50; // Neutral if not enough data
  }

  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  const gains = changes.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
  const losses = Math.abs(changes.filter(c => c < 0).reduce((a, b) => a + b, 0)) / period;

  if (losses === 0) return 100;
  
  const rs = gains / losses;
  const rsi = 100 - (100 / (1 + rs));

  return rsi;
};

/**
 * Calculate volatility (standard deviation of returns)
 * Helps establish prediction confidence interval width
 */
const calculateVolatility = (prices, period = 20) => {
  if (prices.length < period) period = Math.max(2, prices.length - 1);

  const recentPrices = prices.slice(-period);
  const returns = [];

  for (let i = 1; i < recentPrices.length; i++) {
    returns.push((recentPrices[i] - recentPrices[i - 1]) / recentPrices[i - 1]);
  }

  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  
  return Math.sqrt(variance);
};

module.exports = {
  predictPrices,
  calculateEMA,
  calculateMomentum,
  calculateRSI,
  calculateVolatility
};