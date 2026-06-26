const axios = require('axios');
const { logger } = require('../api/middlewares/logger.middleware');
const config = require('../config');

/**
 * Gemini AI Integration for Financial Insights
 * Model: gemini-2.5-flash (free tier: 15 RPM, 1500 RPD)
 * Strategy: In-memory cache (1hr TTL) + sequential queue to respect rate limits
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Free tier: 15 RPM → min 4000ms between requests (4s + 500ms buffer = 4500ms)
const MIN_DELAY_MS = 4500;

// ─── REQUEST QUEUE ────────────────────────────────────────────────────────────

class RequestQueue {
  constructor() {
    this.queue = [];
    this.running = false;
    this.lastRequestTime = 0;
  }

  async add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.running || this.queue.length === 0) return;
    this.running = true;

    while (this.queue.length > 0) {
      const { task, resolve, reject } = this.queue.shift();

      // Enforce minimum delay between requests
      const elapsed = Date.now() - this.lastRequestTime;
      if (elapsed < MIN_DELAY_MS) {
        await sleep(MIN_DELAY_MS - elapsed);
      }

      try {
        this.lastRequestTime = Date.now();
        resolve(await task());
      } catch (err) {
        reject(err);
      }
    }

    this.running = false;
  }
}

const requestQueue = new RequestQueue();

// ─── CACHE ────────────────────────────────────────────────────────────────────

const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.value;
}

function setCache(key, value) {
  cache.set(key, { value, ts: Date.now() });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Core Gemini API call — queued, cached, with retry on 429
 * @param {string} prompt
 * @param {'text'|'json'} format
 * @returns {Promise<string|null>}
 */
async function callGemini(prompt, format = 'text') {
  const cacheKey = `gemini:${prompt.slice(0, 140)}`;
  const cached = getCached(cacheKey);
  if (cached) {
    logger.debug('💾 Gemini cache hit');
    return cached;
  }

  const apiKey = config.gemini?.apiKey;
  if (!apiKey) {
    logger.warn('⚠️ GEMINI_API_KEY not set — using fallback data');
    return null;
  }

  return requestQueue.add(async () => {
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        const response = await axios.post(
          `${GEMINI_API_URL}?key=${apiKey}`,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: config.gemini?.maxTokens || 300,
              temperature: 0.7,
            },
          },
          { timeout: 20000 }
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!text) throw new Error('Empty Gemini response');

        // Strip markdown code blocks if present (Gemini sometimes wraps JSON)
        const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

        setCache(cacheKey, clean);
        logger.debug('✅ Gemini response received');
        return clean;

      } catch (err) {
        const status = err?.response?.status;

        if (status === 429) {
          const retryAfter = parseInt(err?.response?.headers?.['retry-after'] || '0') * 1000;
          const delay = retryAfter || Math.min(30000, Math.pow(2, attempt) * 5000);
          logger.warn(`⚠️ Gemini rate limit (429). Retry ${attempt + 1}/3 in ${delay}ms`);
          if (attempt < 3) { await sleep(delay); continue; }
        } else if (status === 400) {
          logger.error('❌ Gemini 400 Bad Request — check prompt or API key validity');
          return null;
        } else if (status === 403) {
          logger.error('❌ Gemini 403 Forbidden — API key invalid or quota exceeded');
          return null;
        } else if (err.code === 'ECONNABORTED') {
          logger.warn('⚠️ Gemini timeout (20s)');
          return null;
        } else {
          logger.warn(`❌ Gemini error: ${err.message}`);
          return null;
        }
      }
    }
    logger.warn('⚠️ Gemini max retries reached — returning null (fallback will be used)');
    return null;
  });
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Explain a detected market anomaly in one sentence
 */
async function getOpenAIInsights(anomaly) {
  const prompt = `In one sentence, explain why ${anomaly.symbol} might show a ${anomaly.type} anomaly with z-score ${anomaly.zScore} (mean: ${anomaly.mean}, value: ${anomaly.value}). Be concise and financial.`;

  const result = await callGemini(prompt, 'text');
  return result || getBasicExplanation(anomaly);
}

/**
 * Analyse text sentiment for a crypto asset
 * Returns { sentiment, score, confidence, reason }
 */
async function getSentimentAnalysis(symbol, content) {
  const fallback = { sentiment: 'neutral', score: 0.5, confidence: 0.5, reason: 'AI unavailable' };

  const prompt = `Analyse the sentiment about ${symbol} from this text: "${content}". Return ONLY valid JSON (no markdown): {"sentiment":"positive"|"negative"|"neutral","score":0.0-1.0,"confidence":0.0-1.0}`;

  const result = await callGemini(prompt, 'json');
  if (!result) return fallback;

  try {
    const parsed = JSON.parse(result);
    return {
      sentiment: parsed.sentiment || 'neutral',
      score: typeof parsed.score === 'number' ? parsed.score : 0.5,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
      reason: 'Gemini analysis'
    };
  } catch {
    const lower = result.toLowerCase();
    if (lower.includes('positive')) return { sentiment: 'positive', score: 0.7, confidence: 0.6, reason: 'Gemini text' };
    if (lower.includes('negative')) return { sentiment: 'negative', score: 0.3, confidence: 0.6, reason: 'Gemini text' };
    return fallback;
  }
}

/**
 * Generate investment strategy recommendations
 * Returns array of strategy objects or a single object
 */
async function generateStrategyRecommendation(portfolio, marketConditions) {
  const fallback = generateBasicStrategy(portfolio);

  const portfolioSummary = Array.isArray(portfolio?.assets)
    ? portfolio.assets.slice(0, 5).map(a => `${a.symbol}: $${a.amount}`).join(', ')
    : JSON.stringify(portfolio).slice(0, 200);

  const prompt = `You are a crypto portfolio analyst. Given portfolio: [${portfolioSummary}] and market: trend=${marketConditions?.trend}, volatility=${marketConditions?.volatility?.toFixed(3)}.

Return ONLY a JSON array (no markdown, no explanation) of 1-3 strategy objects. Each object must have exactly these keys:
{"type":"conservative"|"moderate"|"aggressive","description":"string","expectedReturn":number,"risk":1-10,"timeframe":"string","rationale":"string","steps":["string"]}

Return ONLY the JSON array.`;

  const result = await callGemini(prompt, 'json');
  if (!result) return fallback;

  try {
    const parsed = JSON.parse(result);
    // Handle both array and single object responses
    const strategies = Array.isArray(parsed) ? parsed : [parsed];
    return strategies.map(s => ({
      type: s.type || 'moderate',
      description: s.description || 'AI-generated strategy',
      expectedReturn: typeof s.expectedReturn === 'number' ? s.expectedReturn : 15,
      risk: typeof s.risk === 'number' ? s.risk : 5,
      timeframe: s.timeframe || '1-2 years',
      rationale: s.rationale || 'Gemini recommendation',
      steps: Array.isArray(s.steps) ? s.steps : ['Review market conditions', 'Rebalance monthly']
    }));
  } catch {
    logger.warn('Failed to parse Gemini strategy JSON — using fallback');
    return fallback;
  }
}

/**
 * Explain the short-term impact of a news headline on a crypto asset
 */
async function explainNewsImpact(symbol, newsTitle, category) {
  const fallback = buildNewsImpactFallback(symbol, newsTitle, category);

  const prompt = `How would "${newsTitle}" (category: ${category || 'general'}) impact ${symbol} price in the next 1-7 days? Answer in exactly 1 concise sentence.`;

  const result = await callGemini(prompt, 'text');
  return result || fallback;
}

// ─── FALLBACKS ────────────────────────────────────────────────────────────────

function getBasicExplanation(anomaly) {
  const dir = anomaly.type === 'spike' ? 'increased sharply' : 'decreased sharply';
  const sev = anomaly.severity > 0.7 ? 'critical' : 'significant';
  return `${anomaly.symbol} ${dir} (${sev} anomaly, z-score: ${anomaly.zScore?.toFixed(2)})`;
}

function buildNewsImpactFallback(symbol, newsTitle, category) {
  const categoryMap = {
    regulatory: 'Regulatory changes may affect market sentiment and trading volumes',
    technology: 'Technology developments impact adoption and long-term value',
    partnership: 'Partnership announcements typically signal growth potential',
    market:     'Market movements reflect broader sentiment shifts',
    security:   'Security concerns temporarily reduce investor confidence',
    adoption:   'Adoption news is a strong long-term positive signal',
  };
  const impact = categoryMap[category?.toLowerCase()] || 'This news may influence short-term trading sentiment';
  return `${symbol}: ${impact}. (${category || 'General'})`;
}

function generateBasicStrategy(portfolio) {
  return [{
    type: 'moderate',
    description: 'Balanced portfolio strategy',
    expectedReturn: 12,
    risk: 5,
    timeframe: '1-2 years',
    rationale: 'Default balanced approach while AI is initialising',
    steps: [
      'Maintain current allocation with quarterly reviews',
      'Monitor Bitcoin dominance as a macro indicator',
      'Set stop-loss orders to manage downside risk',
      'Keep 10-20% as stablecoin reserve for opportunities'
    ]
  }];
}

// ─── STATUS LOG ───────────────────────────────────────────────────────────────

if (config.gemini?.apiKey) {
  logger.info('✅ Gemini AI integration ready (gemini-2.5-flash, free tier)');
} else {
  logger.warn('⚠️ GEMINI_API_KEY not set — AI insights will use statistical fallback');
}

module.exports = {
  getOpenAIInsights,      // kept same name so ai.service.js imports work unchanged
  getSentimentAnalysis,
  generateStrategyRecommendation,
  explainNewsImpact,
  getBasicExplanation,
  generateBasicStrategy,
  callGemini,             // exported for direct use if needed
};