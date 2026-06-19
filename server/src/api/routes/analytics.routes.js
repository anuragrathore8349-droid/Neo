const express = require('express');
const { validateRequest } = require('../middlewares/validator.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');
const analyticsController = require('../controllers/analytics.controller');
const { analyticsSchemas } = require('../validators/analytics.validator');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Performance analytics
router.get('/performance',
  validateRequest(analyticsSchemas.getPerformance),
  analyticsController.getPerformance
);

// Risk assessment
router.get('/risk',
  validateRequest(analyticsSchemas.getRisk),
  analyticsController.getRisk
);

// AI price predictions
router.get('/predictions',
  validateRequest(analyticsSchemas.getPredictions),
  analyticsController.getPredictions
);

// Market sentiment analysis
router.get('/sentiment',
  validateRequest(analyticsSchemas.getSentiment),
  analyticsController.getSentiment
);

// Investment opportunities
router.get('/opportunities',
  validateRequest(analyticsSchemas.getOpportunities),
  analyticsController.getOpportunities
);

// Custom analytics report
router.post('/custom',
  validateRequest(analyticsSchemas.generateCustomReport),
  analyticsController.generateCustomReport
);

module.exports = router;