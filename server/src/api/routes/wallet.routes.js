
const express = require('express');
const { validateRequest } = require('../middlewares/validator.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');
const walletController = require('../controllers/wallet.controller');
const { walletSchemas } = require('../validators/wallet.validator');

const router = express.Router();

// Apply auth middleware to ALL routes
router.use(authMiddleware);

router.get('/',              walletController.getWallets);
router.post('/connect',      validateRequest(walletSchemas.connectWallet), walletController.connectWallet);
router.delete('/:id',        validateRequest(walletSchemas.removeWallet),  walletController.removeWallet);
router.get('/transactions',  validateRequest(walletSchemas.getTransactions), walletController.getTransactions);
router.post('/withdraw',     validateRequest(walletSchemas.withdrawFunds),  walletController.withdrawFunds);
router.post('/deposit',      validateRequest(walletSchemas.getDepositAddress), walletController.getDepositAddress);

// ✅ Auth-protected + validated cache-transactions
router.post('/cache-transactions',
  validateRequest(walletSchemas.cacheTransactions),
  walletController.cacheTransactions
);

// ✅ Live gas prices endpoint
router.get('/gas-prices', walletController.getGasPrices);

module.exports = router;
