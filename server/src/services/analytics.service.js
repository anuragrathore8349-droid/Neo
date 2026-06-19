const OpenAI = require('openai');
const Portfolio = require('../models/portfolio.model');
const marketService = require('./market.service');
const { logger } = require('../api/middlewares/logger.middleware');
const { calculateMetrics } = require('../utils/calculations');
const { predictPrices } = require('../utils/predictions');
const { analyzeSentiment } = require('../utils/sentiment');

class AnalyticsService {
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey !== 'your-openai-api-key-here') {
      this.openai = new OpenAI({
        apiKey: apiKey
      });
    } else {
      this.openai = null;
      console.warn('OpenAI API key not configured. AI features will be limited.');
    }
  }

  async getPerformanceAnalytics(userId, timeframe, metrics) {
    try {
      const portfolio = await Portfolio.findOne({ userId });
      if (!portfolio) {
        throw new Error('Portfolio not found');
      }

      const performanceData = await this.calculatePerformanceMetrics(
        portfolio,
        timeframe,
        metrics
      );

      return {
        timeframe,
        metrics: performanceData,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error getting performance analytics:', error);
      throw error;
    }
  }

  async getRiskAssessment(userId, assets = [], timeframe) {
    try {
      const portfolio = await Portfolio.findOne({ userId });
      if (!portfolio) {
        throw new Error('Portfolio not found');
      }

      const assetsToAnalyze = assets.length > 0
        ? portfolio.assets.filter(asset => assets.includes(asset.symbol))
        : portfolio.assets;

      const riskMetrics = await this.calculateRiskMetrics(
        assetsToAnalyze,
        timeframe
      );

      return {
        overall: this.aggregateRiskMetrics(riskMetrics),
        assets: riskMetrics,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error getting risk assessment:', error);
      throw error;
    }
  }

  async getPricePredictions(symbol, timeframe) {
    try {
      const historicalData = await marketService.getPriceHistory(
        symbol,
        timeframe
      );

      const predictions = await predictPrices(historicalData);
      const insights = await this.generatePredictionInsights(
        symbol,
        predictions
      );

      return {
        symbol,
        timeframe,
        predictions,
        insights,
        confidence: predictions.confidence,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error getting price predictions:', error);
      throw error;
    }
  }

  async getMarketSentiment(symbol, sources) {
    try {
      const sentimentData = await Promise.all(
        sources.map(source => this.getSentimentBySource(symbol, source))
      );

      const aggregatedSentiment = this.aggregateSentiment(sentimentData);

      return {
        symbol,
        overall: aggregatedSentiment,
        sources: sentimentData,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error getting market sentiment:', error);
      throw error;
    }
  }

  async getInvestmentOpportunities(userId, type, filters) {
    try {
      let opportunities = [];

      if (type === 'all' || type === 'trading') {
        const tradingOpps = await this.findTradingOpportunities(filters);
        opportunities.push(...tradingOpps);
      }

      if (type === 'all' || type === 'defi') {
        const defiOpps = await this.findDefiOpportunities(filters);
        opportunities.push(...defiOpps);
      }

      opportunities.sort((a, b) => b.potentialReturn - a.potentialReturn);

      return {
        opportunities,
        count: opportunities.length,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error getting investment opportunities:', error);
      throw error;
    }
  }

  async generateCustomReport(userId, reportConfig) {
    try {
      const reportSections = await Promise.all(
        reportConfig.sections.map(section => this.generateReportSection(
          userId,
          section
        ))
      );

      const report = {
        title: reportConfig.title,
        timestamp: new Date(),
        sections: reportSections
      };

      if (reportConfig.schedule) {
        await this.scheduleReport(userId, reportConfig);
      }

      return report;
    } catch (error) {
      logger.error('Error generating custom report:', error);
      throw error;
    }
  }

  // Private helper methods
  async calculatePerformanceMetrics(portfolio, timeframe, metrics) {
    const historicalData = await this.getHistoricalPortfolioData(portfolio, timeframe);
    
    const performanceMetrics = {};
    
    for (const metric of metrics) {
      switch (metric) {
        case 'returns':
          performanceMetrics.returns = this.calculateReturns(historicalData);
          break;
        case 'volatility':
          performanceMetrics.volatility = this.calculateVolatility(historicalData);
          break;
        case 'sharpe_ratio':
          performanceMetrics.sharpeRatio = this.calculateSharpeRatio(historicalData);
          break;
        case 'sortino_ratio':
          performanceMetrics.sortinoRatio = this.calculateSortinoRatio(historicalData);
          break;
        case 'max_drawdown':
          performanceMetrics.maxDrawdown = this.calculateMaxDrawdown(historicalData);
          break;
      }
    }
    
    return performanceMetrics;
  }

  async calculateRiskMetrics(assets, timeframe) {
    const riskMetrics = await Promise.all(assets.map(async (asset) => {
      const historicalData = await marketService.getPriceHistory(
        asset.symbol,
        timeframe
      );

      return {
        symbol: asset.symbol,
        volatility: this.calculateVolatility(historicalData),
        var: this.calculateValueAtRisk(historicalData),
        beta: await this.calculateBeta(historicalData),
        correlations: await this.calculateCorrelations(asset.symbol, assets),
        riskContribution: this.calculateRiskContribution(asset, assets)
      };
    }));

    return riskMetrics;
  }

  aggregateRiskMetrics(metrics) {
    return {
      portfolioVolatility: this.calculatePortfolioVolatility(metrics),
      portfolioVar: this.calculatePortfolioVaR(metrics),
      diversificationScore: this.calculateDiversificationScore(metrics),
      riskScore: this.calculateRiskScore(metrics)
    };
  }

  async getSentimentBySource(symbol, source) {
    switch (source) {
      case 'news':
        return await this.getNewsSentiment(symbol);
      case 'social':
        return await this.getSocialSentiment(symbol);
      case 'technical':
        return await this.getTechnicalSentiment(symbol);
      case 'onchain':
        return await this.getOnChainSentiment(symbol);
      default:
        throw new Error(`Unsupported sentiment source: ${source}`);
    }
  }

  async getNewsSentiment(symbol) {
    const newsArticles = await this.fetchNewsArticles(symbol);
    const sentiments = await Promise.all(
      newsArticles.map(article => analyzeSentiment(article.content))
    );
    
    return {
      source: 'news',
      score: this.averageSentiments(sentiments),
      articles: newsArticles.length,
      timestamp: new Date()
    };
  }

  async getSocialSentiment(symbol) {
    const socialPosts = await this.fetchSocialPosts(symbol);
    const sentiments = await Promise.all(
      socialPosts.map(post => analyzeSentiment(post.content))
    );
    
    return {
      source: 'social',
      score: this.averageSentiments(sentiments),
      posts: socialPosts.length,
      timestamp: new Date()
    };
  }

  async getTechnicalSentiment(symbol) {
    const technicalIndicators = await this.calculateTechnicalIndicators(symbol);
    return {
      source: 'technical',
      score: this.aggregateTechnicalSignals(technicalIndicators),
      indicators: technicalIndicators,
      timestamp: new Date()
    };
  }

  async getOnChainSentiment(symbol) {
    const metrics = await this.fetchOnChainMetrics(symbol);
    return {
      source: 'onchain',
      score: this.calculateOnChainSentiment(metrics),
      metrics,
      timestamp: new Date()
    };
  }

  aggregateSentiment(sentimentData) {
    const weights = {
      news: 0.3,
      social: 0.2,
      technical: 0.3,
      onchain: 0.2
    };

    let weightedScore = 0;
    let totalWeight = 0;

    sentimentData.forEach(data => {
      const weight = weights[data.source];
      weightedScore += data.score * weight;
      totalWeight += weight;
    });

    return {
      score: weightedScore / totalWeight,
      label: this.getSentimentLabel(weightedScore / totalWeight),
      confidence: this.calculateAggregateConfidence(sentimentData)
    };
  }

  async findTradingOpportunities(filters) {
    const assets = await this.getAnalyzedAssets();
    const opportunities = [];

    for (const asset of assets) {
      const metrics = await this.analyzeAssetOpportunity(asset);
      
      if (this.meetsOpportunityFilters(metrics, filters)) {
        opportunities.push({
          type: 'trading',
          asset: asset.symbol,
          metrics,
          potentialReturn: metrics.expectedReturn,
          risk: metrics.risk,
          confidence: metrics.confidence,
          strategy: await this.generateTradingStrategy(asset, metrics)
        });
      }
    }

    return opportunities;
  }

  async findDefiOpportunities(filters) {
    const protocols = await this.getDefiProtocols();
    const opportunities = [];

    for (const protocol of protocols) {
      const pools = await this.analyzeDefiPools(protocol);
      
      for (const pool of pools) {
        const metrics = await this.analyzePoolOpportunity(pool);
        
        if (this.meetsOpportunityFilters(metrics, filters)) {
          opportunities.push({
            type: 'defi',
            protocol: protocol.name,
            pool: pool.name,
            metrics,
            potentialReturn: metrics.apy,
            risk: metrics.risk,
            confidence: metrics.confidence,
            strategy: await this.generateDefiStrategy(pool, metrics)
          });
        }
      }
    }

    return opportunities;
  }

  async generateReportSection(userId, section) {
    switch (section.type) {
      case 'performance':
        return {
          type: 'performance',
          title: 'Performance Analysis',
          data: await this.getPerformanceAnalytics(
            userId,
            section.params?.timeframe || '1m',
            section.params?.metrics
          )
        };
      case 'risk':
        return {
          type: 'risk',
          title: 'Risk Assessment',
          data: await this.getRiskAssessment(
            userId,
            section.params?.assets,
            section.params?.timeframe
          )
        };
      case 'predictions':
        return {
          type: 'predictions',
          title: 'Price Predictions',
          data: await this.getPricePredictions(
            section.params.symbol,
            section.params?.timeframe
          )
        };
      case 'sentiment':
        return {
          type: 'sentiment',
          title: 'Market Sentiment',
          data: await this.getMarketSentiment(
            section.params.symbol,
            section.params?.sources
          )
        };
      case 'opportunities':
        return {
          type: 'opportunities',
          title: 'Investment Opportunities',
          data: await this.getInvestmentOpportunities(
            userId,
            section.params?.type,
            section.params?.filters
          )
        };
      default:
        throw new Error(`Unsupported report section type: ${section.type}`);
    }
  }

  async generatePredictionInsights(symbol, predictions) {
    // Generate AI-powered insights about price predictions
    // This is a placeholder - implement with OpenAI API when needed
    return {
      trend: predictions.trend || 'neutral',
      confidence: predictions.confidence || 0.5,
      keyFactors: ['market_sentiment', 'technical_indicators'],
      recommendation: 'hold'
    };
  }
}

module.exports = new AnalyticsService();