const calculateTechnicalIndicators = (priceData) => {
  return {
    sma: calculateSMA(priceData),
    ema: calculateEMA(priceData),
    rsi: calculateRSI(priceData),
    macd: calculateMACD(priceData)
  };
};

const calculateSMA = (prices, period = 14) => {
  const sma = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  return sma;
};

const calculateEMA = (prices, period = 14) => {
  const ema = [];
  const multiplier = 2 / (period + 1);
  
  // Start with SMA
  const firstSMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  ema.push(firstSMA);
  
  // Calculate EMA
  for (let i = period; i < prices.length; i++) {
    const newEMA = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(newEMA);
  }
  
  return ema;
};

const calculateRSI = (prices, period = 14) => {
  const rsi = [];
  let gains = [];
  let losses = [];
  
  // Calculate price changes
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  // Calculate initial averages
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  // Calculate RSI
  for (let i = period; i < prices.length; i++) {
    avgGain = ((avgGain * (period - 1)) + gains[i - 1]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[i - 1]) / period;
    
    const rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }
  
  return rsi;
};

const calculateMACD = (prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  
  // Calculate MACD line
  const macdLine = [];
  for (let i = 0; i < fastEMA.length; i++) {
    if (i >= slowEMA.length) break;
    macdLine.push(fastEMA[i] - slowEMA[i]);
  }
  
  // Calculate signal line
  const signalLine = calculateEMA(macdLine, signalPeriod);
  
  // Calculate histogram
  const histogram = macdLine.map((macd, i) => {
    if (i >= signalLine.length) return null;
    return macd - signalLine[i];
  });
  
  return {
    macdLine,
    signalLine,
    histogram
  };
};

module.exports = {
  calculateTechnicalIndicators,
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD
};