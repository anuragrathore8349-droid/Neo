'use strict';

const { logger } = require('../api/middlewares/logger.middleware');
const portfolioService = require('./portfolio.service');
const taxLossHarvestingService = require('./taxLossHarvesting.service');
const reasoningEngine = require('./neoReasoningEngine');
const { generateNarrative } = require('../utils/aiNarrativeLayer');

/**
 * weeklyReport.service.js
 * ─────────────────────────────────────────────────────────────────────────
 * Enterprise upsell driver: a one-click "AI Weekly Report" the user (or an
 * Enterprise admin, for client reporting) can export as a PDF.
 *
 * This service only builds the DATA. PDF rendering happens client-side
 * with jsPDF + jspdf-autotable (already installed in client/package.json),
 * so the server stays lightweight and the PDF always reflects the user's
 * live browser session/branding.
 * ─────────────────────────────────────────────────────────────────────────
 */

class WeeklyReportService {
  /**
   * @param {string} userId
   * @returns {Promise<Object>} structured report data, ready for client-side PDF rendering
   */
  async buildReport(userId) {
    if (!userId) throw new Error('userId is required');

    const [summary, assetsResult, taxLoss] = await Promise.all([
      portfolioService.getPortfolioSummary(userId),
      portfolioService.getAllAssets(userId, { limit: 500 }),
      taxLossHarvestingService.getOpportunities(userId).catch((err) => {
        logger.warn(`WeeklyReport: tax-loss lookup failed — ${err.message}`);
        return null;
      }),
    ]);

    const assets = assetsResult?.items || [];
    const healthScore = reasoningEngine.scorePortfolioHealth(
      assets.map((a) => ({ symbol: a.symbol, value: a.value, amount: a.amount, currentPrice: a.currentPrice }))
    );

    const topMovers = [...assets]
      .sort((a, b) => Math.abs(b.profitLossPercentage || 0) - Math.abs(a.profitLossPercentage || 0))
      .slice(0, 5)
      .map((a) => ({
        symbol: a.symbol,
        name: a.name,
        value: a.value,
        profitLoss: a.profitLoss,
        profitLossPercentage: a.profitLossPercentage,
      }));

    const reportData = {
      generatedAt: new Date().toISOString(),
      periodLabel: 'Last 7 days',
      totalValue: summary.totalValue ?? summary.allTimeProfit ?? 0,
      weeklyChange: summary.weeklyChange ?? 0,
      weeklyChangePercentage: summary.weeklyChangePercentage ?? 0,
      allTimeProfit: summary.allTimeProfit ?? 0,
      allTimeProfitPercentage: summary.allTimeProfitPercentage ?? 0,
      assetCount: summary.assetCount ?? assets.length,
      healthScore,
      topMovers,
      taxLoss: taxLoss
        ? {
            opportunityCount: taxLoss.opportunityCount,
            totalPotentialTaxSavings: taxLoss.totalPotentialTaxSavings,
            topOpportunities: taxLoss.opportunities.slice(0, 3),
          }
        : { opportunityCount: 0, totalPotentialTaxSavings: 0, topOpportunities: [] },
    };

    let narrative = '';
    let narrativeSource = 'template';
    try {
      const { narrative: text, source } = await generateNarrative('weekly_report', reportData);
      narrative = text;
      narrativeSource = source;
    } catch (err) {
      logger.warn(`WeeklyReport: narrative generation failed — ${err.message}`);
      narrative = `Portfolio value: $${reportData.totalValue}. Weekly change: ${reportData.weeklyChangePercentage}%.`;
    }

    return { ...reportData, narrative, narrativeSource };
  }
}

module.exports = new WeeklyReportService();