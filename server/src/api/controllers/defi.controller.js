'use strict';

const defiService       = require('../../services/defi.service');
const txBuilderService  = require('../../services/tx.builder');
const { ethereumProvider } = require('../../config/blockchain');
const { logger }        = require('../middlewares/logger.middleware');
const DefiPosition      = require('../../models/defi-position.model');

class DefiController {

  async getProtocols(req, res, next) {
    try {
      const protocols = await defiService.getProtocols();
      res.json({ status: 'success', data: protocols });
    } catch (error) { next(error); }
  }

  async getProtocolDetails(req, res, next) {
    try {
      const { id } = req.validatedData.params;
      const details = await defiService.getProtocolDetails(id);
      res.json({ status: 'success', data: details });
    } catch (error) { next(error); }
  }

  async getPositions(req, res, next) {
    try {
      const positions = await defiService.getPositions(req.user.userId);
      res.json({ status: 'success', data: positions });
    } catch (error) { next(error); }
  }

  // ── Staking ────────────────────────────────────────────────────────────────

  async stakeAssets(req, res, next) {
    try {
      // Build the unsigned tx via the unified router
      const txData = await txBuilderService.buildTx(req.user.userId, {
        action:        'stake',
        protocolId:    req.validatedData.body.protocolId,
        assetSymbol:   req.validatedData.body.assetSymbol,
        amount:        String(req.validatedData.body.amount),
        walletAddress: req.validatedData.body.walletAddress,
      });
      res.json({ status: 'success', data: { unsignedTx: txData } });
    } catch (error) { next(error); }
  }

  async unstakeAssets(req, res, next) {
    try {
      const result = await defiService.unstakeAssets(req.user.userId, req.validatedData.body);
      res.json({ status: 'success', data: result });
    } catch (error) { next(error); }
  }

  async getStakingPositions(req, res, next) {
    try {
      const positions = await defiService.getStakingPositions(req.user.userId);
      res.json({ status: 'success', data: positions });
    } catch (error) { next(error); }
  }

  async claimStakingRewards(req, res, next) {
    try {
      const result = await defiService.claimStakingRewards(req.user.userId, req.validatedData.body);
      res.json({ status: 'success', data: result });
    } catch (error) { next(error); }
  }

  // ── Liquidity pools ────────────────────────────────────────────────────────

  async getLiquidityPools(req, res, next) {
    try {
      const { protocol, token } = req.validatedData.query || {};
      const pools = await defiService.getLiquidityPools(protocol, token, req.user?.userId);
      res.json({ status: 'success', data: pools });
    } catch (error) { next(error); }
  }

  async joinLiquidityPool(req, res, next) {
    try {
      const txData = await txBuilderService.buildTx(req.user.userId, {
        action:        'addLiquidity',
        protocolId:    req.validatedData.body.protocolId || 'uniswap',
        poolId:        req.validatedData.body.poolId,
        token0Amount:  req.validatedData.body.token0Amount,
        token1Amount:  req.validatedData.body.token1Amount,
        walletAddress: req.validatedData.body.walletAddress,
      });
      res.json({ status: 'success', data: { unsignedTx: txData } });
    } catch (error) { next(error); }
  }

  async exitLiquidityPool(req, res, next) {
    try {
      const result = await defiService.exitLiquidityPool(req.user.userId, req.validatedData.body);
      res.json({ status: 'success', data: result });
    } catch (error) { next(error); }
  }

  // ── Yield farms ────────────────────────────────────────────────────────────

  async getYieldFarms(req, res, next) {
    try {
      const farms = await defiService.getYieldFarms(req.user?.userId);
      res.json({ status: 'success', data: farms });
    } catch (error) { next(error); }
  }

  async depositToFarm(req, res, next) {
    try {
      const txData = await txBuilderService.buildTx(req.user.userId, {
        action:        'deposit',
        protocolId:    req.validatedData.body.protocolId || 'curve',
        farmId:        req.validatedData.body.farmId,
        amount:        req.validatedData.body.amount,
        walletAddress: req.validatedData.body.walletAddress,
      });
      res.json({ status: 'success', data: { unsignedTx: txData } });
    } catch (error) { next(error); }
  }

  async withdrawFromFarm(req, res, next) {
    try {
      const result = await defiService.withdrawFromFarm(req.user.userId, req.validatedData.body);
      res.json({ status: 'success', data: result });
    } catch (error) { next(error); }
  }

  async harvestFarmRewards(req, res, next) {
    try {
      const result = await defiService.harvestFarmRewards(req.user.userId, req.validatedData.body);
      res.json({ status: 'success', data: result });
    } catch (error) { next(error); }
  }

  // ── Gas & Stats ────────────────────────────────────────────────────────────

  async getGasPrices(req, res, next) {
    try {
      const gasPrices = await defiService.getGasPrices();
      res.json({ status: 'success', data: gasPrices });
    } catch (error) { next(error); }
  }

  async getDefiStats(req, res, next) {
    try {
      const stats = await defiService.getDefiStats(req.user.userId);
      res.json({ status: 'success', data: stats });
    } catch (error) { next(error); }
  }

  // ── Build & Confirm TX ─────────────────────────────────────────────────────

  async buildTransaction(req, res, next) {
    try {
      const { action, walletAddress, protocolId, ...rest } = req.validatedData.body;

      const txData = await txBuilderService.buildTx(req.user.userId, {
        action, walletAddress, protocolId, ...rest
      });

      if (!txData || (!txData.to && !txData.data)) {
        throw new Error(
          `Transaction builder returned empty result for action: ${action}.`
        );
      }

      res.json({ status: 'success', data: { unsignedTx: txData } });
    } catch (error) {
      logger.error('buildTransaction failed:', error.message);
      next(error);
    }
  }

  async confirmTransaction(req, res, next) {
    try {
      const { txHash, positionType, metadata } = req.validatedData.body;
      const network = (metadata?.network || 'ethereum').toLowerCase();

      const { polygonProvider, arbitrumProvider } = require('../../config/blockchain');
      const { ethers } = require('ethers');

      let provider;
      if (network === 'sepolia' || network === 'sepolia testnet') {
        const sepoliaUrls = [
          process.env.SEPOLIA_RPC_URL,
          'https://ethereum-sepolia-rpc.publicnode.com',
          'https://rpc2.sepolia.org',
          'https://sepolia.drpc.org',
          'https://1rpc.io/sepolia'
        ].filter(Boolean);

        for (const url of sepoliaUrls) {
          try {
            const p = new ethers.providers.JsonRpcProvider(url);
            await p.getNetwork();
            provider = p;
            break;
          } catch (e) {
            logger.warn(`Sepolia RPC ${url} failed: ${e.message}`);
          }
        }
        if (!provider) {
          logger.warn('All Sepolia RPCs failed — saving position without receipt');
          provider = null;
        }
      } else if (network === 'polygon') {
        provider = polygonProvider;
      } else if (network === 'arbitrum') {
        provider = arbitrumProvider;
      } else {
        provider = ethereumProvider;
      }

      let receipt = null;
      if (provider) {
        for (let i = 0; i < 6; i++) {
          try {
            receipt = await provider.getTransactionReceipt(txHash);
            if (receipt) break;
          } catch (e) {
            logger.warn(`getTransactionReceipt attempt ${i + 1} failed: ${e.message}`);
          }
          if (i < 5) await new Promise(r => setTimeout(r, 5000));
        }
      }

      const isTestnet = ['sepolia', 'goerli', 'mumbai', 'sepolia testnet'].includes(network);

      if (!receipt) {
        if (isTestnet) {
          logger.warn(`Receipt not found on ${network} for ${txHash} — saving anyway (testnet)`);
        } else {
          throw new Error('Transaction failed or not found on-chain');
        }
      }

      if (receipt && !isTestnet && receipt.status !== 1) {
        throw new Error('Transaction reverted on-chain');
      }

      // Determine position type — default to 'staking' if not provided
      const pType = positionType || 'staking';

      const position = new DefiPosition({
        userId:          req.user.userId,
        protocolId:      metadata?.protocolId || 'unknown',
        protocol:        metadata?.protocolId || 'unknown',
        type:            pType,
        asset: {
          symbol:  metadata?.asset || '',
          amount:  parseFloat(metadata?.amount) || 0,
          address: metadata?.assetAddress || ''
        },
        apy:             metadata?.apy ? parseFloat(metadata.apy) : 0,
        lockPeriod:      metadata?.lockPeriod || 0,
        transactionHash: txHash,
        walletAddress:   metadata?.walletAddress || '',
        network:         network,
        startedAt:       new Date(),
        status:          'active'
      });

      await position.save();

      res.json({
        status: 'success',
        data: {
          positionId:      position._id,
          transactionHash: txHash,
          status:          'confirmed',
          network
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // ── Chart History ──────────────────────────────────────────────────────────

  async getChartHistory(req, res, next) {
    try {
      const { positionId } = req.validatedData.params;
      const { days = 30 }  = req.validatedData.query || {};

      const position = await DefiPosition.findById(positionId);
      if (!position) {
        return res.status(404).json({ status: 'error', message: 'Position not found' });
      }

      const chartHistoryService = require('../../services/chart-history.service');
      const chartData = await chartHistoryService.getPositionChartHistory(position, parseInt(days));

      res.json({
        status: 'success',
        data: { chartData, positionId, asset: position.asset?.symbol, period: `${parseInt(days)} days` }
      });
    } catch (error) {
      logger.error('Error fetching chart history:', error.message);
      next(error);
    }
  }

  async getPoolTvlHistory(req, res, next) {
    try {
      const { poolId } = req.validatedData.params;
      const { days = 30 } = req.validatedData.query || {};

      const DefiChart = require('../../models/defi-chart.model');
      const chart = await DefiChart.findOne({ entityId: poolId, entityType: 'pool', metric: 'tvl' });
      const chartData = chart ? chart.get30DayTvlHistory() : [];

      res.json({ status: 'success', data: { chartData, poolId, period: `${parseInt(days)} days` } });
    } catch (error) { next(error); }
  }
}

module.exports = new DefiController();
