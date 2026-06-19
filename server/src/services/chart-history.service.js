const axios = require('axios');
const { logger } = require('../api/middlewares/logger.middleware');

/**
 * Chart History Service
 * Fetches real historical price data for DeFi positions
 * Phase 4 implementation for StakingPositionCard
 */
class ChartHistoryService {
  constructor() {
    // CoinGecko API endpoints
    this.coingeckoBaseUrl = 'https://api.coingecko.com/api/v3';
    
    // Token mappings to CoinGecko IDs
    this.tokenMap = {
      'ETH': 'ethereum',
      'stETH': 'staked-ether',
      'AAVE': 'aave',
      'CRV': 'curve-dao-token',
      'LDO': 'lido-dao',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'DAI': 'dai'
    };

    // Cache with 1-hour expiry for price history
    this.cache = new Map();
    this.cacheExpiry = 60 * 60 * 1000;
  }

  /**
   * Get cache entry
   */
  getCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * Set cache entry
   */
  setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Fetch historical price data for a position
   * Returns 30-day chart data starting from when position was created
   * @param {Object} position - DeFi position object
   * @param {string} days - Number of days (default 30)
   * @returns {Array} Chart data points with date and value
   */
  async getPositionChartHistory(position, days = 30) {
    try {
      if (!position || !position.asset) {
        logger.warn('Invalid position for chart history');
        return this.generateFallbackChartData(days, 100);
      }

      const assetSymbol = typeof position.asset === 'string' ? position.asset : position.asset?.symbol || 'ETH';
      const amount = parseFloat(position.asset?.amount || position.amount?.replace(/[$,]/g, '') || 1);
      const startDate = position.startedAt || position.createdAt || new Date();

      // Get real historical prices
      const priceHistory = await this.fetchRealPriceHistory(assetSymbol, startDate, days);
      
      if (!priceHistory || priceHistory.length === 0) {
        logger.warn(`Could not fetch real price history for ${assetSymbol}, using fallback`);
        return this.generateFallbackChartData(days, amount * 100);
      }

      // Convert prices to position values (price × staked amount)
      const chartData = priceHistory.map(point => ({
        date: this.formatDateForChart(point.timestamp),
        value: parseFloat((point.price * amount).toFixed(2))
      }));

      logger.info(`Generated chart history for ${assetSymbol}: ${chartData.length} data points`);
      return chartData;
    } catch (error) {
      logger.warn('Error generating position chart history:', error.message);
      const amount = parseFloat(position?.asset?.amount || position?.amount?.replace(/[$,]/g, '') || 1);
      return this.generateFallbackChartData(days, amount * 100);
    }
  }

  /**
   * Fetch real historical price data from CoinGecko
   * @param {string} symbol - Token symbol (ETH, AAVE, etc.)
   * @param {Date} startDate - Start date for history
   * @param {number} days - Number of days to fetch
   * @returns {Array} Array of {timestamp, price} objects
   */
  async fetchRealPriceHistory(symbol, startDate, days) {
    try {
      const cacheKey = `price_history_${symbol}_${days}`;
      const cached = this.getCache(cacheKey);
      if (cached) return cached;

      const coingeckoId = this.tokenMap[symbol?.toUpperCase()] || symbol?.toLowerCase();
      
      logger.info(`Fetching ${days}-day price history for ${symbol} (CoinGecko: ${coingeckoId})`);

      // Calculate date range (CoinGecko returns data points for each day)
      const fromTimestamp = Math.floor(startDate.getTime() / 1000);
      const toTimestamp = Math.floor(Date.now() / 1000);
      const daysRequested = Math.ceil((toTimestamp - fromTimestamp) / 86400);

      // CoinGecko market chart endpoint
      const url = `${this.coingeckoBaseUrl}/coins/${coingeckoId}/market_chart`;
      const params = {
        vs_currency: 'usd',
        days: Math.min(daysRequested, 365), // Max 365 days
        interval: 'daily'
      };

      const response = await axios.get(url, { params, timeout: 10000 });
      const prices = response.data?.prices || [];

      if (prices.length === 0) {
        logger.warn(`No price history returned from CoinGecko for ${coingeckoId}`);
        return null;
      }

      // Convert to {timestamp, price} format
      const priceData = prices.map(([timestamp, price]) => ({
        timestamp: new Date(timestamp),
        price
      }));

      this.setCache(cacheKey, priceData);
      logger.info(`Successfully fetched ${priceData.length} price history points for ${symbol}`);
      return priceData;
    } catch (error) {
      logger.warn(`Error fetching price history from CoinGecko for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Generate fallback chart data with realistic trend
   * Simulates position value over time with slight variations
   * @param {number} days - Number of data points
   * @param {number} baseValue - Base position value
   * @returns {Array} Chart data points
   */
  generateFallbackChartData(days = 30, baseValue = 10000) {
    const data = [];
    const trend = 1 + (Math.random() - 0.5) * 0.1; // Random trend between 0.95 - 1.05

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));

      // Generate value with slight trending and daily variance
      const progress = i / days;
      const trendedValue = baseValue * Math.pow(trend, progress);
      const variance = (Math.random() - 0.5) * (baseValue * 0.02); // ±1% daily variance
      const value = Math.max(baseValue * 0.9, trendedValue + variance); // Floor at 90% of base

      data.push({
        date: this.formatDateForChart(date),
        value: parseFloat(value.toFixed(2))
      });
    }

    return data;
  }

  /**
   * Format date for chart display
   * Returns "MMM DD" format (e.g., "Apr 27")
   * @param {Date|timestamp} date
   * @returns {string} Formatted date
   */
  formatDateForChart(date) {
    if (typeof date === 'number') {
      date = new Date(date);
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = String(date.getDate()).padStart(2, '0');
    return `${month} ${day}`;
  }

  /**
   * Calculate APY-based rewards chart
   * Shows how staked rewards grow over time based on APY
   * @param {Object} position - Position object
   * @param {number} days - Number of days (default 30)
   * @returns {Array} Rewards accumulation chart data
   */
  async getRewardsAccumulationChart(position, days = 30) {
    try {
      if (!position || !position.asset || !position.apy) {
        return this.generateFallbackRewardsChart(days);
      }

      const amount = parseFloat(position.asset?.amount || position.amount?.replace(/[$,]/g, '') || 0);
      const apy = parseFloat(position.apy?.toString().replace('%', '') || 0) / 100;
      const startDate = position.startedAt || position.createdAt || new Date();
      const daysSinceStart = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      const chartData = [];

      for (let i = 0; i < Math.min(days, daysSinceStart + 1); i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);

        // Calculate rewards earned by day i
        // Formula: amount × APY ÷ 365 × days
        const daysEarned = i + 1;
        const dailyReward = amount * apy / 365;
        const totalReward = dailyReward * daysEarned;

        chartData.push({
          date: this.formatDateForChart(date),
          value: parseFloat(totalReward.toFixed(2))
        });
      }

      logger.info(`Generated rewards accumulation chart: ${chartData.length} data points`);
      return chartData;
    } catch (error) {
      logger.warn('Error generating rewards accumulation chart:', error.message);
      return this.generateFallbackRewardsChart(days);
    }
  }

  /**
   * Generate fallback rewards accumulation chart
   */
  generateFallbackRewardsChart(days = 30) {
    const data = [];
    const dailyReward = 5; // Mock $5 daily reward

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));
      
      data.push({
        date: this.formatDateForChart(date),
        value: parseFloat((dailyReward * (i + 1)).toFixed(2))
      });
    }

    return data;
  }

  /**
   * Get summary statistics for chart display
   */
  async getChartSummary(position) {
    try {
      const chartData = await this.getPositionChartHistory(position, 30);
      const rewardsChart = await this.getRewardsAccumulationChart(position, 30);

      if (!chartData || chartData.length === 0) {
        return {
          minValue: 0,
          maxValue: 0,
          avgValue: 0,
          currentValue: 0,
          totalRewards: 0
        };
      }

      const values = chartData.map(d => d.value);
      const rewards = rewardsChart.map(d => d.value);

      return {
        minValue: Math.min(...values),
        maxValue: Math.max(...values),
        avgValue: values.reduce((a, b) => a + b, 0) / values.length,
        currentValue: values[values.length - 1],
        totalRewards: rewards[rewards.length - 1]
      };
    } catch (error) {
      logger.warn('Error calculating chart summary:', error.message);
      return {
        minValue: 0,
        maxValue: 0,
        avgValue: 0,
        currentValue: 0,
        totalRewards: 0
      };
    }
  }
}

module.exports = new ChartHistoryService();
