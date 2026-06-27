// AFTER
const express = require('express');
const { validateRequest } = require('../middlewares/validator.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { featureAccess } = require('../middlewares/feature-access.middleware');  // ← ADD
const defiController = require('../controllers/defi.controller');
const { defiSchemas } = require('../validators/defi.validator');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);
router.use(featureAccess('defiIntegration'));  // ← ADD — Enterprise only
// // Protocol routes
router.get('/protocols',
  validateRequest(defiSchemas.getProtocols),
  defiController.getProtocols
);

router.get('/protocols/:id',
  validateRequest(defiSchemas.getProtocolDetails),
  defiController.getProtocolDetails
);

// Position routes
router.get('/positions',
  validateRequest(defiSchemas.getPositions),
  defiController.getPositions
);

// Staking routes
router.get('/staking-positions',
  validateRequest(defiSchemas.getStakingPositions),
  defiController.getStakingPositions
);

router.get('/chart-history/:positionId',
  validateRequest(defiSchemas.getChartHistory),
  defiController.getChartHistory
);

router.post('/stake',
  validateRequest(defiSchemas.stake),
  defiController.stakeAssets
);

router.post('/unstake',
  validateRequest(defiSchemas.unstake),
  defiController.unstakeAssets
);

// Liquidity pool routes
router.get('/pools',
  validateRequest(defiSchemas.getPools),
  defiController.getLiquidityPools
);

router.post('/pools/join',
  validateRequest(defiSchemas.joinPool),
  defiController.joinLiquidityPool
);

router.post('/pools/exit',
  validateRequest(defiSchemas.exitPool),
  defiController.exitLiquidityPool
);

router.get('/pools/:poolId/tvl-history',
  validateRequest(defiSchemas.getPoolTvlHistory),
  defiController.getPoolTvlHistory
);

// Yield Farm routes
router.get('/yield-farms',
  validateRequest(defiSchemas.getYieldFarms),
  defiController.getYieldFarms
);

router.post('/farms/deposit',
  validateRequest(defiSchemas.farmDeposit),
  defiController.depositToFarm
);

router.post('/farms/withdraw',
  validateRequest(defiSchemas.farmWithdraw),
  defiController.withdrawFromFarm
);

router.post('/farms/harvest',
  validateRequest(defiSchemas.farmHarvest),
  defiController.harvestFarmRewards
);

// Staking rewards routes
router.post('/claim-staking-rewards',
  validateRequest(defiSchemas.claimRewards),
  defiController.claimStakingRewards
);

// Gas tracker routes
router.get('/gas-prices',
  defiController.getGasPrices
);

// DeFi Stats routes
router.get('/stats',
  defiController.getDefiStats
);

// New: per-user portfolio summary (total value, total rewards, active positions)
router.get('/portfolio-summary',
  defiController.getDefiStats  // reuses getDefiStats — already per-user
);

// Returns unsigned transaction for MetaMask to sign
router.post('/build-tx',
  validateRequest(defiSchemas.buildTx),
  defiController.buildTransaction
);

// Called after MetaMask confirms tx — verifies on-chain and saves position
router.post('/confirm-tx',
  validateRequest(defiSchemas.confirmTx),
  defiController.confirmTransaction
);


module.exports = router;
