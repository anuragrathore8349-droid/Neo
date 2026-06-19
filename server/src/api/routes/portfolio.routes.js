const express = require('express');
const { validateRequest } = require('../middlewares/validator.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');
const portfolioController = require('../controllers/portfolio.controller');
const { portfolioSchemas } = require('../validators/portfolio.validator');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Portfolio management
router.post('/',
  validateRequest(portfolioSchemas.createPortfolio),
  portfolioController.createPortfolio
);

// Add asset to portfolio
router.post('/assets',
  portfolioController.addAssetToPortfolio
);

// Delete an asset from portfolio
router.delete('/assets/:assetId',
  portfolioController.removeAssetFromPortfolio
);

// Update asset (quantity, cost basis, notes)
router.patch('/assets/:assetId',
  portfolioController.updateAsset
);

router.put('/:id',
  validateRequest(portfolioSchemas.updatePortfolio),
  portfolioController.updatePortfolio
);

router.delete('/:id',
  validateRequest(portfolioSchemas.deletePortfolio),
  portfolioController.deletePortfolio
);

// Portfolio data retrieval
router.get('/',
  portfolioController.getPortfolioSummary
);

router.get('/assets',
  portfolioController.getAllAssets
);

router.get('/export',
  portfolioController.getPortfolioExport
);
router.get('/assets/:symbol/history',
  portfolioController.getAssetPriceHistory
);
router.get('/assets/:id',
  validateRequest(portfolioSchemas.getAssetDetails),
  portfolioController.getAssetDetails
);

router.get('/history',
  validateRequest(portfolioSchemas.getHistory),
  portfolioController.getPortfolioHistory
);

router.get('/performance',
  portfolioController.getPerformanceMetrics
);

router.get('/allocation',
  portfolioController.getAssetAllocation
);
router.post('/optimize', portfolioController.optimizePortfolio);

module.exports = router;