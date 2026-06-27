// server/src/api/routes/analytics.routes.js
const express              = require('express');
const { authMiddleware }   = require('../middlewares/auth.middleware');
const { featureAccess }    = require('../middlewares/feature-access.middleware');
const analyticsController  = require('../controllers/analytics.controller');
const { validateRequest }  = require('../middlewares/validator.middleware');
const { analyticsSchemas } = require('../validators/analytics.validator');

const router = express.Router();

// All analytics routes require authentication AND the 'advancedAnalytics' feature (Pro+)
router.use(authMiddleware);
router.use(featureAccess('advancedAnalytics'));

// Core analytics
router.get('/performance',   validateRequest(analyticsSchemas.getPerformance),       analyticsController.getPerformanceAnalytics);
router.get('/risk',          validateRequest(analyticsSchemas.getRisk),              analyticsController.getRiskMetrics);
router.get('/allocation',                                                             analyticsController.getAssetAllocation);
router.get('/correlation',                                                            analyticsController.getCorrelationMatrix);
router.get('/benchmark',                                                              analyticsController.getBenchmarkComparison);
router.get('/tax',                                                                    analyticsController.getTaxReport);

// AI-powered analytics (also gated by advancedAnalytics — already covered by router.use above)
router.get('/predictions',   analyticsController.getPricePredictions);
router.get('/sentiment',     analyticsController.getMarketSentiment);
router.get('/opportunities', analyticsController.getInvestmentOpportunities);

// Report generation
router.post('/report',  validateRequest(analyticsSchemas.generateCustomReport), analyticsController.generateCustomReport);
router.post('/custom',  validateRequest(analyticsSchemas.generateCustomReport), analyticsController.generateCustomReport);

module.exports = router;
