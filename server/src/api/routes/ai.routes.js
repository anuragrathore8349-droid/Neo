const express = require('express');
const { validateRequest } = require('../middlewares/validator.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');
const aiController = require('../controllers/ai.controller');
const { aiSchemas } = require('../validators/ai.validator');

const router = express.Router();

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

// Strategy recommendations
router.post('/strategy/recommend',
  validateRequest(aiSchemas.getStrategyRecommendations),
  aiController.getStrategyRecommendations
);

// Pattern detection
router.get('/patterns/:symbol',
  validateRequest(aiSchemas.detectPatterns),
  aiController.detectPatterns
);

// News analysis
router.get('/news/analysis',
  validateRequest(aiSchemas.analyzeNews),
  aiController.analyzeNews
);

// Anomaly detection
router.post('/anomalies',
  validateRequest(aiSchemas.detectAnomalies),
  aiController.detectAnomalies
);
router.post('/anomalies/detect',
  validateRequest(aiSchemas.detectAnomalies),
  aiController.detectAnomalies
);

// Personalized insights — requires auth (userId comes from JWT)
router.get('/insights',
  authMiddleware,
  aiController.getPersonalizedInsights
);

// Public market data endpoints — no auth required
router.get('/fear-greed', aiController.getFearGreedIndex);
router.get('/market/dominance', aiController.getBTCDominance);
router.get('/trending-coins', aiController.getTrendingCoins);

// NEW: bundled market overview (fear/greed + dominance + trending + prices)
router.get('/market/overview', aiController.getMarketOverview);

module.exports = router;