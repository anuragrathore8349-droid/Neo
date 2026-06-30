'use strict';

const { logger } = require('../api/middlewares/logger.middleware');
const portfolioService = require('./portfolio.service');
const reasoningEngine = require('./neoReasoningEngine');
const { generateNarrative } = require('../utils/aiNarrativeLayer');

/**
 * taxLossHarvesting.service.js
 * ─────────────────────────────────────────────────────────────────────────
 * Revenue differentiator: no free/mid-tier competitor offers automated
 * tax-loss harvesting suggestions with correlation-preserving swaps.
 *
 * Hybrid pattern:
 *   1. neoReasoningEngine (deterministic) finds every losing position,
 *      computes the exact loss / estimated tax savings, and proposes a
 *      correlation-preserving swap. This is the IP — pure rules, no LLM,
 *      always correct, always available.
 *   2. aiNarrativeLayer (optional) turns the numbers into a short,
 *      readable paragraph. If Gemini is rate-limited or down, a
 *      deterministic template paragraph is used instead — the feature
 *      never breaks, it just loses some prose polish.
 * ─────────────────────────────────────────────────────────────────────────
 */

class TaxLossHarvestingService {
  /**
   * @param {string} userId
   * @param {Object} options
   * @param {number} [options.taxRate] - marginal tax rate, 0-1 (default 0.24)
   * @returns {Promise<Object>}
   */
  async getOpportunities(userId, options = {}) {
    if (!userId) throw new Error('userId is required');

    // Live data: pull the user's current, real-time-priced portfolio.
    const { items: assets } = await portfolioService.getAllAssets(userId, { limit: 500 });

    if (!assets || assets.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        opportunityCount: 0,
        totalLossAmount: 0,
        totalPotentialTaxSavings: 0,
        opportunities: [],
        narrative: 'You have no assets in your portfolio yet, so there are no tax-loss harvesting opportunities to show.',
        narrativeSource: 'template',
      };
    }

    // Normalise to the shape the reasoning engine expects (it works off
    // costBasis/currentPrice/amount, which getAllAssets already returns).
    const normalised = assets.map((a) => ({
      symbol: a.symbol,
      name: a.name,
      amount: a.amount,
      costBasis: a.costBasis,
      currentPrice: a.currentPrice,
      profit: a.profit,
      acquiredAt: a.acquiredAt,
    }));

    // 1. Deterministic source of truth — never touches an LLM.
    const result = reasoningEngine.analyzeTaxLossOpportunities(normalised, {
      taxRate: options.taxRate,
    });

    // 2. Optional narrative polish — swappable, degrades gracefully.
    let narrative = '';
    let narrativeSource = 'template';
    try {
      const { narrative: text, source } = await generateNarrative('tax_loss_harvest', result);
      narrative = text;
      narrativeSource = source;
    } catch (err) {
      logger.warn(`TaxLossHarvesting: narrative generation failed — ${err.message}`);
      narrative = `Found ${result.opportunityCount} tax-loss opportunities worth an estimated $${result.totalPotentialTaxSavings}.`;
    }

    return { ...result, narrative, narrativeSource };
  }
}

module.exports = new TaxLossHarvestingService();