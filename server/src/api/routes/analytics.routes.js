const express              = require('express');
const { authMiddleware }   = require('../middlewares/auth.middleware');
const analyticsController  = require('../controllers/analytics.controller');
const { validateRequest }  = require('../middlewares/validator.middleware');
const { analyticsSchemas } = require('../validators/analytics.validator');

const router = express.Router();
router.use(authMiddleware);

router.get('/performance',   validateRequest(analyticsSchemas.getPerformance),   analyticsController.getPerformanceAnalytics);
router.get('/risk',          validateRequest(analyticsSchemas.getRisk),           analyticsController.getRiskMetrics);
router.get('/allocation',    analyticsController.getAssetAllocation);
router.get('/correlation',   analyticsController.getCorrelationMatrix);   // ← WAS MISSING
router.get('/benchmark',     analyticsController.getBenchmarkComparison); // ← WAS MISSING
router.get('/tax',           analyticsController.getTaxReport);

module.exports = router;
