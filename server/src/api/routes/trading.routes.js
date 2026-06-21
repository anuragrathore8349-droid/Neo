// server/src/api/routes/trading.routes.js
'use strict';

const express = require('express');
const { validateRequest }  = require('../middlewares/validator.middleware');
const { authMiddleware }   = require('../middlewares/auth.middleware');
const {
  featureAccess,
  checkTransactionLimit,
  checkSubscriptionStatus,
} = require('../middlewares/feature-access.middleware');
const tradingController    = require('../controllers/trading.controller');
const { tradingSchemas }   = require('../validators/trading.validator');
const apiKeyController     = require('../controllers/api-key.controller');

const router = express.Router();
router.use(authMiddleware);
router.use(checkSubscriptionStatus);

// ── Paper trading (all plans) ─────────────────────────────────────────────────
router.post('/paper/init',      tradingController.initializePaperAccount);
router.post('/paper/trades',    validateRequest(tradingSchemas.placePaperTrade),  tradingController.placePaperTrade);
router.get( '/paper/portfolio',                                                    tradingController.getPaperPortfolio);
router.get( '/paper/history',   validateRequest(tradingSchemas.getPaperHistory),  tradingController.getPaperTradeHistory);
router.post('/paper/reset',     tradingController.resetPaperAccount);
router.post('/paper/close',     tradingController.closePaperAccount);

// ── Real trading (Pro+) ───────────────────────────────────────────────────────
router.post('/orders',          checkTransactionLimit, validateRequest(tradingSchemas.placeOrder),      tradingController.placeOrder);
router.get( '/orders',          validateRequest(tradingSchemas.getOpenOrders),   tradingController.getOpenOrders);
router.get( '/orders/history',  validateRequest(tradingSchemas.getOrderHistory), tradingController.getOrderHistory);
router.delete('/orders/:id',    validateRequest(tradingSchemas.cancelOrder),     tradingController.cancelOrder);

// ── Market data (authenticated, any plan) ─────────────────────────────────────
router.get('/orderbook',        validateRequest(tradingSchemas.getOrderBook),    tradingController.getOrderBook);
router.get('/trades',           validateRequest(tradingSchemas.getRecentTrades), tradingController.getRecentTrades);

// ── API Key management ────────────────────────────────────────────────────────
router.get(   '/api-keys',         apiKeyController.listApiKeys);
router.post(  '/api-keys',         apiKeyController.addApiKey);
router.delete('/api-keys/:id',     apiKeyController.deleteApiKey);
router.post(  '/api-keys/:id/test', apiKeyController.testApiKey);

module.exports = router;
