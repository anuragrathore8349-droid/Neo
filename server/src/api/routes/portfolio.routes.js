const express    = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { featureAccess } = require('../middlewares/feature-access.middleware');
const portfolioController = require('../controllers/portfolio.controller');
const { validateRequest } = require('../middlewares/validator.middleware');
const { portfolioSchemas } = require('../validators/portfolio.validator');

const router = express.Router();
router.use(authMiddleware);

// Summary & overview
router.get('/',           portfolioController.getPortfolioSummary);
router.get('/assets',     portfolioController.getAllAssets);
router.get('/history',    portfolioController.getPortfolioHistory);
router.get('/export',     portfolioController.getPortfolioExport);
router.get('/metrics',    portfolioController.getPerformanceMetrics);
router.get('/rebalance',  portfolioController.getRebalanceSuggestions);

// Asset management — ADDED
router.post('/assets',         validateRequest(portfolioSchemas.addAsset),    portfolioController.addAsset);
router.put('/assets/:id',      validateRequest(portfolioSchemas.updateAsset), portfolioController.updateAsset);
router.delete('/assets/:id',   portfolioController.deleteAsset);

// Asset price history
router.get('/assets/:symbol/history', portfolioController.getAssetPriceHistory);

// Transactions (CSV import)
router.get('/transactions',  portfolioController.getTransactions);
router.post('/transactions/import', portfolioController.importTransactionsCSV);

module.exports = router;
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

// Rebalance portfolio using AI optimization
router.post('/:portfolioId/rebalance',
  portfolioController.rebalancePortfolio
);

module.exports = router;
