const axios = require('axios');
const { logger } = require('../api/middlewares/logger.middleware');
const config = require('../config');

/**
 * OpenAI Integration for Financial Insights
 * Provides human-readable explanations of market anomalies and patterns
 * No ML framework dependency - uses LLM API calls
 * 
 * INCLUDES: Rate limiting, exponential backoff, and request queuing
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// ============= RATE LIMITING & QUEUE MANAGEMENT =============
class RequestQueue {
  constructor(maxConcurrent = 1, minDelayMs = 500) {
    this.queue = [];
    this.running = 0;
    this.maxConcurrent = maxConcurrent;
    this.minDelayMs = minDelayMs;
    this.lastRequestTime = 0;
  }

  async add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { task, resolve, reject } = this.queue.shift();

    // Enforce minimum delay between requests
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.minDelayMs) {
      await new Promise(r => setTimeout(r, this.minDelayMs - timeSinceLastRequest));
    }

    try {
      this.lastRequestTime = Date.now();
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.process();
    }
  }
}

// Calculate minimum delay based on rate limit from config
// If 3 RPM (requests per minute), delay = 60000ms / 3 = 20000ms
// For free tier, add extra buffer (multiply by 1.5) to be extra safe
const rateLimitRPM = config.openai?.rateLimitRPM || 3;
const baseDelayMs = Math.ceil((60 * 1000) / rateLimitRPM);
const minDelayMs = rateLimitRPM < 10 ? Math.ceil(baseDelayMs * 1.5) : baseDelayMs;

// Initialize request queue: max 1 concurrent request, respecting rate limits
const requestQueue = new RequestQueue(1, minDelayMs);

// Log the rate limit configuration on startup
logger.info(`📊 OpenAI Rate Limiter: ${rateLimitRPM} RPM (${minDelayMs}ms delay between requests)`);

// ============= IN-MEMORY RESPONSE CACHE =============
// Simple in-memory cache (survives process restarts with Redis, but memory is fine for now)
const responseCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const getCached = (key) => {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
};

const setCache = (key, value) => {
  responseCache.set(key, { value, ts: Date.now() });
};

/**
 * Retry logic with exponential backoff for rate limit errors
 */
const retryWithBackoff = async (fn, maxRetries = 3) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if it's a rate limit error (429)
      if (error.response?.status === 429) {
        // Extract retry-after header if available
        const retryAfter = error.response.headers['retry-after'];
        let delayMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
        
        // Cap the delay at 30 seconds
        delayMs = Math.min(delayMs, 30000);
        
        if (attempt < maxRetries) {
          logger.warn(`⚠️ Rate limit hit. Retrying in ${delayMs}ms... (Attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
      }
      
      // For non-rate-limit errors, don't retry
      throw error;
    }
  }
  
  throw lastError;
};

/**
 * Get OpenAI insights for detected anomalies
 */
const getOpenAIInsights = async (anomaly) => {
  if (!config.openai?.apiKey) {
    logger.warn('⚠️ OpenAI API key not configured. Returning basic explanation.');
    return getBasicExplanation(anomaly);
  }

  const prompt = buildAnomalyPrompt(anomaly);
  const fallback = getBasicExplanation(anomaly);
  
  return callOpenAIWithRetry(
    () => callOpenAI(prompt, 'concise'),
    fallback,
    2
  ) || fallback;
};

/**
 * Get sentiment analysis using OpenAI
 * Replaces Natural.js for more accurate market sentiment
 */
const getSentimentAnalysis = async (symbol, content) => {
  if (!config.openai?.apiKey) {
    return {
      sentiment: 'neutral',
      score: 0.5,
      confidence: 0.5,
      reason: 'OpenAI not configured'
    };
  }

  const prompt = buildSentimentPrompt(symbol, content);
  const fallback = {
    sentiment: 'neutral',
    score: 0.5,
    confidence: 0.3,
    reason: 'Analysis unavailable'
  };

  const response = await callOpenAIWithRetry(
    () => callOpenAI(prompt, 'json'),
    fallback,
    2
  );

  return response ? parseSentimentResponse(response) : fallback;
};

/**
 * Generate investment strategy recommendations
 */
const generateStrategyRecommendation = async (portfolio, marketConditions) => {
  if (!config.openai?.apiKey) {
    return generateBasicStrategy(portfolio);
  }

  const prompt = buildStrategyPrompt(portfolio, marketConditions);
  const fallback = generateBasicStrategy(portfolio);

  const response = await callOpenAIWithRetry(
    () => callOpenAI(prompt, 'json'),
    fallback,
    2
  );

  return response ? parseStrategyResponse(response) : fallback;
};

/**
 * Explain news impact on market
 * NOTE: Non-critical feature - uses simpler fallback to avoid rate limit issues
 */
const explainNewsImpact = async (symbol, newsTitle, category) => {
  try {
    if (!config.openai?.apiKey) {
      return buildNewsImpactFallback(symbol, newsTitle, category);
    }

    // Queue handles rate limiting — no need to skip based on RPM config
    const prompt = buildNewsPrompt(symbol, newsTitle, category);
    const response = await callOpenAIWithRetry(
      () => callOpenAI(prompt, 'concise'),
      buildNewsImpactFallback(symbol, newsTitle, category),
      2
    );

    return response || buildNewsImpactFallback(symbol, newsTitle, category);
  } catch (error) {
    logger.warn(`⚠️ Failed to explain news impact for ${symbol}:`, error.message);
    return buildNewsImpactFallback(symbol, newsTitle, category);
  }
};

// ============= INTERNAL HELPERS =============

/**
 * Build prompt for anomaly explanation
 */
const buildAnomalyPrompt = (anomaly) => {
  return `In one sentence, explain why ${anomaly.symbol} might show a ${anomaly.type} with z-score ${anomaly.zScore} (mean: ${anomaly.mean}, value: ${anomaly.value}). Be concise and financial.`;
};

/**
 * Build prompt for sentiment analysis
 */
const buildSentimentPrompt = (symbol, content) => {
  return `Analyze sentiment about ${symbol} from this text: "${content}". 
  Return JSON: {sentiment: "positive"|"negative"|"neutral", score: 0-1, confidence: 0-1}`;
};

/**
 * Build prompt for strategy recommendation
 */
const buildStrategyPrompt = (portfolio, conditions) => {
  return `Given portfolio: ${JSON.stringify(portfolio)} and market conditions: ${JSON.stringify(conditions)}
  
  Return a JSON ARRAY of 1-3 strategy objects. Each object must have:
  { type: "conservative"|"moderate"|"aggressive", description: string, expectedReturn: number (%), 
    risk: number (1-10), timeframe: string, rationale: string, steps: string[] }
  
  Return ONLY the JSON array, no explanation.`;
};

/**
 * Build prompt for news impact
 */
const buildNewsPrompt = (symbol, title, category) => {
  return `How would "${title}" (${category}) impact ${symbol} price in short-term (1-7 days)? 1 sentence.`;
};

/**
 * Call OpenAI API with rate limiting, exponential backoff, and request queuing
 */
const callOpenAI = async (prompt, format = 'text') => {
  const cacheKey = `openai:${prompt.slice(0, 120)}`;
  const cached = getCached(cacheKey);
  if (cached) {
    logger.debug('💾 OpenAI cache hit');
    return cached;
  }

  const result = await requestQueue.add(() => {
    return retryWithBackoff(async () => {
      const response = await axios.post(
        OPENAI_API_URL,
        {
          model: config.openai.model || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a financial market analyst. Provide concise, actionable insights.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: config.openai.maxTokens || 150
        },
        {
          headers: {
            'Authorization': `Bearer ${config.openai.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000 // 15 second timeout
        }
      );

      const content = response.data.choices?.[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      return content;
    });
  }).catch(error => {
    // Log different error types
    if (error.response?.status === 401) {
      logger.error('❌ OpenAI API key invalid or expired');
    } else if (error.response?.status === 429) {
      logger.warn('⚠️ OpenAI API rate limit exceeded (max retries reached)');
      logger.debug('OpenAI 429 response payload:', error.response.data);
    } else if (error.code === 'ECONNABORTED') {
      logger.warn('⚠️ OpenAI API timeout after 15s');
    } else if (error.response) {
      logger.warn('❌ OpenAI API error (HTTP ' + error.response.status + '):', error.response.data?.error?.message || error.message);
    } else if (error.request) {
      logger.warn('❌ OpenAI API request failed (no response):', error.message);
    } else {
      logger.warn('❌ OpenAI API error:', error.message);
    }
    throw error;
  });

  setCache(cacheKey, result);
  return result;
};

/**
 * Wrapper to handle OpenAI calls with graceful fallback on rate limits
 * Returns fallback response instead of throwing on errors
 */
const callOpenAIWithRetry = async (fn, fallback = null) => {
  try {
    return await fn();
  } catch (err) {
    if (err?.response?.status === 429) {
      logger.warn('⚠️ OpenAI rate limit exceeded after retry attempts, returning fallback.');
    } else {
      logger.warn('OpenAI call failed:', err?.message);
    }
    return fallback;
  }
};

/**
 * Get basic explanation when OpenAI unavailable
 */
const getBasicExplanation = (anomaly) => {
  const direction = anomaly.type === 'spike' ? 'increased sharply' : 'decreased sharply';
  const severity = anomaly.severity > 0.7 ? 'critical' : 'significant';
  return `${anomaly.symbol} ${direction} (${severity} anomaly, z-score: ${anomaly.zScore})`;
};

/**
 * Build news impact fallback when OpenAI unavailable or rate-limited
 */
const buildNewsImpactFallback = (symbol, newsTitle, category) => {
  const categoryMap = {
    'regulatory': 'Regulatory changes may affect market sentiment',
    'technology': 'Technology developments impact adoption and user interest',
    'partnership': 'Partnership announcements typically signal positive growth',
    'market': 'Market movements affect overall sentiment',
    'security': 'Security issues impact investor confidence',
    'adoption': 'Adoption news drives long-term value',
  };
  
  const impact = categoryMap[category?.toLowerCase()] || 'Market news affecting trading sentiment';
  return `${symbol}: ${impact}. (${category || 'General'} News)`;
};

/**
 * Generate basic strategy without OpenAI
 */
const generateBasicStrategy = (portfolio) => {
  return {
    type: 'balanced',
    description: 'Default strategy based on portfolio composition',
    expectedReturn: 12,
    risk: 5,
    timeframe: '1-2 years',
    rationale: 'Safe default strategy',
    steps: [
      'Maintain current allocation',
      'Monitor market volatility',
      'Rebalance monthly'
    ]
  };
};

/**
 * Parse sentiment response from OpenAI
 */
const parseSentimentResponse = (response) => {
  try {
    const json = JSON.parse(response);
    return {
      sentiment: json.sentiment || 'neutral',
      score: json.score || 0.5,
      confidence: json.confidence || 0.8,
      reason: 'OpenAI analysis'
    };
  } catch {
    // Fallback if JSON parsing fails
    const lower = response.toLowerCase();
    if (lower.includes('positive')) {
      return { sentiment: 'positive', score: 0.7, confidence: 0.6 };
    } else if (lower.includes('negative')) {
      return { sentiment: 'negative', score: 0.3, confidence: 0.6 };
    }
    return { sentiment: 'neutral', score: 0.5, confidence: 0.4 };
  }
};

/**
 * Parse strategy response from OpenAI
 */
const parseStrategyResponse = (response) => {
  try {
    const parsed = JSON.parse(response);
    // Ensure we have 'steps' field for frontend consistency
    return {
      type: parsed.type || 'moderate',
      description: parsed.description || parsed.rationale || 'AI-generated strategy',
      expectedReturn: parsed.expectedReturn || parsed.expected_return || 15,
      risk: parsed.risk || parsed.riskLevel || 5,
      timeframe: parsed.timeframe || '1-2 years',
      rationale: parsed.rationale || 'OpenAI recommendation',
      steps: parsed.steps || parsed.actions || ['Review strategy based on OpenAI recommendation']
    };
  } catch {
    return {
      type: 'moderate',
      description: 'AI-generated strategy',
      expectedReturn: 15,
      risk: 5,
      timeframe: '1-2 years',
      rationale: response,
      steps: ['Review strategy based on OpenAI recommendation']
    };
  }
};

// Initialize and log OpenAI status
if (config.openai?.apiKey) {
  logger.info('✅ OpenAI integration initialized (API key configured)');
} else {
  logger.warn('⚠️ OpenAI integration disabled (API key not configured) - falling back to basic explanations');
}

module.exports = {
  getOpenAIInsights,
  getSentimentAnalysis,
  generateStrategyRecommendation,
  explainNewsImpact,
  getBasicExplanation,
  generateBasicStrategy
};
