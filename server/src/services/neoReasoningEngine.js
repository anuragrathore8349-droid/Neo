'use strict';

/**
 * neoReasoningEngine.js
 * ─────────────────────────────────────────────────────────────────────────
 * Deterministic, rule-based reasoning core for NeoFin.
 *
 * This is the PROPRIETARY, OWNABLE business logic — it never calls an LLM
 * and never depends on a third-party AI provider. It is the "source of
 * truth" in the hybrid architecture:
 *
 *      neoReasoningEngine.js   →  facts, numbers, decisions   (deterministic)
 *      aiNarrativeLayer.js     →  human-readable explanation  (optional, swappable)
 *
 * If Gemini/OpenAI/Claude/whatever goes down, gets rate-limited, or is
 * removed entirely, every number this engine produces is still correct.
 * Only the prose narrative degrades to a template fallback.
 * ─────────────────────────────────────────────────────────────────────────
 */

// Static correlation groups — used to find "correlation-preserving" swaps,
// i.e. an alternative asset that keeps the user's market exposure roughly
// the same while realising a tax loss (avoids an effective wash sale).
// NOTE: the IRS wash-sale rule (26 U.S.C. §1091) technically applies to
// "securities" and, as of current guidance, has NOT been formally extended
// to crypto — but applying the same 30-day discipline is the safe,
// defensible default and is what every serious tax-loss tool does.
const CORRELATION_GROUPS = {
  'L1-SMART-CONTRACT': ['ETH', 'SOL', 'AVAX', 'ADA', 'DOT', 'ATOM', 'NEAR'],
  'L1-PAYMENTS': ['BTC', 'LTC', 'BCH', 'XRP'],
  'L2-SCALING': ['MATIC', 'POL', 'ARB', 'OP'],
  'DEFI': ['UNI', 'AAVE', 'LINK', 'MKR', 'CRV'],
  'EXCHANGE-TOKEN': ['BNB', 'OKB', 'CRO'],
  'MEME': ['DOGE', 'SHIB', 'PEPE'],
  'STABLE': ['USDT', 'USDC', 'DAI'],
  'EQUITY-TECH': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA'],
};

const WASH_SALE_SAFE_HARBOR_DAYS = 30;
const DEFAULT_TAX_RATE = 0.24; // sensible US federal short-term default; caller can override

function findGroup(symbol) {
  const sym = (symbol || '').toUpperCase();
  for (const [group, members] of Object.entries(CORRELATION_GROUPS)) {
    if (members.includes(sym)) return group;
  }
  return 'OTHER';
}

/**
 * Suggest a correlation-preserving swap target for a losing asset.
 * Picks the highest-market-relevance asset in the same group that the
 * user does NOT already hold, so selling A and buying B keeps thematic/
 * beta exposure while realising the loss on A.
 */
function suggestSwap(symbol, heldSymbols) {
  const group = findGroup(symbol);
  if (group === 'OTHER') return null;

  const candidates = CORRELATION_GROUPS[group].filter(
    (s) => s !== symbol.toUpperCase() && !heldSymbols.includes(s)
  );
  if (candidates.length === 0) return null;

  return {
    suggestedSymbol: candidates[0],
    group,
    rationale: `${candidates[0]} sits in the same "${group}" correlation group as ${symbol}, ` +
      `so swapping preserves similar market/beta exposure while realising the loss.`,
  };
}

/**
 * Core rule: find every asset where profit < 0, compute the tax savings,
 * and propose a correlation-preserving swap. Pure function, zero I/O.
 *
 * @param {Array} assets - portfolio assets, each with at minimum:
 *   { symbol, name, amount, costBasis, currentPrice, profit, acquiredAt }
 * @param {Object} opts
 * @param {number} opts.taxRate        - marginal tax rate, default 0.24
 * @param {string} opts.filingStatus   - 'short_term' | 'long_term' (informational only)
 * @returns {Object} structured, deterministic result
 */
function analyzeTaxLossOpportunities(assets = [], opts = {}) {
  const taxRate = typeof opts.taxRate === 'number' ? opts.taxRate : DEFAULT_TAX_RATE;
  const heldSymbols = assets.map((a) => (a.symbol || '').toUpperCase());
  const now = Date.now();

  const opportunities = assets
    .map((asset) => {
      const amount = Number(asset.amount || 0);
      const costBasis = Number(asset.costBasis || 0);
      const currentPrice = Number(asset.currentPrice || 0);

      // Loss = current market value - total cost basis. Negative => loss.
      const totalCost = costBasis * amount;
      const currentValue = currentPrice * amount;
      const profit = typeof asset.profit === 'number' ? asset.profit : currentValue - totalCost;

      if (!(profit < 0) || amount <= 0) return null;

      const lossAmount = Math.abs(profit);
      const estimatedTaxSavings = round2(lossAmount * taxRate);

      const acquiredAt = asset.acquiredAt ? new Date(asset.acquiredAt) : null;
      const daysHeld = acquiredAt ? Math.floor((now - acquiredAt.getTime()) / 86400000) : null;
      const isLongTerm = daysHeld !== null ? daysHeld >= 365 : null;

      const swap = suggestSwap(asset.symbol, heldSymbols);

      return {
        symbol: asset.symbol,
        name: asset.name || asset.symbol,
        amount,
        costBasis,
        currentPrice,
        currentValue: round2(currentValue),
        totalCost: round2(totalCost),
        lossAmount: round2(lossAmount),
        lossPercentage: totalCost > 0 ? round2((lossAmount / totalCost) * 100) : 0,
        estimatedTaxSavings,
        taxRateUsed: taxRate,
        holdingPeriod: isLongTerm === null ? 'unknown' : isLongTerm ? 'long_term' : 'short_term',
        daysHeld,
        washSaleSafeHarborDays: WASH_SALE_SAFE_HARBOR_DAYS,
        suggestedSwap: swap,
        action: swap
          ? `Sell ${amount} ${asset.symbol} to realise a $${round2(lossAmount)} loss, ` +
            `then consider rotating into ${swap.suggestedSymbol} to maintain market exposure ` +
            `(wait ${WASH_SALE_SAFE_HARBOR_DAYS} days before repurchasing ${asset.symbol} to stay inside the safe-harbor window).`
          : `Sell ${amount} ${asset.symbol} to realise a $${round2(lossAmount)} loss. No correlated swap candidate found in your other holdings — consider a sector ETF/index alternative.`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.estimatedTaxSavings - a.estimatedTaxSavings);

  const totalLossAmount = round2(opportunities.reduce((s, o) => s + o.lossAmount, 0));
  const totalPotentialTaxSavings = round2(opportunities.reduce((s, o) => s + o.estimatedTaxSavings, 0));

  return {
    generatedAt: new Date().toISOString(),
    taxRateUsed: taxRate,
    opportunityCount: opportunities.length,
    totalLossAmount,
    totalPotentialTaxSavings,
    opportunities,
    methodology: 'deterministic-rule-based', // never "AI-generated" — this is the defensible IP
  };
}

/**
 * Lightweight deterministic diversification / concentration score (0-100).
 * Used by the AI Weekly Report and reused anywhere a fast, non-LLM
 * "health score" is useful.
 */
function scorePortfolioHealth(assets = []) {
  const totalValue = assets.reduce((s, a) => s + (a.value || (a.amount * a.currentPrice) || 0), 0) || 1;

  const allocations = assets.map((a) => (a.value || (a.amount * a.currentPrice) || 0) / totalValue);
  // Herfindahl-Hirschman Index for concentration (0 = perfectly diversified, 1 = single asset)
  const hhi = allocations.reduce((s, w) => s + w * w, 0);
  const diversificationScore = round2((1 - hhi) * 100);

  const groupExposure = {};
  assets.forEach((a) => {
    const group = findGroup(a.symbol);
    const value = a.value || (a.amount * a.currentPrice) || 0;
    groupExposure[group] = (groupExposure[group] || 0) + value;
  });

  const largestGroup = Object.entries(groupExposure).sort((a, b) => b[1] - a[1])[0];
  const concentrationWarning = largestGroup && totalValue > 0 && largestGroup[1] / totalValue > 0.5
    ? `${round2((largestGroup[1] / totalValue) * 100)}% of the portfolio is concentrated in "${largestGroup[0]}" assets.`
    : null;

  return {
    diversificationScore,
    concentrationWarning,
    groupExposure: Object.fromEntries(
      Object.entries(groupExposure).map(([g, v]) => [g, round2((v / totalValue) * 100)])
    ),
    methodology: 'hhi-deterministic',
  };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

module.exports = {
  analyzeTaxLossOpportunities,
  scorePortfolioHealth,
  suggestSwap,
  findGroup,
  CORRELATION_GROUPS,
  WASH_SALE_SAFE_HARBOR_DAYS,
};