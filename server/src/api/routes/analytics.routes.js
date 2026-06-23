// server/src/api/routes/analytics.routes.js
const express              = require('express');
const { authMiddleware }   = require('../middlewares/auth.middleware');
const analyticsController  = require('../controllers/analytics.controller');
const { validateRequest }  = require('../middlewares/validator.middleware');
const { analyticsSchemas } = require('../validators/analytics.validator');

const router = express.Router();
router.use(authMiddleware);

// Core analytics
router.get('/performance',    validateRequest(analyticsSchemas.getPerformance),         analyticsController.getPerformanceAnalytics);
router.get('/risk',           validateRequest(analyticsSchemas.getRisk),                analyticsController.getRiskMetrics);
router.get('/allocation',                                                                analyticsController.getAssetAllocation);
router.get('/correlation',                                                               analyticsController.getCorrelationMatrix);
router.get('/benchmark',                                                                 analyticsController.getBenchmarkComparison);
router.get('/tax',                                                                       analyticsController.getTaxReport);

// AI-powered analytics
router.get('/predictions',    analyticsController.getPricePredictions);
router.get('/sentiment',      analyticsController.getMarketSentiment);
router.get('/opportunities',  analyticsController.getInvestmentOpportunities);

// Report generation — validated; aliased at /custom for backward compat
router.post('/report',        validateRequest(analyticsSchemas.generateCustomReport),   analyticsController.generateCustomReport);
router.post('/custom',        validateRequest(analyticsSchemas.generateCustomReport),   analyticsController.generateCustomReport);

module.exports = router;
