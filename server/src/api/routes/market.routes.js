const express = require('express');
const { validateRequest } = require('../middlewares/validator.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');
const marketController = require('../controllers/market.controller');
const { marketSchemas } = require('../validators/market.validator');

const router = express.Router();

// Public routes
router.get('/prices',
  validateRequest(marketSchemas.getPrices),
  marketController.getPrices
);

router.get('/prices/:symbol',
  validateRequest(marketSchemas.getSymbolPrice),
  marketController.getSymbolPrice
);

router.get('/history/:symbol',
  validateRequest(marketSchemas.getPriceHistory),
  marketController.getPriceHistory
);

router.get('/trending',
  marketController.getTrendingAssets
);

router.get('/search',
  validateRequest(marketSchemas.searchAssets),
  marketController.searchAssets
);

router.get('/details/:symbol',
  validateRequest(marketSchemas.getAssetDetails),
  marketController.getAssetDetails
);

router.get('/assets',
  marketController.getMarketAssets
);

router.get('/summary',
  marketController.getMarketSummary
);

// Protected routes
router.use(authMiddleware);

router.get('/available-assets',
  marketController.getAvailableAssets
);

router.get('/watchlist',
  marketController.getWatchlist
);

router.post('/watchlist/:symbol',
  validateRequest(marketSchemas.addToWatchlist),
  marketController.addToWatchlist
);

router.delete('/watchlist/:symbol',
  validateRequest(marketSchemas.removeFromWatchlist),
  marketController.removeFromWatchlist
);

router.post('/alerts',
  validateRequest(marketSchemas.createAlert),
  marketController.createPriceAlert
);

router.get('/alerts',
  marketController.getPriceAlerts
);

router.delete('/alerts/:id',
  validateRequest(marketSchemas.deleteAlert),
  marketController.deletePriceAlert
);

module.exports = router;