const axios = require('axios');
const { logger } = require('../api/middlewares/logger.middleware');
const config = require('../config');

/**
 * Gemini AI Integration for Financial Insights
 * Model: gemini-2.5-flash
 *
 * ── WHY THIS FILE WAS REWRITTEN (root cause of "rate limit exceeded with
 *    very few requests") ─────────────────────────────────────────────────
 * 1. The old code assumed gemini-2.5-flash free tier = 15 RPM / 1500 RPD.
 *    The actual current free-tier limits for gemini-2.5-flash are far
 *    lower (single-digit RPM and a few hundred RPD depending on region/
 *    project). The 4.5s spacing was tuned for a quota 5-6x larger than
 *    what Google actually grants, so the 15th/20th request of the day
 *    already came back 429 even though "not many" requests were made.
 *    Fix: real, configurable limits via env vars, with safe defaults,
 *    plus a hard DAILY counter that stops calling the API once exhausted
 *    instead of retrying into more 429s.
 *
 * 2. `enrichAnomaliesWithInsights()` and the pattern-detection equivalent
 *    called `getOpenAIInsights()` inside `anomalies.map(...)` wrapped in
 *    `Promise.all`, i.e. one Gemini call PER anomaly/pattern. A single
 *    market scan that finds 10-15 anomalies burned 10-15 requests in one
 *    shot — enough to exhaust an entire day's free quota in one job run.
 *    Fix: batched call — one Gemini request explains ALL anomalies in
 *    that batch via a single structured-JSON prompt (see `callGeminiBatch`
 *    in ai.service.js usage). This is also done by all heavy callers now
 *    routing through `aiNarrativeLayer.js`, the single hybrid integration
 *    seam, instead of calling Gemini directly from multiple files.
 *
 * 3. 429 retries used exponential backoff INSIDE the per-request loop but
 *    nothing prevented the *next* queued item from immediately re-hitting
 *    the same exhausted quota a few seconds later — so a burst of calls
 *    could 429 repeatedly in sequence. Fix: a single shared
 *    `dailyQuotaExceeded` flag short-circuits ALL further calls until
 *    midnight UTC reset once Google confirms quota exhaustion (403/429
 *    with quota-exceeded reason), instead of retrying each one.
 * ───────────────────────────────────────────────────────────────────────
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Real free-tier numbers are much tighter than the old comment assumed.
// Override via env if you're on a paid tier with higher limits.
const RPM_LIMIT = parseInt(process.env.GEMINI_RPM_LIMIT || '8', 10);   // requests/minute
const RPD_LIMIT = parseInt(process.env.GEMINI_RPD_LIMIT || '200', 10); // requests/day
const MIN_DELAY_MS = Math.ceil(60000 / RPM_LIMIT) + 500; // spacing derived FROM the real limit, not hardcoded

// ─── DAILY QUOTA TRACKER ──────────────────────────────────────────────────────
// Stops the app from hammering Google once the daily cap is hit — instead
// every caller gets `null` immediately and falls back to deterministic
// templates (see aiNarrativeLayer.js), with no extra network round trips.

class DailyQuota {
  constructor(limit) {
    this.limit = limit;
    this.count = 0;
    this.resetAt = nextMidnightUTC();
    this.hardExceeded = false; // set true if Google itself reports quota exceeded (403)
  }

  _maybeReset() {
    if (Date.now() >= this.resetAt) {
      this.count = 0;
      this.hardExceeded = false;
      this.resetAt = nextMidnightUTC();
      logger.info('🔄 Gemini daily quota counter reset');
    }
  }

  canCall() {
    this._maybeReset();
    return !this.hardExceeded && this.count < this.limit;
  }

  recordCall() {
    this._maybeReset();
    this.count += 1;
  }

  markHardExceeded() {
    this.hardExceeded = true;
    logger.error(`🛑 Gemini daily quota exhausted (${this.count}/${this.limit}) — falling back to templates until reset`);
  }
}

function nextMidnightUTC() {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}

const dailyQuota = new DailyQuota(RPD_LIMIT);

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

      // Short-circuit immediately if we already know the quota is gone —
      // don't even wait out the spacing delay before failing fast.
      if (!dailyQuota.canCall()) {
        resolve(null);
        continue;
      }

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
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Core Gemini API call — queued, cached, daily-quota-aware, retry on 429.
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

  if (!dailyQuota.canCall()) {
    logger.debug('⏭️  Gemini daily quota exhausted — skipping call, fallback will be used');
    return null;
  }

  return requestQueue.add(async () => {
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        dailyQuota.recordCall();

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

        const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

        setCache(cacheKey, clean);
        logger.debug('✅ Gemini response received');
        return clean;

      } catch (err) {
        const status = err?.response?.status;
        const reason = err?.response?.data?.error?.status; // e.g. 'RESOURCE_EXHAUSTED'

        if (status === 429) {
          if (reason === 'RESOURCE_EXHAUSTED' || dailyQuota.count >= dailyQuota.limit) {
            dailyQuota.markHardExceeded();
            return null; // don't burn more retries — fail fast for the rest of the day
          }
          const retryAfter = parseInt(err?.response?.headers?.['retry-after'] || '0') * 1000;
          const delay = retryAfter || Math.min(15000, Math.pow(2, attempt) * 3000);
          logger.warn(`⚠️ Gemini rate limit (429). Retry ${attempt + 1}/2 in ${delay}ms`);
          if (attempt < 2) { await sleep(delay); continue; }
          return null;
        } else if (status === 400) {
          logger.error('❌ Gemini 400 Bad Request — check prompt or API key validity');
          return null;
        } else if (status === 403) {
          logger.error('❌ Gemini 403 Forbidden — API key invalid or quota exceeded');
          dailyQuota.markHardExceeded();
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
    return null;
  });
}

/**
 * Batched insight generator — explains MULTIPLE anomalies/patterns in
 * ONE Gemini call instead of one call per item. This is the single
 * biggest fix for quota exhaustion: a scan that used to cost N requests
 * now costs 1.
 *
 * @param {Array<Object>} items - each item needs enough fields to describe itself
 * @param {(item:Object)=>string} describeFn - turns one item into a one-line description
 * @returns {Promise<string[]|null>} array of explanations, same order/length as items, or null
 */
async function callGeminiBatch(items, describeFn) {
  if (!items || items.length === 0) return [];
  if (items.length === 1) {
    const single = await callGemini(
      `In one sentence, explain (financially, concisely): ${describeFn(items[0])}`,
      'text'
    );
    return single ? [single] : null;
  }

  const numbered = items.map((it, i) => `${i + 1}. ${describeFn(it)}`).join('\n');
  const prompt =
    `For each numbered item below, write exactly ONE concise financial-explanation sentence. ` +
    `Return ONLY a JSON array of strings, same order, same length as the input (no markdown).\n\n${numbered}`;

  const result = await callGemini(prompt, 'json');
  if (!result) return null;

  try {
    const parsed = JSON.parse(result);
    if (Array.isArray(parsed) && parsed.length === items.length) return parsed;
    return null;
  } catch {
    logger.warn('Failed to parse Gemini batch JSON — caller should use per-item fallback');
    return null;
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

async function getOpenAIInsights(anomaly) {
  const prompt = `In one sentence, explain why ${anomaly.symbol} might show a ${anomaly.type} anomaly with z-score ${anomaly.zScore} (mean: ${anomaly.mean}, value: ${anomaly.value}). Be concise and financial.`;

  const result = await callGemini(prompt, 'text');
  return result || getBasicExplanation(anomaly);
}

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
  logger.info(`✅ Gemini AI integration ready (gemini-2.5-flash) — limits: ${RPM_LIMIT} RPM / ${RPD_LIMIT} RPD (set GEMINI_RPM_LIMIT / GEMINI_RPD_LIMIT to override)`);
} else {
  logger.warn('⚠️ GEMINI_API_KEY not set — AI insights will use statistical fallback');
}

/**
 * Portfolio-aware Gemini chat
 */
async function callGeminiPortfolioChat(userMessage, history = [], portfolioContext = {}, marketPrices = {}) {
  const apiKey = config.gemini?.apiKey;
  if (!apiKey) {
    logger.warn('⚠️  GEMINI_API_KEY not set — portfolio chat unavailable');
    return null;
  }

  if (!dailyQuota.canCall()) {
    logger.debug('⏭️  Gemini daily quota exhausted — chat will use local reasoning fallback');
    return null;
  }

  const assetLines = (portfolioContext.assets || [])
    .map(a =>
      `  • ${a.symbol} (${a.name}): qty=${a.quantity ?? a.amount}, ` +
      `value=$${(a.value || 0).toFixed(2)}, alloc=${(a.allocation || 0).toFixed(1)}%, ` +
      `P&L=${(a.profitLoss || 0) >= 0 ? '+' : ''}$${(a.profitLoss || 0).toFixed(2)} ` +
      `(${(a.profitLossPercentage || 0).toFixed(2)}%)`
    )
    .join('\n');

  const priceLines = Object.entries(marketPrices)
    .map(([sym, d]) =>
      `  • ${sym}: $${Number(d?.price || 0).toLocaleString()} (${(d?.change24h || 0) >= 0 ? '+' : ''}${(d?.change24h || 0).toFixed(2)}% 24h)`
    )
    .join('\n');

  const systemPrompt =
    `You are Neo, an expert AI portfolio advisor embedded in the NeoFin trading platform.\n` +
    `Today is ${new Date().toDateString()}.\n\n` +
    `USER PORTFOLIO (live data):\n` +
    `  Total Value : $${(portfolioContext.totalValue || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}\n` +
    `  Total Cost  : $${(portfolioContext.totalCost || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}\n` +
    `  Total P&L   : ${(portfolioContext.totalPL || 0) >= 0 ? '+' : ''}$${(portfolioContext.totalPL || 0).toFixed(2)} ` +
    `(${(portfolioContext.totalPLPercentage || 0).toFixed(2)}%)\n` +
    `\nHoldings:\n${assetLines || '  (no assets)'}\n` +
    `\nLIVE MARKET PRICES:\n${priceLines || '  (unavailable)'}\n\n` +
    `Guidelines:\n` +
    `- Answer concisely and practically — 2–4 short paragraphs max.\n` +
    `- Reference the user's specific holdings, not generic advice.\n` +
    `- Always flag that this is not financial advice.\n` +
    `- If you don't know something, say so honestly.`;

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Understood. I am ready to help you analyse your portfolio.' }] },
    ...history.map(turn => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.text }]
    })),
    { role: 'user', parts: [{ text: userMessage }] }
  ];

  const cacheKey = `gemini:chat:${userMessage.slice(0, 80)}:${(portfolioContext.totalValue || 0).toFixed(0)}`;
  const cached = getCached(cacheKey);
  if (cached) {
    logger.debug('💾 Gemini chat cache hit');
    return cached;
  }

  return requestQueue.add(async () => {
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        dailyQuota.recordCall();

        const response = await axios.post(
          `${GEMINI_API_URL}?key=${apiKey}`,
          {
            contents,
            generationConfig: {
              maxOutputTokens: 600,
              temperature: 0.65,
            },
          },
          { timeout: 25000 }
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!text) throw new Error('Empty Gemini chat response');
        setCache(cacheKey, text);
        return text;
      } catch (err) {
        const status = err.response?.status;
        if (status === 429) {
          if (err?.response?.data?.error?.status === 'RESOURCE_EXHAUSTED' || dailyQuota.count >= dailyQuota.limit) {
            dailyQuota.markHardExceeded();
            return null;
          }
          if (attempt < 1) {
            logger.warn(`⏳ Gemini 429 on chat — retrying once in 4s`);
            await sleep(4000);
            continue;
          }
        }
        logger.error('Gemini portfolio chat error:', err.message);
        return null;
      }
    }
    return null;
  });
}

module.exports = {
  getOpenAIInsights,
  getSentimentAnalysis,
  generateStrategyRecommendation,
  explainNewsImpact,
  getBasicExplanation,
  generateBasicStrategy,
  callGemini,
  callGeminiBatch,
  callGeminiPortfolioChat,
  _dailyQuota: dailyQuota, // exposed for /api/ai/quota-status + tests
};
