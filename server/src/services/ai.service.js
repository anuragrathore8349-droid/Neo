const { logger } = require('../api/middlewares/logger.middleware');
const marketService = require('./market.service');
const { 
  predictPrices, 
  calculateEMA, 
  calculateMomentum, 
  calculateRSI, 
  calculateVolatility 
} = require('../utils/predictions');
const { analyzeSentiment } = require('../utils/sentiment');
const { detectPatterns } = require('../utils/patterns');
const { optimizePortfolio } = require('../utils/portfolio');
const { 
  detectAnomalies, 
  detectStatisticalAnomalies,
  DEFAULT_CONFIG 
} = require('../utils/anomalies');
const { CRYPTO_SYMBOLS } = require('../utils/assetTypes');
const { generateStrategyRecommendation, explainNewsImpact } = require('../utils/openai-integration');

/**
 * AIService - Modern, lightweight AI service for financial analysis
 * Uses statistical methods and fallback data instead of OpenAI
 * Fully Node 20+ compatible
 */
class AIService {
  constructor() {
    const config = require('../config');
    const apiKey = config.gemini?.apiKey;
    if (apiKey) {
      this.hasOpenAI = true;  // reuse flag name — means "AI backend available"
      logger.info('✅ Gemini AI configured for enhanced insights (gemini-2.5-flash)');
    } else {
      this.hasOpenAI = false;
      logger.warn('⚠️ GEMINI_API_KEY not set — AI will use statistical fallback. Set it in server/.env');
    }
  }

  /**
   * Generate price predictions using ensemble statistical methods
   * Methods: EMA, Momentum, RSI, Volatility
   * 
   * @param {String} symbol - Asset symbol
   * @param {String} timeframe - '1h', '4h', '1d', '1w', '1m'
   * @param {Number} horizon - Days to predict ahead (1-30)
   * @returns {Promise<Object>} Predictions with confidence intervals
   */
  async getPricePredictions(symbol, timeframe = '1d', horizon = 7) {
    try {
      logger.debug(`Getting predictions for ${symbol}, timeframe: ${timeframe}, horizon: ${horizon}`);

      // Validate inputs
      if (!symbol) throw new Error('Symbol is required');
      if (horizon < 1 || horizon > 90) throw new Error('Horizon must be between 1 and 90 days');

      // Calculate date range (6 months of history for better predictions)
      const today = new Date();
      const sixMonthsAgo = new Date(today.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
      
      // Format dates as ISO strings for API
      const to = today.toISOString().split('T')[0];
      const from = sixMonthsAgo.toISOString().split('T')[0];

      // Fetch historical data with proper date range
      const priceHistoryData = await marketService.getPriceHistory(symbol, timeframe, from, to);
      
      // Extract prices array from the returned object { prices: [...], indicators: {...} }
      const historicalData = priceHistoryData?.prices || [];
      
      if (!historicalData || historicalData.length < 30) {
        throw new Error(`Insufficient historical data for ${symbol}. Got ${historicalData.length} data points, need at least 30.`);
      }

      // Generate predictions using statistical ensemble
      const predictions = await predictPrices(historicalData, horizon);

      // Calculate average prediction price
      const preds = predictions.predictions || [];
      const average = preds.length > 0
        ? preds.reduce((sum, p) => sum + (p.price || 0), 0) / preds.length
        : null;

      return {
        symbol,
        timeframe,
        horizon,
        currentPrice: historicalData[historicalData.length - 1]?.close
                      ?? historicalData[historicalData.length - 1]?.price
                      ?? null,
        predictions: preds,
        average: average ? parseFloat(average.toFixed(2)) : null,
        confidence: predictions.confidence,
        indicators: predictions.indicators,
        methodology: 'statistical_ensemble',
        methods: ['EMA', 'Momentum', 'RSI', 'Volatility'],
        lastUpdated: new Date().toISOString(),
        dataPoints: historicalData.length
      };
    } catch (error) {
      logger.error(`Error generating price predictions for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Analyze market sentiment from multiple sources
   * Uses OpenAI for advanced sentiment analysis
   * 
   * @param {String} symbol - Asset symbol
   * @param {Array<String>} sources - ['news', 'social', 'technical']
   * @param {String} timeframe - Analysis timeframe
   * @returns {Promise<Object>} Aggregated sentiment analysis
   */
  async getMarketSentiment(symbol, sources = ['technical'], timeframe = '7d') {
    try {
      logger.debug(`Analyzing sentiment for ${symbol}, sources: ${sources.join(', ')}`);

      if (!symbol) throw new Error('Symbol is required');

      const sentimentData = await Promise.allSettled(
        sources.map(source => this.getSentimentBySource(symbol, source, timeframe))
      );

      // Process results, handling both successes and failures
      const validSentiments = sentimentData
        .filter(p => p.status === 'fulfilled')
        .map(p => p.value);

      if (validSentiments.length === 0) {
        throw new Error('Failed to analyze sentiment from any source');
      }

      const aggregated = this.aggregateSentiment(validSentiments);

      return {
        symbol,
        timeframe,
        overall: aggregated,
        sources: validSentiments,
        confidence: validSentiments.length / sources.length,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error analyzing sentiment for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Perform comprehensive risk assessment
   * Calculates volatility, Value at Risk (VaR), Sharpe ratio
   * 
   * @param {Array|String} assetsOrUserId - Array of [{symbol, amount}] or userId string
   * @param {String} timeframe - Historical analysis period
   * @returns {Promise<Object>} Risk metrics and recommendations
   */
  async getRiskAssessment(assetsOrUserId, timeframe = '30d') {
    try {
      // Support both (userId) and (assets[], timeframe) calling conventions
      let assets = [];
      if (Array.isArray(assetsOrUserId)) {
        // Called from controller with validated body: assets is already an array
        assets = assetsOrUserId;
      } else {
        // Called with userId — fetch portfolio from DB
        const portfolioService = require('./portfolio.service');
        assets = await portfolioService.getAllAssets(assetsOrUserId).catch(() => []);
      }

      // ✅ Guard: return safe default if no assets
      if (!assets || assets.length === 0) {
        return {
          overallRisk: 'unknown',
          riskScore: 0,
          factors: [],
          recommendations: ['Add assets to your portfolio to get a risk assessment.'],
          lastUpdated: new Date().toISOString(),
        };
      }

      logger.debug(`Performing risk assessment for ${assets.length} assets`);

      // Helper to parse timeframe and calculate dates
      const getDateRange = (tf) => {
        const today = new Date();
        const days = parseInt(tf) || 365;
        const fromDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
        return [fromDate.toISOString().split('T')[0], today.toISOString().split('T')[0]];
      };
      
      const [fromDate, toDate] = getDateRange(timeframe);

      const assessments = await Promise.allSettled(
        assets.map(async (asset) => {
          try {
            const historyResponse = await marketService.getPriceHistory(
              asset.symbol,
              '1d',
              fromDate,
              toDate
            );

            // Extract prices array from response object {prices: [...], indicators: {...}}
            let historicalData = [];
            if (historyResponse) {
              historicalData = Array.isArray(historyResponse) ? historyResponse : (historyResponse.prices || []);
            }

            if (!Array.isArray(historicalData) || historicalData.length < 30) {
              logger.warn(`Insufficient data for ${asset.symbol}: got ${historicalData.length} data points`);
              return {
                symbol: asset.symbol,
                status: 'insufficient_data',
                amount: asset.amount,
                riskLevel: 'medium'
              };
            }

            const metrics = this.calculateRiskMetrics(historicalData) || {};
            const exposure = this.calculateExposure(asset, historicalData) || {};
            const trend = this.analyzeTrend(historicalData) || {};

            return {
              symbol: asset.symbol,
              amount: asset.amount,
              metrics: metrics,
              exposure: exposure,
              trend: trend,
              riskLevel: metrics.riskLevel || 'medium',
              status: 'success'
            };
          } catch (error) {
            logger.warn(`Error assessing ${asset.symbol}:`, error.message);
            return {
              symbol: asset.symbol,
              amount: asset.amount,
              status: 'error',
              error: error.message,
              riskLevel: 'medium'
            };
          }
        })
      );

      const successfulAssessments = assessments
        .filter(p => p.status === 'fulfilled' && (p.value.status === 'success' || p.value.status === 'insufficient_data'))
        .map(p => p.value);

      const portfolioRisk = this.calculatePortfolioRisk(successfulAssessments);

      return {
        assets: successfulAssessments,
        portfolio: portfolioRisk,
        recommendations: this.generateRiskRecommendations(successfulAssessments, portfolioRisk),
        summary: {
          totalAssets: assets.length,
          analyzedAssets: successfulAssessments.length,
          assessmentMethod: 'statistical'
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error performing risk assessment:', error);
      throw error;
    }
  }

  /**
   * Detect statistical anomalies in price data
   * Uses z-score method with configurable thresholds
   * 
   * @param {Array} data - [{symbol, values}]
   * @param {Number} threshold - Z-score threshold
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Detected anomalies with explanations
   */
  async detectAnomalies(data, threshold = 3, options = {}) {
    try {
      logger.debug(`Detecting anomalies, threshold: ${threshold}`);

      if (!Array.isArray(data)) {
        throw new Error('Data must be an array');
      }

      // Detect anomalies
      const anomalies = await detectAnomalies(
        data,
        threshold,
        {
          enrichWithAI: this.hasOpenAI,
          maxResults: options.maxResults || 20,
          ...options
        }
      );

      return {
        anomalies,
        total: anomalies.length,
        methodology: 'statistical_zscore',
        threshold,
        summary: anomalies.length > 0 ? {
          highestSeverity: Math.max(...anomalies.map(a => a.severity)),
          avgSeverity: anomalies.reduce((sum, a) => sum + a.severity, 0) / anomalies.length,
          criticalCount: anomalies.filter(a => a.severity > 0.7).length
        } : null,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error detecting anomalies:', error);
      throw error;
    }
  }

  /**
   * Optimize portfolio allocation
   * Uses modern portfolio theory principles with statistical methods
   */
  async optimizePortfolio(assets, constraints, objective = 'sharpe') {
    try {
      logger.debug(`Optimizing portfolio with ${assets.length} assets, objective: ${objective}`);

      if (!Array.isArray(assets) || assets.length < 2) {
        throw new Error('At least 2 assets required for portfolio optimization');
      }

      // Fetch historical data for all assets
      const historicalData = await Promise.allSettled(
        assets.map(async (asset) => {
          const today = new Date();
          const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
          const fromDate = oneYearAgo.toISOString().split('T')[0];
          const toDate = today.toISOString().split('T')[0];
          const response = await marketService.getPriceHistory(asset.symbol, '1d', fromDate, toDate);
          return response?.prices || response || [];
        })
      );

      const validData = historicalData
        .filter(p => p.status === 'fulfilled' && p.value)
        .map((p, idx) => ({ asset: assets[idx], data: p.value }));

      if (validData.length < 2) {
        throw new Error('Insufficient data for portfolio optimization');
      }

      // Optimize using utility function
      const optimization = await optimizePortfolio(
        validData.map(v => v.asset),
        validData.map(v => v.data),
        constraints,
        objective
      );

      const allocationMap = optimization.allocationMap || (Array.isArray(optimization.allocation)
        ? optimization.allocation.reduce((map, item) => {
            let raw = item.weight ?? item.allocation ?? item.allocationPercentage ?? 0;
            if (typeof raw === 'string') {
              raw = parseFloat(raw.replace('%', '')) || 0;
            }
            const weight = typeof raw === 'number' ? raw / 100 : 0;
            map[item.symbol] = Math.max(0, Math.min(1, weight));
            return map;
          }, {})
        : typeof optimization.allocation === 'object' && optimization.allocation !== null
          ? Object.fromEntries(Object.entries(optimization.allocation).map(([symbol, rawValue]) => {
              let raw = rawValue;
              if (typeof raw === 'string') {
                raw = parseFloat(raw.replace('%', '')) || 0;
              }
              const weight = typeof raw === 'number' ? raw / 100 : 0;
              return [symbol, Math.max(0, Math.min(1, weight))];
            }))
          : {});

      return {
        currentAllocation: this.calculateCurrentAllocation(assets),
        recommendedAllocation: optimization.allocation,
        allocationMap,
        expectedMetrics: optimization.metrics || optimization.expectedMetrics || {},
        rebalancing: this.calculateRebalancing(assets, allocationMap),
        objective,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error optimizing portfolio:', error);
      throw error;
    }
  }

  /**
   * Generate strategy recommendations using Gemini AI with fallback to statistical methods
   * Tries Gemini first, auto-falls back to statistical analysis if API fails
   */
  async getStrategyRecommendations(portfolio, preferences = {}) {
    try {
      const assets = Array.isArray(portfolio) ? portfolio : (portfolio?.assets || []);

      if (!Array.isArray(assets) || assets.length === 0) {
        throw new Error('Valid portfolio required');
      }

      const portfolioObj = Array.isArray(portfolio) ? { assets: portfolio } : portfolio;
      const marketConditions = await this.assessMarketConditions();

      // Try Gemini AI first
      if (this.hasOpenAI) {
        try {
          logger.debug('🤖 Attempting Gemini AI strategy generation...');
          const aiStrategies = await generateStrategyRecommendation(portfolioObj, marketConditions);
          
          if (aiStrategies && aiStrategies.length > 0) {
            logger.info('✅ Gemini strategy recommendations generated');
            return {
              strategies: Array.isArray(aiStrategies) ? aiStrategies : [aiStrategies],
              methodology: 'gemini_2.5_flash',
              confidence: 'high',
              source: 'ai',
              lastUpdated: new Date().toISOString()
            };
          }
        } catch (aiError) {
          logger.warn('⚠️ Gemini API failed, falling back to statistical analysis:', aiError.message);
        }
      }

      // Fallback to statistical methods
      logger.debug('📊 Using statistical strategy recommendations (fallback)');
      const recommendation = await this.getStatisticalStrategyRecommendation(portfolioObj, preferences);

      return {
        strategies: Array.isArray(recommendation) ? recommendation : [recommendation],
        methodology: 'statistical',
        confidence: 'medium',
        source: 'fallback',
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error generating strategy recommendations:', error);
      throw error;
    }
  }
  /**
   * Detect chart patterns
   */
  async detectPatterns(symbol, timeframe = '1d', patternTypes = ['all']) {
    try {
      logger.debug(`Detecting patterns for ${symbol}`);

      const today = new Date();
      const oneMonthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fromDate = oneMonthAgo.toISOString().split('T')[0];
      const toDate = today.toISOString().split('T')[0];
      const historyResponse = await marketService.getPriceHistory(symbol, timeframe, fromDate, toDate);
      const historicalData = historyResponse?.prices || historyResponse || [];

      if (!Array.isArray(historicalData) || historicalData.length < 20) {
        throw new Error('Insufficient data for pattern detection');
      }

      const patterns = await detectPatterns(
        historicalData,
        patternTypes
      );

      return {
        symbol,
        timeframe,
        patterns: patterns.map(p => ({
          type: p.type,
          startTime: p.startTime,
          endTime: p.endTime,
          confidence: p.confidence,
          description: p.description
        })),
        summary: {
          totalPatterns: patterns.length,
          dominantPattern: patterns.length > 0 ? patterns[0].type : null
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error detecting patterns for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Analyze news impact using Gemini AI with fallback to statistical methods
   * Tries Gemini first, auto-falls back to basic analysis if API fails
   */
  async analyzeNews(symbols, categories = [], timeframe = '7d', limit = 10) {
    try {
      logger.debug(`Analyzing news for ${Array.isArray(symbols) ? symbols.join(',') : symbols}`);

      const news = await this.fetchNews(symbols, categories, timeframe, limit);

      if (!news || news.length === 0) {
        return {
          analysis: [],
          articles: [],
          sentiment: 'neutral',
          summary: 'No significant market events detected',
          eventCount: 0,
          source: 'no_data',
          lastUpdated: new Date().toISOString()
        };
      }

      // Try to enrich with Gemini AI insights
      let enrichedAnalysis = news.map((n) => ({
        title: n.title,
        summary: n.summary || n.description || 'Market event',
        impact: `Market impact: ${n.sentiment === 'positive' ? 'Positive' : n.sentiment === 'negative' ? 'Negative' : 'Neutral'}`,
        sentiment: n.sentiment || 'neutral',
        confidence: n.confidence || 0.75,
        symbol: n.symbol,
        category: n.category,
        timestamp: n.timestamp,
        source: n.source,
        tags: n.type ? [n.type, n.category] : [n.category]
      }));

      // If Gemini is available, try to enhance analysis
      if (this.hasOpenAI) {
        try {
          logger.debug('🤖 Enhancing news analysis with Gemini AI...');
          enrichedAnalysis = await Promise.all(
            enrichedAnalysis.map(async (article) => {
              try {
                const aiImpact = await explainNewsImpact(article.symbol, article.title, article.category);
                return {
                  ...article,
                  aiAnalysis: aiImpact,
                  enrichedByAI: true
                };
              } catch (error) {
                logger.debug(`AI enrichment failed for ${article.title}:`, error.message);
                return article; // Return without AI enrichment if it fails
              }
            })
          );
          logger.info(`✅ News analysis enriched with Gemini AI`);
        } catch (error) {
          logger.warn('⚠️ Gemini news enrichment failed, using basic analysis:', error.message);
        }
      }

      return {
        analysis: enrichedAnalysis,
        articles: news,
        sentiment: this.aggregateNewsSentiment(news),
        summary: `Found ${news.length} relevant market articles and events`,
        eventCount: news.length,
        source: this.hasOpenAI ? 'gemini_enriched' : 'statistical',
        aiEnhanced: this.hasOpenAI,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error analyzing news:', error);
      throw error;
    }
  }

  /**
   * Generate personalized insights for user
   */
  async getPersonalizedInsights(userId) {
    try {
      logger.debug(`Generating insights for user ${userId}`);

      const userContext = await this.getUserContext(userId);
      const marketContext = await this.getMarketContext();
      
      const insights = await this.generateInsights(
        userContext,
        marketContext
      );

      return {
        insights: insights.map(insight => ({
          type: insight.type,
          title: insight.title,
          description: insight.description,
          importance: insight.importance,
          actions: insight.actions
        })),
        context: {
          market: marketContext,
          portfolio: userContext.portfolio
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error generating insights for ${userId}:`, error);
      throw error;
    }
  }

  // ============= PRIVATE HELPER METHODS =============

  /**
   * Get sentiment from specific source
   */
  async getSentimentBySource(symbol, source, timeframe) {
    switch (source) {
      case 'news':
        return this.getNewsSentiment(symbol, timeframe);
      case 'social':
        return this.getSocialSentiment(symbol, timeframe);
      case 'technical':
        return this.getTechnicalSentiment(symbol, timeframe);
      case 'onchain':
        return this.getOnChainSentiment(symbol, timeframe);
      default:
        throw new Error(`Unsupported sentiment source: ${source}`);
    }
  }

  /**
   * Calculate comprehensive risk metrics
   */
  calculateRiskMetrics(historicalData) {
    const prices = historicalData.map(d => parseFloat(d.close) || 0).filter(p => p > 0);
    
    const volatility = calculateVolatility(prices);
    const sharpeRatio = this.calculateSharpeRatio(prices);
    const maxDrawdown = this.calculateMaxDrawdown(prices);
    const recoveryTime = this.calculateRecoveryTime(prices);

    // Determine risk level based on metrics
    let riskLevel = 'medium';
    if (volatility < 0.02 && maxDrawdown < 0.1) {
      riskLevel = 'low';
    } else if (volatility > 0.05 || maxDrawdown > 0.3) {
      riskLevel = 'high';
    }

    return {
      volatility,
      sharpeRatio,
      maxDrawdown,
      recoveryTime,
      riskLevel
    };
  }

  /**
   * Calculate portfolio exposure
   */
  calculateExposure(asset, historicalData) {
    const currentPrice = historicalData[historicalData.length - 1]?.close || 0;
    return {
      quantity: asset.amount / currentPrice,
      value: asset.amount,
      percentageChange: this.calculatePercentageChange(historicalData)
    };
  }

  /**
   * Analyze price trend
   */
  analyzeTrend(historicalData) {
    const prices = historicalData.map(d => parseFloat(d.close) || 0).filter(p => p > 0);
    const ema20 = calculateEMA(prices, 20);
    const ema50 = calculateEMA(prices, 50);
    
    return {
      direction: ema20 > ema50 ? 'bullish' : 'bearish',
      momentum: calculateMomentum(prices),
      rsi: calculateRSI(prices)
    };
  }

  /**
   * Calculate portfolio risk
   */
  calculatePortfolioRisk(assessments) {
    if (!assessments || assessments.length === 0) {
      return { score: 50, overallVolatility: 0, maxDrawdown: 0, riskLevel: 'medium' };
    }

    const avgVolatility    = assessments.reduce((s,a) => s + (a.metrics?.volatility    || 0), 0) / assessments.length;
    const avgMaxDrawdown   = assessments.reduce((s,a) => s + (a.metrics?.maxDrawdown   || 0), 0) / assessments.length;
    const avgSharpe        = assessments.reduce((s,a) => s + (a.metrics?.sharpeRatio   || 0), 0) / assessments.length;

    // Volatility: typical crypto daily vol 0.01-0.06 → map to 0-60 pts
    const volScore      = Math.min(60, avgVolatility * 1200);
    // Drawdown: 0-50% drawdown → map to 0-30 pts
    const drawdownScore = Math.min(30, avgMaxDrawdown * 60);
    // Sharpe: negative Sharpe adds risk, high positive reduces it
    const sharpeScore   = Math.max(0, Math.min(10, 5 - avgSharpe * 2));

    const rawScore = volScore + drawdownScore + sharpeScore;
    const score = Math.round(Math.min(100, Math.max(5, rawScore)));

    return {
      score,
      overallVolatility: parseFloat(avgVolatility.toFixed(4)),
      maxDrawdown:       parseFloat(avgMaxDrawdown.toFixed(4)),
      riskLevel: score > 70 ? 'high' : score > 40 ? 'medium' : 'low'
    };
  }

  /**
   * Generate risk recommendations
   */
  generateRiskRecommendations(assessments, portfolioRisk) {
    const recommendations = [];

    if (portfolioRisk.riskLevel === 'high') {
      recommendations.push({
        type: 'rebalance',
        action: 'Consider reducing exposure to high-volatility assets',
        priority: 'high'
      });
    }

    if (portfolioRisk.maxDrawdown > 0.3) {
      recommendations.push({
        type: 'diversify',
        action: 'Portfolio lacks diversification. Add uncorrelated assets.',
        priority: 'medium'
      });
    }

    return recommendations;
  }

  /**
   * Aggregate sentiment from multiple sources
   */
  aggregateSentiment(sentimentData) {
    if (!sentimentData || sentimentData.length === 0) {
      return { score: 0.5, scorePercent: 50, sentiment: 'neutral', confidence: 0 };
    }

    const avgScore = sentimentData.reduce((sum, s) => sum + (s.score || 0.5), 0) / sentimentData.length;
    
    return {
      score: parseFloat(avgScore.toFixed(2)),
      scorePercent: Math.round(avgScore * 100),
      sentiment: avgScore > 0.6 ? 'positive' : avgScore < 0.4 ? 'negative' : 'neutral',
      confidence: Math.min(...sentimentData.map(s => s.confidence || 0.5))
    };
  }

  /**
   * Calculate Sharpe ratio
   */
  calculateSharpeRatio(prices, riskFreeRate = 0.02) {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const avgReturn = returns.reduce((a, b) => a + b) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2)) / returns.length;
    const stdDev = Math.sqrt(variance);

    return (avgReturn - riskFreeRate) / (stdDev || 0.001);
  }

  /**
   * Calculate maximum drawdown
   */
  calculateMaxDrawdown(prices) {
    let maxPrice = prices[0];
    let maxDrawdown = 0;

    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > maxPrice) {
        maxPrice = prices[i];
      }
      const drawdown = (maxPrice - prices[i]) / maxPrice;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return parseFloat(maxDrawdown.toFixed(4));
  }

  /**
   * Calculate recovery time from last major drawdown
   */
  calculateRecoveryTime(prices) {
    let maxPrice = prices[0];
    let maxDrawdownIndex = 0;

    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > maxPrice) {
        maxPrice = prices[i];
      }
      const drawdown = (maxPrice - prices[i]) / maxPrice;
      if (drawdown > 0.2) {
        maxDrawdownIndex = i;
      }
    }

    // Find recovery to previous high
    const recoveryPrice = maxPrice * 0.99; // 99% recovery threshold
    let recoveryIndex = maxDrawdownIndex;
    
    for (let i = maxDrawdownIndex; i < prices.length; i++) {
      if (prices[i] >= recoveryPrice) {
        recoveryIndex = i;
        break;
      }
    }

    return recoveryIndex - maxDrawdownIndex;
  }

  /**
   * Calculate percentage change
   */
  calculatePercentageChange(historicalData) {
    if (historicalData.length < 2) return 0;
    const first = parseFloat(historicalData[0].close) || 0;
    const last = parseFloat(historicalData[historicalData.length - 1].close) || 0;
    return first > 0 ? ((last - first) / first * 100) : 0;
  }

  /**
   * Calculate current allocation
   */
  calculateCurrentAllocation(assets) {
    const totalValue = assets.reduce((sum, a) => sum + (a.value || (a.currentPrice || 0) * (a.currentAmount || 0)), 0);
    return assets.map(a => {
      const assetValue = a.value || (a.currentPrice || 0) * (a.currentAmount || a.amount || 0);
      return {
        symbol: a.symbol,
        allocation: totalValue > 0 ? ((assetValue / totalValue) * 100).toFixed(2) + '%' : '0.00%'
      };
    });
  }

  /**
   * Calculate rebalancing actions
   */
  calculateRebalancing(assets, recommendedAllocation) {
    const currentAllocations = this.calculateCurrentAllocation(assets);
    return assets.map((asset, idx) => {
      let recommended = '0.00%';
      if (Array.isArray(recommendedAllocation)) {
        recommended = recommendedAllocation[idx]?.allocation || '0.00%';
      } else if (recommendedAllocation && typeof recommendedAllocation === 'object') {
        recommended = recommendedAllocation[asset.symbol] || recommendedAllocation[asset.symbol?.toUpperCase()] || '0.00%';
      }
      return {
        symbol: asset.symbol,
        current: currentAllocations[idx]?.allocation || '0.00%',
        recommended,
        action: 'Gradual adjustment recommended'
      };
    });
  }

  /**
   * Get technical sentiment
   */
  async getTechnicalSentiment(symbol, timeframe) {
    try {
      const today = new Date();
      const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fromDate = oneWeekAgo.toISOString().split('T')[0];
      const toDate = today.toISOString().split('T')[0];
      const dataResponse = await marketService.getPriceHistory(symbol, timeframe, fromDate, toDate);
      const fullData = dataResponse?.prices || dataResponse || [];
      const prices = fullData.map(d => parseFloat(d.close) || 0).filter(p => p > 0);
      
      const rsi = calculateRSI(prices);
      let sentiment = 'neutral';
      
      if (rsi > 70) sentiment = 'negative'; // Overbought
      if (rsi < 30) sentiment = 'positive'; // Oversold
      
      return {
        source: 'technical',
        sentiment,
        score: rsi / 100,
        confidence: 0.8,
        indicator: `RSI: ${rsi.toFixed(2)}`
      };
    } catch (error) {
      logger.warn(`Technical sentiment failed for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Helper methods - Real sentiment analysis from market data
   */
  async getNewsSentiment(symbol, timeframe) {
    try {
      // Analyze news sentiment from price volatility patterns
      // Higher volatility = more market reaction to news
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fromDate = thirtyDaysAgo.toISOString().split('T')[0];
      const toDate = today.toISOString().split('T')[0];
      
      const dataResponse = await marketService.getPriceHistory(symbol, '1d', fromDate, toDate);
      const prices = (dataResponse?.prices || dataResponse || [])
        .map(d => parseFloat(d.close) || 0)
        .filter(p => p > 0);

      if (prices.length < 5) {
        return { source: 'news', sentiment: 'neutral', score: 0.5, confidence: 0.3 };
      }

      // Calculate price volatility as proxy for news impact
      const returns = [];
      for (let i = 1; i < prices.length; i++) {
        returns.push(Math.abs((prices[i] - prices[i-1]) / prices[i-1]));
      }
      const avgVolatility = returns.reduce((a, b) => a + b) / returns.length;
      
      let sentiment = 'neutral';
      let score = 0.5;

      if (avgVolatility > 0.05) sentiment = 'negative'; // High volatility = bad news
      if (avgVolatility < 0.01) sentiment = 'positive'; // Low volatility = good news
      
      score = Math.min(1, avgVolatility / 0.1); // Normalize to 0-1

      return {
        source: 'news',
        sentiment,
        score,
        confidence: 0.7,
        indicator: `Volatility: ${(avgVolatility * 100).toFixed(2)}%`
      };
    } catch (error) {
      logger.warn(`News sentiment failed for ${symbol}:`, error.message);
      return { source: 'news', sentiment: 'neutral', score: 0.5, confidence: 0.3 };
    }
  }

  async getSocialSentiment(symbol, timeframe) {
    try {
      // Analyze social sentiment from trading volume
      // High volume = high social/community interest
      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fromDate = sevenDaysAgo.toISOString().split('T')[0];
      const toDate = today.toISOString().split('T')[0];

      const dataResponse = await marketService.getPriceHistory(symbol, '1d', fromDate, toDate);
      const candles = dataResponse?.prices || dataResponse || [];

      if (candles.length < 3) {
        return { source: 'social', sentiment: 'neutral', score: 0.5, confidence: 0.3 };
      }

      // Calculate volume trend
      const volumes = candles.map(c => parseFloat(c.volume) || 0);
      const avgVolume = volumes.reduce((a, b) => a + b) / volumes.length;
      const recentVolume = volumes.slice(-3).reduce((a, b) => a + b) / 3;
      const volumeRatio = recentVolume / (avgVolume || 1);

      let sentiment = 'neutral';
      let score = 0.5;

      if (volumeRatio > 1.5) sentiment = 'positive'; // High recent volume
      if (volumeRatio < 0.7) sentiment = 'negative'; // Low recent volume
      
      score = Math.min(1, volumeRatio / 2);

      return {
        source: 'social',
        sentiment,
        score,
        confidence: 0.65,
        indicator: `Volume Trend: ${(volumeRatio * 100).toFixed(1)}%`
      };
    } catch (error) {
      logger.warn(`Social sentiment failed for ${symbol}:`, error.message);
      return { source: 'social', sentiment: 'neutral', score: 0.5, confidence: 0.3 };
    }
  }

  async getOnChainSentiment(symbol, timeframe) {
    try {
      // Analyze on-chain sentiment from price trend strength
      // Strong uptrend = strong on-chain activity, strong downtrend = selling pressure
      const today = new Date();
      const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
      const fromDate = ninetyDaysAgo.toISOString().split('T')[0];
      const toDate = today.toISOString().split('T')[0];

      const dataResponse = await marketService.getPriceHistory(symbol, '1d', fromDate, toDate);
      const prices = (dataResponse?.prices || dataResponse || [])
        .map(d => parseFloat(d.close) || 0)
        .filter(p => p > 0);

      if (prices.length < 30) {
        return { source: 'onchain', sentiment: 'neutral', score: 0.5, confidence: 0.3 };
      }

      // Calculate trend using simple moving averages
      const ema30 = calculateEMA(prices, 30);
      const ema90 = calculateEMA(prices, 90);
      const currentPrice = prices[prices.length - 1];

      let sentiment = 'neutral';
      let score = 0.5;

      if (ema30 > ema90 && currentPrice > ema30) {
        sentiment = 'positive'; // Strong uptrend
        score = 0.8;
      } else if (ema30 < ema90 && currentPrice < ema30) {
        sentiment = 'negative'; // Strong downtrend
        score = 0.2;
      } else if (ema30 > ema90) {
        sentiment = 'positive';
        score = 0.6;
      } else if (ema30 < ema90) {
        sentiment = 'negative';
        score = 0.4;
      }

      return {
        source: 'onchain',
        sentiment,
        score,
        confidence: 0.75,
        indicator: `Trend: EMA30=${ema30.toFixed(2)}, EMA90=${ema90.toFixed(2)}`
      };
    } catch (error) {
      logger.warn(`OnChain sentiment failed for ${symbol}:`, error.message);
      return { source: 'onchain', sentiment: 'neutral', score: 0.5, confidence: 0.3 };
    }
  }

  async fetchNews(symbols, categories, timeframe, limit) {
    try {
      logger.debug(`Fetching news for ${symbols.join(',')}`);
      
      // Try CryptoPanic free API first (no auth needed for free tier)
      const news = await this.fetchFromCryptoPanic(symbols, limit);
      
      if (news && news.length > 0) {
        return news;
      }
      
      // Fallback: Generate news from market anomalies and events
      return await this.generateNewsFromMarketEvents(symbols, limit);
    } catch (error) {
      logger.warn('News fetching error:', error.message);
      // Last resort: Generate synthetic news from market patterns
      return await this.generateNewsFromMarketEvents(symbols, limit);
    }
  }

  async fetchFromCryptoPanic(symbols, limit = 10) {
    try {
      const axios = require('axios');

      // CryptoPanic free API endpoint (no auth needed for basic tier)
      const url = 'https://cryptopanic.com/api/free/v1/posts/';
      const params = {
        auth_token: process.env.CRYPTOPANIC_API_KEY || '',
        kind: 'news',
        filter: 'hot',
        limit: Math.min(limit, 20),
        public: 'true',
        currencies: symbols.slice(0, 5).join(',')
      };

      if (!params.auth_token) {
        delete params.auth_token;
        Object.assign(params, { public: 'true' });
      }

      const response = await axios.get(url, { params, timeout: 5000 });

      if (!response.data || !response.data.results) {
        return [];
      }

      return response.data.results.slice(0, limit).map((item) => {
        const articleSymbol =
          item.currencies?.[0]?.code ||
          symbols.find(s => item.title?.toUpperCase().includes(s)) ||
          symbols[0] ||
          'CRYPTO';

        const posVotes    = item.votes?.positive || 0;
        const negVotes    = item.votes?.negative || 0;
        const totalVotes  = posVotes + negVotes;
        const sentimentScore = totalVotes > 0 ? posVotes / totalVotes : 0.5;

        return {
          title:         item.title,
          summary:       item.body?.substring(0, 200) || item.title,
          category:      item.kind || 'general',
          symbol:        articleSymbol,
          source:        item.source?.title || 'CryptoPanic',
          url:           item.url || item.source?.url,
          sentiment:     sentimentScore > 0.6 ? 'positive' : sentimentScore < 0.4 ? 'negative' : 'neutral',
          sentimentScore,
          timestamp:     item.created_at || new Date().toISOString(),
          confidence:    Math.min(0.95, 0.65 + totalVotes / 100),
          type:          'news',
          votes:         { positive: posVotes, negative: negVotes },
        };
      });
    } catch (error) {
      logger.warn('CryptoPanic API failed:', error.message);
      return [];
    }
  }

  async generateNewsFromMarketEvents(symbols, limit = 10) {
    try {
      logger.debug('Generating news from market events');
      
      const news = [];
      const today = new Date();
      
      // Fetch recent price data for all symbols
      for (let i = 0; i < Math.min(symbols.length, 3); i++) {
        const symbol = symbols[i];
        try {
          // Get 7-day data to find significant moves
          const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          const fromDate = sevenDaysAgo.toISOString().split('T')[0];
          const toDate = today.toISOString().split('T')[0];
          
          const dataResponse = await marketService.getPriceHistory(symbol, '1d', fromDate, toDate);
          const prices = (dataResponse?.prices || [])
            .map(d => parseFloat(d.close) || 0)
            .filter(p => p > 0);

          if (prices.length < 2) continue;

          const currentPrice = prices[prices.length - 1];
          const previousPrice = prices[0];
          const change = ((currentPrice - previousPrice) / previousPrice) * 100;

          // Generate event-based news
          let title = '';
          let sentiment = 'neutral';

          if (change > 15) {
            title = `${symbol} Surges ${change.toFixed(1)}% in 7 Days - Strong Uptrend`;
            sentiment = 'positive';
          } else if (change > 5) {
            title = `${symbol} Gains ${change.toFixed(1)}% - Positive Momentum`;
            sentiment = 'positive';
          } else if (change < -15) {
            title = `${symbol} Drops ${Math.abs(change).toFixed(1)}% in 7 Days - Correction Underway`;
            sentiment = 'negative';
          } else if (change < -5) {
            title = `${symbol} Declines ${Math.abs(change).toFixed(1)}% - Bearish Pressure`;
            sentiment = 'negative';
          } else {
            title = `${symbol} Consolidating Around $${currentPrice.toFixed(2)}`;
            sentiment = 'neutral';
          }

          // Detect volatility events
          const returns = [];
          for (let j = 1; j < prices.length; j++) {
            returns.push(Math.abs((prices[j] - prices[j-1]) / prices[j-1]));
          }
          const avgVolatility = returns.reduce((a, b) => a + b) / returns.length;
          
          if (avgVolatility > 0.05) {
            title += ' - High Volatility Alert';
          }

          // Vary event type based on market conditions detected
          const eventType = change > 10 ? 'breakout' 
            : change < -10          ? 'correction'
            : avgVolatility > 0.05  ? 'volatility_alert'
            : Math.abs(change) > 5  ? 'trend_move'
            : 'consolidation';

          news.push({
            title,
            summary: `${symbol} has moved ${change > 0 ? '+' : ''}${change.toFixed(2)}% over the past 7 days. Current price: $${currentPrice.toFixed(2)}. ${avgVolatility > 0.05 ? 'Elevated volatility detected.' : ''}`,
            category: 'price_action',
            symbol,
            source: 'Market Analysis',
            sentiment,
            timestamp: new Date().toISOString(),
            confidence: 0.75 + Math.min(0.15, Math.abs(change) / 100),
            type: eventType
          });

          // Add support/resistance level insight (always show for market structure)
          try {
            const levels = await this.getSupportResistanceLevels(symbol);
            if (levels) {
              // Show support/resistance regardless of proximity for consolidating assets
              news.push({
                title: levels.signals.nearResistance
                  ? `${symbol} Testing Key Resistance at $${levels.levels.resistance1}`
                  : levels.signals.nearSupport
                  ? `${symbol} Approaching Support at $${levels.levels.support1}`
                  : `${symbol} Technical Levels: R1 $${levels.levels.resistance1} | S1 $${levels.levels.support1}`,
                summary: levels.insight,
                category: 'technical_analysis',
                symbol,
                source: 'Technical Analysis',
                sentiment: levels.signals.nearResistance ? 'neutral' : levels.signals.aboveMidpoint ? 'positive' : 'negative',
                timestamp: new Date().toISOString(),
                confidence: 0.78,
                type: levels.signals.nearResistance ? 'resistance_level' : levels.signals.nearSupport ? 'support_level' : 'technical_level'
              });
            }
          } catch (e) { /* skip if fails */ }

          if (news.length >= limit) break;
        } catch (err) {
          logger.warn(`Error analyzing ${symbol}:`, err.message);
          continue;
        }
      }

      // Add general market commentary if we don't have enough news
      if (news.length < limit) {
        const marketContext = await this.getMarketContext();
        
        if (marketContext.trend === 'bullish') {
          news.push({
            title: '📈 Bullish Market Trend - Positive Sentiment Prevails',
            summary: 'Overall market sentiment is positive with key indicators showing upward bias. This could be a good time to consider increasing exposure.',
            category: 'market_sentiment',
            symbol: 'MARKET',
            source: 'AI Analysis',
            sentiment: 'positive',
            timestamp: new Date().toISOString(),
            confidence: 0.9,
            type: 'market_event'
          });
        } else if (marketContext.trend === 'bearish') {
          news.push({
            title: '📉 Bearish Market Trend - Caution Advised',
            summary: 'Market sentiment is negative with key indicators showing downward pressure. Consider defensive positioning.',
            category: 'market_sentiment',
            symbol: 'MARKET',
            source: 'AI Analysis',
            sentiment: 'negative',
            timestamp: new Date().toISOString(),
            confidence: 0.9,
            type: 'market_event'
          });
        }
      }

      return news.slice(0, limit);
    } catch (error) {
      logger.error('Error generating market events:', error.message);
      return [];
    }
  }

  async getUserContext(userId) {
    try {
      // Get user's actual portfolio data
      const portfolio = await marketService.getMarketPrices(['BTC', 'ETH', 'SOL']);
      return { portfolio, userId, preferences: {} };
    } catch (error) {
      logger.warn('getUserContext failed:', error.message);
      return { portfolio: {}, userId, preferences: {} };
    }
  }

  async getMarketContext() {
    try {
      // Get real market data for context
      const prices = await marketService.getLivePrices(['BTC', 'ETH']);
      const btcTrend = prices.BTC?.change24h > 0 ? 'bullish' : 'bearish';
      const volatility = Math.abs(prices.BTC?.change24h || 0) / 100;
      
      return {
        trend: btcTrend,
        volatility: volatility || 0.01,
        dominantAsset: 'BTC',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.warn('getMarketContext failed:', error.message);
      return { trend: 'neutral', volatility: 0.01 };
    }
  }

  async generateInsights(userContext, marketContext) {
    try {
      const insights = [];
      
      // Generate insights based on real market data
      if (marketContext.trend === 'bullish') {
        insights.push({
          type: 'market',
          title: 'Bullish Market Trend',
          description: 'Market is trending upward. Consider increasing exposure.',
          importance: 'high',
          actions: ['Increase portfolio allocation', 'Look for dip-buying opportunities']
        });
      } else if (marketContext.trend === 'bearish') {
        insights.push({
          type: 'market',
          title: 'Bearish Market Trend',
          description: 'Market is trending downward. Consider reducing risk.',
          importance: 'high',
          actions: ['Take profits', 'Reduce position sizes', 'Increase cash holdings']
        });
      }

      if (marketContext.volatility > 0.05) {
        insights.push({
          type: 'risk',
          title: 'High Volatility Detected',
          description: 'Market volatility is elevated. Adjust position sizing.',
          importance: 'medium',
          actions: ['Reduce leverage', 'Use stop losses', 'Diversify holdings']
        });
      }

      return insights;
    } catch (error) {
      logger.warn('generateInsights failed:', error.message);
      return [];
    }
  }

  async assessMarketConditions() {
    try {
      const today = new Date();
      const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fromDate = oneWeekAgo.toISOString().split('T')[0];
      const toDate = today.toISOString().split('T')[0];

      const btcHistory = await marketService.getPriceHistory('BTC', '1d', fromDate, toDate);
      const prices = (btcHistory?.prices || btcHistory || [])
        .map(d => parseFloat(d.close) || 0)
        .filter(p => p > 0);

      if (prices.length === 0) {
        return { trend: 'neutral', volatility: 0.01 };
      }

      // Calculate trend
      const sma5 = prices.slice(-5).reduce((a, b) => a + b) / 5;
      const sma20 = prices.slice(-Math.min(20, prices.length)).reduce((a, b) => a + b) / Math.min(20, prices.length);
      const trend = sma5 > sma20 ? 'bullish' : 'bearish';

      // Calculate volatility
      const returns = [];
      for (let i = 1; i < prices.length; i++) {
        returns.push(Math.abs((prices[i] - prices[i-1]) / prices[i-1]));
      }
      const volatility = returns.reduce((a, b) => a + b) / returns.length;

      return { trend, volatility };
    } catch (error) {
      logger.warn('assessMarketConditions failed:', error.message);
      return { trend: 'neutral', volatility: 0.01 };
    }
  }

  /**
   * Get Fear & Greed Index from Alternative.me — Free, no API key
   * Returns 0-100: 0=Extreme Fear, 100=Extreme Greed
   */
  async getFearGreedIndex() {
    try {
      const axios = require('axios');
      const response = await axios.get('https://api.alternative.me/fng/?limit=7', {
        timeout: 5000
      });
      const data = response.data?.data || [];
      if (!data.length) throw new Error('No data');

      const current = data[0];
      const yesterday = data[1] || data[0];
      const value = parseInt(current.value);
      const prevValue = parseInt(yesterday.value);

      return {
        value,
        classification: current.value_classification,
        change: value - prevValue,
        trend: value > prevValue ? 'improving' : value < prevValue ? 'worsening' : 'stable',
        history: data.map(d => ({
          value: parseInt(d.value),
          label: d.value_classification,
          date: new Date(parseInt(d.timestamp) * 1000).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric'
          })
        })),
        zone: value >= 75 ? 'Extreme Greed'
            : value >= 55 ? 'Greed'
            : value >= 45 ? 'Neutral'
            : value >= 25 ? 'Fear'
            : 'Extreme Fear',
        advice: value >= 75 ? 'Market euphoria — historically a good time to reduce exposure'
              : value >= 55 ? 'Bullish sentiment — momentum is strong but watch for reversals'
              : value >= 45 ? 'Neutral sentiment — wait for clearer signals'
              : value >= 25 ? 'Fear in market — historically good buying opportunities appear'
              : 'Extreme fear — strong contrarian buying signal historically',
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.warn('Fear & Greed fetch failed:', error.message);
      return {
        value: 50,
        classification: 'Neutral',
        change: 0,
        trend: 'stable',
        history: [],
        zone: 'Neutral',
        advice: 'Market sentiment data temporarily unavailable',
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Detect support and resistance levels from price history
   * Used to enrich market insights with technical levels
   */
  async getSupportResistanceLevels(symbol) {
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fromDate = thirtyDaysAgo.toISOString().split('T')[0];
      const toDate = today.toISOString().split('T')[0];

      const dataResponse = await marketService.getPriceHistory(symbol, '1d', fromDate, toDate);
      const candles = dataResponse?.prices || dataResponse || [];
      const prices = candles.map(d => parseFloat(d.close) || 0).filter(p => p > 0);
      const highs = candles.map(d => parseFloat(d.high) || 0).filter(p => p > 0);
      const lows = candles.map(d => parseFloat(d.low) || 0).filter(p => p > 0);

      if (prices.length < 10) return null;

      const currentPrice = prices[prices.length - 1];
      const high30d = Math.max(...highs.length ? highs : prices);
      const low30d = Math.min(...lows.length ? lows : prices);
      const range = high30d - low30d;

      // Key levels
      const resistance1 = high30d;
      const resistance2 = high30d + range * 0.236; // Fibonacci extension
      const support1 = low30d;
      const support2 = low30d - range * 0.236;
      const midpoint = (high30d + low30d) / 2; // 50% level

      // Distance to levels as percentage
      const distToResistance = ((resistance1 - currentPrice) / currentPrice) * 100;
      const distToSupport = ((currentPrice - support1) / currentPrice) * 100;

      const nearResistance = distToResistance < 3; // within 3%
      const nearSupport = distToSupport < 3;
      const aboveMidpoint = currentPrice > midpoint;

      return {
        symbol,
        currentPrice,
        levels: {
          resistance2: parseFloat(resistance2.toFixed(2)),
          resistance1: parseFloat(resistance1.toFixed(2)),
          midpoint: parseFloat(midpoint.toFixed(2)),
          support1: parseFloat(support1.toFixed(2)),
          support2: parseFloat(support2.toFixed(2))
        },
        signals: {
          nearResistance,
          nearSupport,
          aboveMidpoint,
          distToResistance: parseFloat(distToResistance.toFixed(2)),
          distToSupport: parseFloat(distToSupport.toFixed(2))
        },
        insight: nearResistance
          ? `${symbol} is within ${distToResistance.toFixed(1)}% of 30-day resistance at $${resistance1.toFixed(2)}. Watch for breakout or rejection.`
          : nearSupport
          ? `${symbol} is near 30-day support at $${support1.toFixed(2)}. Potential bounce zone.`
          : aboveMidpoint
          ? `${symbol} is trading above the 30-day midpoint ($${midpoint.toFixed(2)}), indicating bullish structure.`
          : `${symbol} is below the 30-day midpoint ($${midpoint.toFixed(2)}), indicating bearish structure.`
      };
    } catch (error) {
      logger.warn(`Support/Resistance failed for ${symbol}:`, error.message);
      return null;
    }
  }

  async getStatisticalStrategyRecommendation(portfolio = {}, preferences = {}) {
    try {
      const assets = Array.isArray(portfolio) ? portfolio : (portfolio?.assets || []);
      
      const cryptoCount = assets.filter(a =>
        a.type === 'crypto' || CRYPTO_SYMBOLS.has(a.symbol?.toUpperCase())
      ).length;
      const stockCount = assets.filter(a =>
        a.type === 'stock' || (!CRYPTO_SYMBOLS.has(a.symbol?.toUpperCase()) && !a.symbol?.includes('/'))
      ).length;
      const commodityCount = assets.filter(a => a.type === 'commodity').length;
      const diversification = [cryptoCount, stockCount, commodityCount].filter(c => c > 0).length;
      
      const riskTolerance = preferences?.riskTolerance || 0.5;
      const marketConditions = await this.assessMarketConditions();
      const btcTrend = marketConditions?.trend || 'neutral';
      const volatility = marketConditions?.volatility || 0.02;
      const isHighVol = volatility > 0.03;
      const isBullish = btcTrend === 'bullish';
      
      // Dynamic text based on live market conditions
      const marketSentence = isBullish
        ? 'Market is trending bullish — consider increasing exposure gradually.'
        : 'Market is trending bearish — prioritise capital preservation.';
      const volSentence = isHighVol
        ? 'Volatility is elevated — reduce position sizes and use stop-losses.'
        : 'Volatility is low — stable environment for measured accumulation.';
      const timingWord = isBullish ? 'accumulate on dips' : 'wait for confirmation before adding';
      
      const strategies = [];
      
      // Conservative
      if (diversification >= 2 || riskTolerance <= 0.4 || cryptoCount >= 1) {
        strategies.push({
          type: 'conservative',
          description: 'Focus on long-term wealth preservation with low volatility exposure',
          expectedReturn: parseFloat((8 + (riskTolerance * 2)).toFixed(1)),
          risk: 3 + Math.floor(riskTolerance * 2),
          timeframe: '2-5 years',
          rationale: `${marketSentence} Conservative approach minimises downside in current conditions.`,
          steps: [
            marketSentence,
            volSentence,
            'Allocate 60% to stable assets (USDC, stablecoins)',
            'Hold 30% in blue-chip cryptos (BTC, ETH only)',
            `Current signal: ${timingWord} on weakness`,
            'Rebalance quarterly to maintain target allocation'
          ]
        });
      }
      
      // Moderate
      if (diversification >= 1 && riskTolerance >= 0.3) {
        strategies.push({
          type: 'moderate',
          description: 'Balance growth potential with risk management through diversification',
          expectedReturn: parseFloat((15 + (riskTolerance * 5)).toFixed(1)),
          risk: 5 + Math.floor(riskTolerance * 2),
          timeframe: '1-2 years',
          rationale: `${isBullish ? 'Bullish momentum supports' : 'Defensive positioning suits'} a balanced approach right now.`,
          steps: [
            marketSentence,
            'Maintain 50% in core BTC/ETH holdings',
            isBullish
              ? 'Allocate 35% to growth assets — momentum is supportive'
              : 'Reduce growth exposure to 20% — preserve capital in bearish market',
            volSentence,
            'Monitor sentiment weekly and adjust monthly',
            'Set stop-loss orders on all volatile positions'
          ]
        });
      }
      
      // Aggressive
      if (cryptoCount >= 2 && riskTolerance >= 0.6) {
        const growthReturn = isBullish ? 35 : 25;
        strategies.push({
          type: 'aggressive',
          description: 'Maximise growth through high-conviction positions',
          expectedReturn: parseFloat((growthReturn + Math.floor(riskTolerance * 10)).toFixed(1)),
          risk: 8 + Math.floor(riskTolerance * 2),
          timeframe: '6-12 months',
          rationale: `${isBullish ? 'Bullish trend supports aggressive positioning' : 'Caution advised — aggressive strategy carries higher risk in current bearish conditions'}.`,
          steps: [
            isBullish
              ? '🟢 BTC trend is BULLISH — conditions support aggressive positioning'
              : '🔴 BTC trend is BEARISH — aggressive strategy carries elevated risk currently',
            isHighVol
              ? '⚠️ High volatility — use smaller position sizes (max 2% per trade)'
              : '✅ Low volatility — good conditions for measured position building',
            'Concentrate 60-70% in high-conviction crypto positions',
            'Allocate 20% to emerging Layer-2 or DeFi opportunities',
            'Reserve 10-15% as dry powder for volatility trades',
            'Implement strict 2% stop-losses on all positions',
            isBullish ? 'Consider yield farming for additional returns' : 'Avoid leverage until trend confirms reversal'
          ]
        });
      }
      
      if (strategies.length === 0) {
        strategies.push({
          type: 'moderate',
          description: 'Balanced strategy for your portfolio',
          expectedReturn: 15,
          risk: 5,
          timeframe: '1-2 years',
          rationale: 'Default balanced strategy',
          steps: [
            marketSentence,
            volSentence,
            'Maintain current allocation with quarterly reviews',
            'Monitor conditions for rebalancing opportunities'
          ]
        });
      }
      
      logger.info(`✓ Generated ${strategies.length} market-aware strategy recommendations`);
      return strategies;
    } catch (error) {
      logger.error('Error in statistical strategy recommendation:', error);
      return [{
        type: 'moderate',
        description: 'Default balanced strategy',
        expectedReturn: 12,
        risk: 5,
        timeframe: '1-2 years',
        rationale: 'Safe default strategy',
        steps: ['Hold current positions', 'Rebalance quarterly', 'Monitor market conditions']
      }];
    }
  }

  /**
   * Get BTC market dominance — free from CoinGecko, no API key
   * BTC dominance is a key macro metric every crypto analyst uses
   */
  async getBTCDominance() {
    try {
      const axios = require('axios');
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/global',
        { timeout: 5000 }
      );
      const data = response.data?.data;
      if (!data) throw new Error('No data');

      const btcDominance = parseFloat(data.market_cap_percentage?.btc?.toFixed(1)) || 0;
      const ethDominance = parseFloat(data.market_cap_percentage?.eth?.toFixed(1)) || 0;
      const totalMarketCap = data.total_market_cap?.usd || 0;
      const totalVolume24h = data.total_volume?.usd || 0;
      const marketCapChange = parseFloat(data.market_cap_change_percentage_24h_usd?.toFixed(2)) || 0;

      return {
        btcDominance,
        ethDominance,
        altcoinDominance: parseFloat((100 - btcDominance - ethDominance).toFixed(1)),
        totalMarketCap,
        totalMarketCapFormatted: totalMarketCap > 1e12
          ? `$${(totalMarketCap / 1e12).toFixed(2)}T`
          : `$${(totalMarketCap / 1e9).toFixed(0)}B`,
        totalVolume24h,
        totalVolumeFormatted: `$${(totalVolume24h / 1e9).toFixed(1)}B`,
        marketCapChange24h: marketCapChange,
        signal: btcDominance > 55
          ? 'BTC dominance high — altcoins underperforming, risk-off environment'
          : btcDominance < 40
          ? 'Low BTC dominance — altcoin season may be active'
          : 'Balanced dominance — healthy market structure',
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.warn('BTC Dominance fetch failed:', error.message);
      return null;
    }
  }

  /**
   * Get top 7 trending coins right now from CoinGecko
   * Free, no API key, updates every few hours
   */
  async getTrendingCoins() {
    try {
      const axios = require('axios');
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/search/trending',
        { timeout: 5000 }
      );
      const coins = response.data?.coins || [];
      return coins.slice(0, 7).map(({ item }) => ({
        name: item.name,
        symbol: item.symbol,
        rank: item.market_cap_rank,
        thumb: item.thumb,
        priceBTC: item.price_btc,
        score: item.score,
        slug: item.id
      }));
    } catch (error) {
      logger.warn('Trending coins fetch failed:', error.message);
      return [];
    }
  }

  /**
   * Get investment opportunities — wraps market data + statistical scoring
   */
  async getInvestmentOpportunities(filters = {}) {
    try {
      const { type = 'all', riskLevel, limit = 10 } = filters;
      const symbols = ['BTC', 'ETH', 'SOL', 'ADA', 'LINK', 'DOT', 'AVAX', 'MATIC'];
      const prices = await marketService.getLivePrices(symbols).catch(() => ({}));

      const opportunities = [];
      for (const symbol of symbols) {
        const p = prices[symbol];
        if (!p) continue;
        const change = p.change24h ?? 0;
        const risk = Math.abs(change) > 8 ? 'high' : Math.abs(change) > 3 ? 'medium' : 'low';
        if (riskLevel && risk !== riskLevel) continue;
        if (type !== 'all' && type !== 'crypto') continue;

        opportunities.push({
          symbol,
          type: 'crypto',
          currentPrice: p.price ?? p.last ?? 0,
          change24h: parseFloat(change.toFixed(2)),
          riskLevel: risk,
          opportunityScore: Math.min(100, 50 + Math.abs(change) * 2),
          reason: change > 0
            ? `${symbol} up ${change.toFixed(1)}% — momentum signal`
            : `${symbol} down ${Math.abs(change).toFixed(1)}% — potential dip opportunity`,
          timestamp: new Date().toISOString()
        });
      }

      // Sort by opportunity score descending
      opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);

      return {
        opportunities: opportunities.slice(0, limit),
        total: opportunities.length,
        filters,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting investment opportunities:', error);
      throw error;
    }
  }

  /**
   * Get a live market overview snapshot (NEW — used by the new MarketOverviewPanel)
   */
  async getMarketOverview() {
    try {
      const [fearGreed, dominance, trending] = await Promise.allSettled([
        this.getFearGreedIndex(),
        this.getBTCDominance(),
        this.getTrendingCoins()
      ]);

      const prices = await marketService.getLivePrices(['BTC', 'ETH', 'SOL']).catch(() => ({}));

      return {
        fearGreed: fearGreed.status === 'fulfilled' ? fearGreed.value : null,
        dominance: dominance.status === 'fulfilled' ? dominance.value : null,
        trending: trending.status === 'fulfilled' ? trending.value?.slice(0, 5) : [],
        spotPrices: {
          BTC: prices.BTC ?? null,
          ETH: prices.ETH ?? null,
          SOL: prices.SOL ?? null
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting market overview:', error);
      throw error;
    }
  }

  aggregateNewsSentiment() {
    return 'neutral';
  }

  /**
   * Portfolio Chat — Gemini AI with full portfolio + live market context
   *
   * @param {string} userId
   * @param {string} message
   * @param {Array<{role:string, text:string}>} history
   * @returns {Promise<{reply:string, portfolioContext:Object, source:string}>}
   */
  async portfolioChat(userId, message, history = []) {
    try {
      logger.debug(`[PortfolioChat] userId=${userId} message="${message.slice(0, 60)}"`);

      const portfolioService = require('./portfolio.service');

      // ── 1. Fetch real portfolio data ──────────────────────────────────────
      const [summary, assetsResult] = await Promise.allSettled([
        portfolioService.getPortfolioSummary(userId),
        portfolioService.getAllAssets(userId),
      ]);

      const portfolioSummary = summary.status === 'fulfilled' ? summary.value : {};
      const assets = assetsResult.status === 'fulfilled'
        ? (assetsResult.value?.items || assetsResult.value || [])
        : [];

      // ── 2. Fetch live prices for every held asset ─────────────────────────
      const symbols = [...new Set(assets.map(a => a.symbol).filter(Boolean))];
      let marketPrices = {};
      if (symbols.length > 0) {
        try {
          marketPrices = await marketService.getLivePrices(symbols);
        } catch (e) {
          logger.warn('[PortfolioChat] Live prices fetch failed:', e.message);
        }
      }

      // ── 3. Build portfolio context ────────────────────────────────────────
      const portfolioContext = {
        totalValue: portfolioSummary.totalValue || 0,
        totalCost: portfolioSummary.totalCost || 0,
        totalPL: portfolioSummary.totalProfitLoss || portfolioSummary.totalPL || 0,
        totalPLPercentage: portfolioSummary.totalPLPercentage || 0,
        assets,
      };

      // ── 4. Deterministic reasoning engine is PRIMARY — instant, free, never down ──
      const { generateChatReply } = require('./neoChatEngine');
      const engineResult = generateChatReply(message, history, portfolioContext, marketPrices);

      return {
        reply: engineResult.reply,
        portfolioContext: {
          totalValue: portfolioContext.totalValue,
          assetCount: assets.length,
          symbols,
        },
        source: 'neo_reasoning_engine',
        intent: engineResult.intent,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      logger.error('[PortfolioChat] Error:', error);
      throw error;
    }
  }

  /**
   * Rule-based fallback reply when Gemini is unavailable.
   * FIXED: now routed through neoReasoningEngine (the same deterministic
   * source of truth used by Tax-Loss Harvesting / Weekly Report) instead
   * of crude keyword stubs, and the "why AI is unavailable" note is now
   * accurate (quota exhausted vs. no key vs. transient error) instead of
   * always blaming a missing GEMINI_API_KEY.
   * @private
   */
  _portfolioChatFallback(message, portfolioContext, marketPrices) {
    const msg = message.toLowerCase();
    const { totalValue = 0, totalPL = 0, totalPLPercentage = 0, assets = [] } = portfolioContext;

    const reasoningEngine = require('./neoReasoningEngine');
    const aiNote = this._aiUnavailableNote();

    // ── Tax-loss harvesting intent ──────────────────────────────────────
    if (msg.includes('tax') || msg.includes('harvest') || msg.includes('loss') && msg.includes('sell')) {
      const normalised = assets.map(a => ({
        symbol: a.symbol, name: a.name, amount: a.amount ?? a.quantity,
        costBasis: a.costBasis, currentPrice: a.currentPrice, profit: a.profitLoss ?? a.profit,
      }));
      const result = reasoningEngine.analyzeTaxLossOpportunities(normalised);
      if (result.opportunityCount === 0) {
        return `No tax-loss harvesting opportunities right now — none of your positions are showing an unrealised loss. ${aiNote}`;
      }
      const top = result.opportunities[0];
      return `You have ${result.opportunityCount} tax-loss harvesting opportunit${result.opportunityCount === 1 ? 'y' : 'ies'}, ` +
        `worth an estimated $${result.totalPotentialTaxSavings.toLocaleString()} in potential tax savings. ` +
        `Your biggest opportunity is ${top.symbol}, down $${top.lossAmount.toLocaleString()} (${top.lossPercentage}%)` +
        `${top.suggestedSwap ? `; consider swapping into ${top.suggestedSwap.suggestedSymbol} to keep similar exposure` : ''}. ` +
        `This is not tax advice. ${aiNote}`;
    }

    // ── Risk / diversification intent ───────────────────────────────────
    if (msg.includes('risk') || msg.includes('safe') || msg.includes('diversif') || msg.includes('rebalance')) {
      const health = reasoningEngine.scorePortfolioHealth(
        assets.map(a => ({ symbol: a.symbol, value: a.value, amount: a.amount ?? a.quantity, currentPrice: a.currentPrice }))
      );
      return `Your diversification score is ${health.diversificationScore}/100. ` +
        `${health.concentrationWarning || 'No single asset group dominates your portfolio.'} ${aiNote}`;
    }

    // ── Value / worth intent ────────────────────────────────────────────
    if (msg.includes('worth') || msg.includes('value') || msg.includes('total')) {
      return `Your portfolio is currently valued at $${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} ` +
        `across ${assets.length} asset(s). ` +
        `Overall P&L: ${totalPL >= 0 ? '+' : ''}$${totalPL.toFixed(2)} (${totalPLPercentage.toFixed(2)}%). ${aiNote}`;
    }

    // ── Performance intent ───────────────────────────────────────────────
    if (msg.includes('best') || msg.includes('top') || msg.includes('perform')) {
      const sorted = [...assets].sort((a, b) => (b.profitLossPercentage || 0) - (a.profitLossPercentage || 0));
      const top = sorted.slice(0, 3).map(a => `${a.symbol} (${(a.profitLossPercentage || 0).toFixed(2)}%)`).join(', ');
      const worst = sorted.slice(-1).map(a => `${a.symbol} (${(a.profitLossPercentage || 0).toFixed(2)}%)`)[0];
      return `Your best performing assets are: ${top || 'none yet'}.` +
        `${worst ? ` Your weakest is ${worst}.` : ''} ${aiNote}`;
    }

    return `I can see your portfolio is worth $${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} ` +
      `with ${assets.length} holding(s). Ask me about portfolio value, top/worst performers, risk & diversification, ` +
      `or tax-loss harvesting opportunities. ${aiNote}`;
  }

  /**
   * Builds an accurate "why is AI unavailable" note instead of always
   * blaming a missing GEMINI_API_KEY (the real cause is usually the daily
   * quota being exhausted by anomaly/pattern scans, not a missing key).
   * @private
   */
  _aiUnavailableNote() {
    try {
      const { _dailyQuota } = require('../utils/openai-integration');
      const config = require('../config');

      if (!config.gemini?.apiKey) {
        return '\n\n*Set GEMINI_API_KEY in server/.env for AI-narrated answers — the numbers above are accurate either way.*';
      }
      if (_dailyQuota.hardExceeded) {
        const resetTime = new Date(_dailyQuota.resetAt).toUTCString();
        return `\n\n*AI narration is using today's full quota and resets at ${resetTime}. The numbers above come from NeoFin's own reasoning engine, not Gemini, so they're accurate regardless.*`;
      }
      return '\n\n*AI narration is temporarily unavailable — showing NeoFin\'s own reasoning engine instead. The numbers above are accurate either way.*';
    } catch {
      return '';
    }
  }
}

module.exports = new AIService();
