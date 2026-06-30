const express = require('express');
const { validateRequest } = require('../middlewares/validator.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { featureAccess } = require('../middlewares/feature-access.middleware');
const aiController = require('../controllers/ai.controller');
const { aiSchemas } = require('../validators/ai.validator');

const router = express.Router();

// All AI routes require authentication AND the 'aiInsights' feature (Pro+)
router.use(authMiddleware);
router.use(featureAccess('aiInsights'));

// Price predictions
router.get('/predictions/:symbol',
  validateRequest(aiSchemas.getPredictions),
  aiController.getPricePredictions
);

// Market sentiment analysis
router.get('/sentiment/:symbol',
  validateRequest(aiSchemas.getSentiment),
  aiController.getMarketSentiment
);

// Risk assessment (body contains assets array)
router.post('/risk/assessment',
  validateRequest(aiSchemas.getRiskAssessment),
  aiController.getRiskAssessment
);

// Investment opportunities
router.get('/opportunities',
  validateRequest(aiSchemas.getOpportunities),
  aiController.getInvestmentOpportunities
);

// Portfolio optimization
router.post('/portfolio/optimize',
  validateRequest(aiSchemas.optimizePortfolio),
  aiController.optimizePortfolio
);

// Strategy recommendations — keep any existing routes below as they were
router.post('/strategy/recommend',
  validateRequest(aiSchemas.getStrategyRecommendations),
  aiController.getStrategyRecommendations
);

// News analysis (used by dashboard AI insights widget)
router.get('/news/analysis',
  validateRequest(aiSchemas.analyzeNews),
  aiController.getNewsAnalysis
);

// Pattern detection
router.get('/patterns/:symbol',
  validateRequest(aiSchemas.detectPatterns),
  aiController.detectPatterns
);

// Anomaly detection
router.post('/anomalies',
  validateRequest(aiSchemas.detectAnomalies),
  aiController.detectAnomalies
);

// Personalized AI insights
router.get('/insights', aiController.getPersonalizedInsights);

// Portfolio Chat (Gemini + live portfolio context)
router.post('/chat',
  validateRequest(aiSchemas.portfolioChat),
  aiController.portfolioChat
);

// Market data helpers
router.get('/fear-greed', aiController.getFearGreedIndex);
router.get('/market/dominance', aiController.getBTCDominance);
router.get('/trending-coins', aiController.getTrendingCoins);
router.get('/market/overview', aiController.getMarketOverview);

// ── Tax-Loss Harvesting Engine (deterministic + optional Gemini polish) ──
router.get('/tax-loss-harvesting',
  validateRequest(aiSchemas.getTaxLossHarvesting),
  aiController.getTaxLossHarvesting
);

// ── AI Weekly Report data (client renders PDF via jsPDF) ────────────────
router.get('/weekly-report',
  featureAccess('weeklyAIReport'),
  validateRequest(aiSchemas.getWeeklyReport),
  aiController.getWeeklyReport
);

// ── Gemini quota/health status (powers an "AI status" badge in the UI) ──
router.get('/quota-status', aiController.getAIQuotaStatus);

module.exports = router;
