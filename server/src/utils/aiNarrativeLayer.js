'use strict';

const { logger } = require('../api/middlewares/logger.middleware');
const { callGemini } = require('./openai-integration');

/**
 * aiNarrativeLayer.js
 * ─────────────────────────────────────────────────────────────────────────
 * Hybrid pattern: deterministic engine = source of truth, LLM = optional
 * polish layer for the human-readable narrative.
 *
 * Every feature in NeoFin that wants AI prose should call
 * `generateNarrative(kind, structuredData)` from THIS file — never call
 * Gemini/OpenAI/Claude directly from a service. That keeps the entire
 * product's LLM dependency behind one swappable seam:
 *
 *   - Replace Gemini with Claude/GPT/a local model → edit `callLLM()` only.
 *   - Provider down / rate-limited / removed         → deterministic
 *     templates below still return a correct, readable narrative.
 *   - No feature breaks. No feature even "looks broken" to the user.
 * ─────────────────────────────────────────────────────────────────────────
 */

// ── Swap point ───────────────────────────────────────────────────────────
// To switch providers, change ONLY this function.
async function callLLM(prompt) {
  return callGemini(prompt, 'text');
}

// ── Public entry point ──────────────────────────────────────────────────
/**
 * @param {'tax_loss_harvest'|'weekly_report'|'rebalance'} kind
 * @param {Object} structuredData - deterministic output from neoReasoningEngine
 * @returns {Promise<{ narrative: string, source: 'ai'|'template' }>}
 */
async function generateNarrative(kind, structuredData) {
  const builder = PROMPT_BUILDERS[kind];
  const templateFn = TEMPLATE_FALLBACKS[kind];

  if (!builder || !templateFn) {
    throw new Error(`Unknown narrative kind: ${kind}`);
  }

  try {
    const prompt = builder(structuredData);
    const aiText = await callLLM(prompt);
    if (aiText) {
      return { narrative: aiText, source: 'ai' };
    }
  } catch (err) {
    logger.warn(`aiNarrativeLayer: LLM call failed for "${kind}", using template fallback — ${err.message}`);
  }

  // Provider unavailable / rate-limited / errored → deterministic prose.
  // The user still gets a complete, correct answer.
  return { narrative: templateFn(structuredData), source: 'template' };
}

// ── Prompt builders (keep prompts short → fewer tokens → fewer 429s) ────
const PROMPT_BUILDERS = {
  tax_loss_harvest: (data) => {
    const top = data.opportunities.slice(0, 5)
      .map((o) => `${o.symbol}: loss $${o.lossAmount}, swap→${o.suggestedSwap?.suggestedSymbol || 'none'}`)
      .join('; ');
    return `You are a crypto tax assistant. In 3-4 short sentences, summarise these tax-loss ` +
      `harvesting opportunities for the user in plain English and remind them this is not tax advice. ` +
      `Total potential savings: $${data.totalPotentialTaxSavings}. Opportunities: ${top}`;
  },

  weekly_report: (data) => {
    return `You are a portfolio analyst writing a weekly summary. In 4-6 sentences, summarise the week: ` +
      `total value $${data.totalValue}, weekly change ${data.weeklyChangePercentage}%, ` +
      `diversification score ${data.healthScore?.diversificationScore}/100, ` +
      `${data.taxLoss?.opportunityCount || 0} tax-loss opportunities worth $${data.taxLoss?.totalPotentialTaxSavings || 0}. ` +
      `Be specific, encouraging but honest, and end with one concrete suggestion.`;
  },

  rebalance: (data) => {
    return `Summarise in 2-3 sentences why this portfolio rebalance is recommended. ` +
      `Diversification score: ${data.diversificationScore}/100. ${data.concentrationWarning || ''}`;
  },
};

// ── Deterministic template fallbacks (zero dependency on any AI provider) ─
const TEMPLATE_FALLBACKS = {
  tax_loss_harvest: (data) => {
    if (data.opportunityCount === 0) {
      return `No tax-loss harvesting opportunities were found in your current portfolio — none of your ` +
        `positions are currently showing an unrealised loss. This is not tax advice; consult a tax professional.`;
    }
    const top = data.opportunities[0];
    return `We found ${data.opportunityCount} position${data.opportunityCount > 1 ? 's' : ''} with an unrealised ` +
      `loss, worth an estimated $${data.totalPotentialTaxSavings} in potential tax savings at a ${(data.taxRateUsed * 100).toFixed(0)}% rate. ` +
      `The largest opportunity is ${top.symbol}, currently down $${top.lossAmount} (${top.lossPercentage}%)` +
      `${top.suggestedSwap ? `, with ${top.suggestedSwap.suggestedSymbol} suggested as a correlation-preserving swap` : ''}. ` +
      `Review the wash-sale safe-harbor window (${data.opportunities[0].washSaleSafeHarborDays} days) before repurchasing. ` +
      `This is not tax advice — consult a tax professional before acting.`;
  },

  weekly_report: (data) => {
    const trend = data.weeklyChangePercentage >= 0 ? 'gained' : 'declined';
    return `This week your portfolio ${trend} ${Math.abs(data.weeklyChangePercentage).toFixed(2)}%, closing at ` +
      `$${Number(data.totalValue).toLocaleString()}. Your diversification score is ${data.healthScore?.diversificationScore ?? 'n/a'}/100` +
      `${data.healthScore?.concentrationWarning ? `. ${data.healthScore.concentrationWarning}` : '.'} ` +
      `${data.taxLoss?.opportunityCount ? `There ${data.taxLoss.opportunityCount === 1 ? 'is' : 'are'} ${data.taxLoss.opportunityCount} tax-loss ` +
        `harvesting opportunit${data.taxLoss.opportunityCount === 1 ? 'y' : 'ies'} worth an estimated $${data.taxLoss.totalPotentialTaxSavings} ` +
        `in potential savings.` : 'No tax-loss harvesting opportunities were found this week.'} ` +
      `Suggested action: review your largest position and confirm it still matches your risk tolerance.`;
  },

  rebalance: (data) => {
    return `Your diversification score is ${data.diversificationScore}/100.` +
      `${data.concentrationWarning ? ` ${data.concentrationWarning} Consider trimming the largest position and ` +
        `redistributing into under-weighted groups.` : ' Your allocation is reasonably well spread across asset groups.'}`;
  },
};

module.exports = {
  generateNarrative,
};