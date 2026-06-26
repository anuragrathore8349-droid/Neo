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

router.get('/trending',
  validateRequest(marketSchemas.getTrendingAssets),
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
  validateRequest(marketSchemas.getMarketAssets),
  marketController.getMarketAssets
);

router.get('/summary',
  marketController.getMarketSummary
);

// Protected routes
router.use(authMiddleware);

router.get('/available-assets',
  validateRequest(marketSchemas.getAvailableAssets),
  marketController.getAvailableAssets
);

router.get('/watchlist',
  validateRequest(marketSchemas.getWatchlist),
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
  validateRequest(marketSchemas.getPriceAlerts),
  marketController.getPriceAlerts
);

router.delete('/alerts/:id',
  validateRequest(marketSchemas.deleteAlert),
  marketController.deletePriceAlert
);

module.exports = router;