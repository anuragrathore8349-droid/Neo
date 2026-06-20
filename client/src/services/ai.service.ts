import { apiFetch } from './api';

/**
 * AI Service - Handles all AI-related API calls to the backend
 * Provides methods for price predictions, sentiment analysis, risk assessment,
 * portfolio optimization, and more.
 */
class AIService {
  /**
   * Get price predictions for a specific symbol
   * @param symbol - Cryptocurrency symbol (e.g., 'BTC', 'ETH')
   * @param timeframe - Time period for historical data (e.g., '1d', '1w', '1m')
   * @param horizon - Prediction horizon (e.g., '7d', '30d')
   */
  async getPricePredictions(
    symbol: string,
    timeframe: string = '1d',
    horizon: string = '7d'
  ) {
    try {
      const params = new URLSearchParams();
      if (timeframe) params.append('timeframe', timeframe);
      if (horizon) params.append('horizon', horizon);

      const query = params.toString() ? `?${params.toString()}` : '';
      console.log(`Fetching price predictions for ${symbol}...`);

      const response = await apiFetch<{ data: any }>(
        `/api/ai/predictions/${symbol}${query}`
      );
      
      console.log('Price predictions received:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching price predictions:', error);
      throw error;
    }
  }

  /**
   * Get market sentiment analysis for a symbol
   * @param symbol - Cryptocurrency symbol
   * @param sources - Comma-separated sentiment sources (news, social, technical, onchain)
   * @param timeframe - Analysis time period (e.g., '24h', '7d')
   */
  async getMarketSentiment(
    symbol: string,
    sources: string = 'news,social',
    timeframe: string = '24h'
  ) {
    try {
      const params = new URLSearchParams();
      params.append('sources', sources);
      params.append('timeframe', timeframe);

      const query = `?${params.toString()}`;
      console.log(`Fetching market sentiment for ${symbol}...`);

      const response = await apiFetch<{ data: any }>(
        `/api/ai/sentiment/${symbol}${query}`
      );
      
      console.log('Market sentiment received:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching market sentiment:', error);
      throw error;
    }
  }

  /**
   * Perform risk assessment on a portfolio
   * @param assets - Array of assets with symbol and amount
   * @param timeframe - Historical data period for risk calculation (e.g., '30d', '7d', format: \d+[hdwm])
   */
  async getRiskAssessment(
    assets: Array<{ symbol: string; amount: number }>,
    timeframe: string = '30d'
  ) {
    try {
      console.log('Performing risk assessment...', assets);

      const response = await apiFetch<{ data: any }>(
        '/api/ai/risk/assessment',
        {
          method: 'POST',
          body: { assets, timeframe }
        }
      );

      console.log('Risk assessment completed:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error performing risk assessment:', error);
      throw error;
    }
  }

  /**
   * Find investment opportunities based on filters
   * @param filters - Filter criteria
   */
  async getInvestmentOpportunities(filters: any = {}) {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        params.append(key, String(value));
      });

      const query = params.toString() ? `?${params.toString()}` : '';
      console.log('Finding investment opportunities...');

      const response = await apiFetch<{ data: any }>(
        `/api/ai/opportunities${query}`
      );

      console.log('Investment opportunities found:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error finding investment opportunities:', error);
      throw error;
    }
  }

  /**
   * Optimize portfolio allocation
   * @param assets - Current portfolio assets
   * @param constraints - Portfolio constraints (min/max allocations)
   * @param objective - Optimization objective (maximize_return, minimize_risk, sharpe)
   */
  async optimizePortfolio(
    assets: Array<{
      symbol: string;
      amount: number;
      currentAllocation: number;
    }>,
    constraints: {
      minAllocation: number;
      maxAllocation: number;
      minRiskScore: number;
      maxRiskScore: number;
    },
    objective: string = 'sharpe'
  ) {
    try {
      console.log('Optimizing portfolio...');

      const response = await apiFetch<{ data: any }>(
        '/api/ai/portfolio/optimize',
        {
          method: 'POST',
          body: { assets, constraints, objective }
        }
      );

      console.log('Portfolio optimization completed:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error optimizing portfolio:', error);
      throw error;
    }
  }

  /**
   * Get strategy recommendations
   * @param portfolio - Current portfolio data
   * @param preferences - User preferences (risk tolerance, investment horizon, strategy)
   */
  async getStrategyRecommendations(
    portfolio: any,
    preferences: {
      riskTolerance: number;
      investmentHorizon: string;
      strategy?: 'passive' | 'active' | 'mixed';
    }
  ) {
    try {
      console.log('Generating strategy recommendations...');

      const response = await apiFetch<{ data: any }>(
        '/api/ai/strategy/recommend',
        {
          method: 'POST',
          body: { portfolio, preferences }
        }
      );

      console.log('Strategy recommendations received:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error getting strategy recommendations:', error);
      throw error;
    }
  }

  /**
   * Detect technical patterns in price data
   * @param symbol - Asset symbol
   * @param timeframe - Time period for analysis
   * @param patternTypes - Specific patterns to detect
   */
  async detectPatterns(
    symbol: string,
    timeframe: string = '1d',
    patternTypes: string[] = [
      'double_top',
      'double_bottom',
      'head_shoulders',
      'triangle',
      'wedge',
      'channel'
    ]
  ) {
    try {
      const params = new URLSearchParams();
      params.append('timeframe', timeframe);
      params.append('patterns', patternTypes.join(','));

      const query = `?${params.toString()}`;
      console.log(`Detecting patterns for ${symbol}...`);

      const response = await apiFetch<{ data: any }>(
        `/api/ai/patterns/${symbol}${query}`
      );

      console.log('Patterns detected:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error detecting patterns:', error);
      throw error;
    }
  }

  /**
   * Analyze news and market information
   * @param symbols - Comma-separated symbols to analyze
   * @param categories - News categories to focus on
   * @param timeframe - Time period for news analysis
   */
  async analyzeNews(
    symbols: string = 'BTC,ETH',
    categories: string = 'general,technical',
    timeframe: string = '24h',
    limit: number = 50
  ) {
    try {
      const params = new URLSearchParams();
      params.append('symbols', symbols);
      params.append('categories', categories);
      params.append('timeframe', timeframe);
      params.append('limit', String(limit));

      const query = `?${params.toString()}`;
      console.log('Analyzing news...');

      const response = await apiFetch<{ data: any }>(
        `/api/ai/news/analysis${query}`
      );

      console.log('News analysis completed:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error analyzing news:', error);
      throw error;
    }
  }

  /**
   * Detect anomalies in asset behavior
   * @param assets - Array of asset symbols to analyze
   * @param timeframe - Time period for anomaly detection
   */
  async detectAnomalies(
    assets: string[],
    timeframe: string = '7d'
  ) {
    try {
      console.log('Detecting anomalies...');

      const response = await apiFetch<{ data: any }>(
        '/api/ai/anomalies',
        {
          method: 'POST',
          body: { assets, timeframe }
        }
      );

      console.log('Anomaly detection completed:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error detecting anomalies:', error);
      throw error;
    }
  }

  /**
   * Get personalized insights based on user profile
   * @param userId - User ID for personalization
   * @param preferences - User preferences
   */
  async getPersonalizedInsights(userId: string, preferences: any) {
    try {
      console.log('Getting personalized insights...');

      const response = await apiFetch<{ data: any }>(
        `/api/ai/insights/${userId}`,
        {
          method: 'POST',
          body: { preferences }
        }
      );

      console.log('Personalized insights received:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error getting personalized insights:', error);
      throw error;
    }
  }
  async getFearGreedIndex() {
  try {
    const response = await apiFetch<{ data: any }>('/api/ai/fear-greed');
    return response.data;
  } catch (error) {
    console.error('Error fetching fear & greed:', error);
    throw error;
  }
}
async getBTCDominance() {
  const response = await apiFetch<{ data: any }>('/api/ai/market/dominance');
  return response.data;
}
async getTrendingCoins() {
  const response = await apiFetch<{ data: any }>('/api/ai/trending-coins');
  return response.data;
}
}

// Export singleton instance
export default new AIService();
