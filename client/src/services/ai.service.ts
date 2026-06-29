import { apiFetch } from './api';

class AIService {
  async getPricePredictions(
    symbol: string,
    timeframe: string = '1d',
    horizon: string | number = '7'
  ) {
    try {
      const params = new URLSearchParams();
      if (timeframe) params.append('timeframe', timeframe);
      // Ensure horizon is sent as plain number string (e.g., "30" not "30d")
      params.append('horizon', String(horizon).replace(/[a-z]/gi, ''));

      const response = await apiFetch<{ data: any }>(
        `/api/ai/predictions/${symbol}?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching price predictions:', error);
      throw error;
    }
  }

  async getMarketSentiment(
    symbol: string,
    sources: string = 'technical',
    timeframe: string = '24h'
  ) {
    try {
      const params = new URLSearchParams({ sources, timeframe });
      const response = await apiFetch<{ data: any }>(
        `/api/ai/sentiment/${symbol}?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching market sentiment:', error);
      throw error;
    }
  }

  async getRiskAssessment(
    assets: Array<{ symbol: string; amount: number }>,
    timeframe: string = '30d'
  ) {
    try {
      const response = await apiFetch<{ data: any }>(
        '/api/ai/risk/assessment',
        { method: 'POST', body: { assets, timeframe } }
      );
      return response.data;
    } catch (error) {
      console.error('Error performing risk assessment:', error);
      throw error;
    }
  }

  async getInvestmentOpportunities(filters: Record<string, any> = {}) {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) params.append(key, String(value));
      });
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await apiFetch<{ data: any }>(`/api/ai/opportunities${query}`);
      return response.data;
    } catch (error) {
      console.error('Error finding investment opportunities:', error);
      throw error;
    }
  }

  async optimizePortfolio(
    assets: Array<{ symbol: string; amount: number; currentAllocation?: number }>,
    constraints: { minAllocation?: number; maxAllocation?: number; riskTolerance?: number },
    objective: string = 'sharpe'
  ) {
    try {
      const response = await apiFetch<{ data: any }>(
        '/api/ai/portfolio/optimize',
        { method: 'POST', body: { assets, constraints, objective } }
      );
      return response.data;
    } catch (error) {
      console.error('Error optimizing portfolio:', error);
      throw error;
    }
  }

  async getStrategyRecommendations(
    portfolio: any,
    preferences: { riskTolerance: number; investmentHorizon: string; strategy?: 'passive' | 'active' | 'mixed' }
  ) {
    try {
      const response = await apiFetch<{ data: any }>(
        '/api/ai/strategy/recommend',
        { method: 'POST', body: { portfolio, preferences } }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting strategy recommendations:', error);
      throw error;
    }
  }

  async detectPatterns(
    symbol: string,
    timeframe: string = '1d',
    patternTypes: string[] = ['double_top', 'double_bottom', 'head_shoulders', 'triangle', 'wedge', 'channel']
  ) {
    try {
      const params = new URLSearchParams({ timeframe, patterns: patternTypes.join(',') });
      const response = await apiFetch<{ data: any }>(
        `/api/ai/patterns/${symbol}?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error('Error detecting patterns:', error);
      throw error;
    }
  }

  async analyzeNews(
    symbols: string = 'BTC,ETH',
    categories: string = 'general,technical',
    timeframe: string = '24h',
    limit: number = 10
  ) {
    try {
      const params = new URLSearchParams({
        symbols,
        categories,
        timeframe,
        limit: String(limit)
      });
      const response = await apiFetch<{ data: any }>(
        `/api/ai/news/analysis?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error('Error analyzing news:', error);
      throw error;
    }
  }

  async detectAnomalies(assets: string[], timeframe: string = '7d') {
    try {
      const response = await apiFetch<{ data: any }>(
        '/api/ai/anomalies',
        { method: 'POST', body: { assets, timeframe } }
      );
      return response.data;
    } catch (error) {
      console.error('Error detecting anomalies:', error);
      throw error;
    }
  }

  // GET /api/ai/insights — auth token sent automatically via apiFetch header
  async getPersonalizedInsights() {
    try {
      const response = await apiFetch<{ data: any }>('/api/ai/insights');
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
    try {
      const response = await apiFetch<{ data: any }>('/api/ai/market/dominance');
      return response.data;
    } catch (error) {
      console.error('Error fetching BTC dominance:', error);
      throw error;
    }
  }

  async getTrendingCoins() {
    try {
      const response = await apiFetch<{ data: any }>('/api/ai/trending-coins');
      return response.data;
    } catch (error) {
      console.error('Error fetching trending coins:', error);
      throw error;
    }
  }

  // NEW: single-call market overview
  async getMarketOverview() {
    try {
      const response = await apiFetch<{ data: any }>('/api/ai/market/overview');
      return response.data;
    } catch (error) {
      console.error('Error fetching market overview:', error);
      throw error;
    }
  }

  async portfolioChat(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; text: string }> = []
  ): Promise<{
    reply: string;
    portfolioContext: { totalValue: number; assetCount: number; symbols: string[] };
    source: string;
    timestamp: string;
  }> {
    try {
      const response = await apiFetch<{ data: any }>(
        '/api/ai/chat',
        { method: 'POST', body: { message, history } }
      );
      return response.data;
    } catch (error) {
      console.error('Error in portfolio chat:', error);
      throw error;
    }
  }
}

export default new AIService();
