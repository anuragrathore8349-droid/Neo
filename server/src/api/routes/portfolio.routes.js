// server/src/api/routes/portfolio.routes.js — REPLACE ENTIRE FILE
const express    = require('express');
const multer     = require('multer');
const { authMiddleware } = require('../middlewares/auth.middleware');
const portfolioController = require('../controllers/portfolio.controller');
const { validateRequest } = require('../middlewares/validator.middleware');
const { portfolioSchemas } = require('../validators/portfolio.validator');

const router  = express.Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authMiddleware);

// ── Summary & overview ────────────────────────────────────────────────────
router.get('/',            portfolioController.getPortfolioSummary);
router.get('/assets',      validateRequest(portfolioSchemas.getAllAssets), portfolioController.getAllAssets);
router.get('/history',     portfolioController.getPortfolioHistory);
router.get('/export',      portfolioController.getPortfolioExport);

// Performance metrics — expose as both /metrics (old) and /performance (what client calls)
router.get('/metrics',     portfolioController.getPerformanceMetrics);
router.get('/performance', portfolioController.getPerformanceMetrics);

// Asset allocation endpoint that client calls
router.get('/allocation',  portfolioController.getAssetAllocation);

// Rebalance suggestions (simple GET list)
router.get('/rebalance',   portfolioController.getRebalanceSuggestions);

// ── Asset management ──────────────────────────────────────────────────────
router.post('/assets',
  validateRequest(portfolioSchemas.addAsset),
  portfolioController.addAsset);

router.put('/assets/:id',
  validateRequest(portfolioSchemas.updateAsset),
  portfolioController.updateAsset);

router.delete('/assets/:id', portfolioController.deleteAsset);

// Asset price history
router.get('/assets/:symbol/history', portfolioController.getAssetPriceHistory);

// ── Transactions ──────────────────────────────────────────────────────────
router.get('/transactions', validateRequest(portfolioSchemas.getTransactions), portfolioController.getTransactions);
router.post('/transactions/import',
  upload.single('file'),
  portfolioController.importTransactionsCSV);

// Legacy CSV import alias
router.post('/import',
  upload.single('file'),
  portfolioController.importTransactionsCSV);

// ── Rebalance (AI-powered, per portfolio) — THIS IS WHAT THE CLIENT CALLS ──
router.post('/optimize', portfolioController.optimizePortfolio);
router.post('/:portfolioId/rebalance', portfolioController.rebalancePortfolio);

module.exports = router;
