const express = require('express');
const { validateRequest } = require('../middlewares/validator.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');
const transactionController = require('../controllers/transaction.controller');
const { transactionSchemas } = require('../validators/transaction.validator');

const router = express.Router();

router.use(authMiddleware);

// ✅ Specific named routes FIRST — before any /:param wildcards
router.get('/recent',           transactionController.getRecentTransactions);
router.get('/stats',            transactionController.getTransactionStats);
router.get('/asset/:asset',     transactionController.getTransactionsByAsset);
router.get('/type/:type',       transactionController.getTransactionsByType);

// ✅ Wildcard route LAST
router.get('/:id',              transactionController.getTransactionById);

router.post('/',
  validateRequest(transactionSchemas.createTransaction),
  transactionController.createTransaction
);

module.exports = router;