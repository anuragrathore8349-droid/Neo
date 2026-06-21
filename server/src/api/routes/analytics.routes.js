const express              = require('express');
const { authMiddleware }   = require('../middlewares/auth.middleware');
const analyticsController  = require('../controllers/analytics.controller');
const { validateRequest }  = require('../middlewares/validator.middleware');
const { analyticsSchemas } = require('../validators/analytics.validator');

const router = express.Router();
router.use(authMiddleware);

// Core analytics
router.get('/performance',    validateRequest(analyticsSchemas.getPerformance),    analyticsController.getPerformanceAnalytics);
router.get('/risk',           validateRequest(analyticsSchemas.getRisk),            analyticsController.getRiskMetrics);
router.get('/allocation',     analyticsController.getAssetAllocation);
router.get('/correlation',    analyticsController.getCorrelationMatrix);
router.get('/benchmark',      analyticsController.getBenchmarkComparison);
router.get('/tax',            analyticsController.getTaxReport);

// AI-powered analytics (now wired)
router.get('/predictions',    analyticsController.getPricePredictions);
router.get('/sentiment',      analyticsController.getMarketSentiment);
router.get('/opportunities',  analyticsController.getInvestmentOpportunities);
router.post('/report',        analyticsController.generateCustomReport);

module.exports = router;