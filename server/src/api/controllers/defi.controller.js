const defiService = require('../../services/defi.service');
const txBuilderService = require('../../services/tx.builder');
const { ethereumProvider } = require('../../config/blockchain');
const { logger } = require('../middlewares/logger.middleware');
const DefiPosition = require('../../models/defi-position.model');

class DefiController {
  async getProtocols(req, res, next) {
    try {
      const protocols = await defiService.getProtocols();
      res.json({
        status: 'success',
        data: protocols
      });
    } catch (error) {
      next(error);
    }
  }

  async getProtocolDetails(req, res, next) {
    try {
      const { id } = req.validatedData.params;
      const details = await defiService.getProtocolDetails(id);
      res.json({
        status: 'success',
        data: details
      });
    } catch (error) {
      next(error);
    }
  }

  async getPositions(req, res, next) {
    try {
      const positions = await defiService.getPositions(req.user.userId);
      res.json({
        status: 'success',
        data: positions
      });
    } catch (error) {
      next(error);
    }
  }

  async stakeAssets(req, res, next) {
    try {
      const txData = await txBuilderService.buildStakeTx(req.validatedData.body);
      res.json({
        status: 'success',
        data: { unsignedTx: txData }
      });
    } catch (error) {
      next(error);
    }
  }

  async unstakeAssets(req, res, next) {
    try {
      const result = await defiService.unstakeAssets(
        req.user.userId,
        req.validatedData.body
      );
      res.json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getLiquidityPools(req, res, next) {
    try {
      const { protocol, token } = req.validatedData.query || {};
      const pools = await defiService.getLiquidityPools(protocol, token, req.user?.userId);
      res.json({
        status: 'success',
        data: pools
      });
    } catch (error) {
      next(error);
    }
  }

  async joinLiquidityPool(req, res, next) {
    try {
      const txData = await txBuilderService.buildPoolAddLiquidityTx(req.validatedData.body);
      res.json({
        status: 'success',
        data: { unsignedTx: txData }
      });
    } catch (error) {
      next(error);
    }
  }

  async exitLiquidityPool(req, res, next) {
    try {
      const result = await defiService.exitLiquidityPool(
        req.user.userId,
        req.validatedData.body
      );
      res.json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getStakingPositions(req, res, next) {
    try {
      const positions = await defiService.getStakingPositions(req.user.userId);
      res.json({
        status: 'success',
        data: positions
      });
    } catch (error) {
      next(error);
    }
  }

  async getYieldFarms(req, res, next) {
    try {
      const farms = await defiService.getYieldFarms(req.user?.userId);
      res.json({
        status: 'success',
        data: farms
      });
    } catch (error) {
      next(error);
    }
  }

  async getGasPrices(req, res, next) {
    try {
      const gasPrices = await defiService.getGasPrices();
      res.json({
        status: 'success',
        data: gasPrices
      });
    } catch (error) {
      next(error);
    }
  }

  async getDefiStats(req, res, next) {
    try {
      const stats = await defiService.getDefiStats(req.user.userId);
      res.json({
        status: 'success',
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  async depositToFarm(req, res, next) {
    try {
      const txData = await txBuilderService.buildFarmDepositTx(req.validatedData.body);
      res.json({
        status: 'success',
        data: { unsignedTx: txData }
      });
    } catch (error) {
      next(error);
    }
  }

  async withdrawFromFarm(req, res, next) {
    try {
      const result = await defiService.withdrawFromFarm(
        req.user.userId,
        req.validatedData.body
      );
      res.json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async harvestFarmRewards(req, res, next) {
    try {
      const result = await defiService.harvestFarmRewards(
        req.user.userId,
        req.validatedData.body
      );
      res.json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async claimStakingRewards(req, res, next) {
    try {
      const result = await defiService.claimStakingRewards(
        req.user.userId,
        req.validatedData.body
      );
      res.json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async buildTransaction(req, res, next) {
    try {
      const { action, walletAddress, protocolId, ...rest } = req.validatedData.body;

      // Route to the correct builder based on action
      let txData;
      switch (action) {
        case 'stake':
          txData = await txBuilderService.buildStakeTx({
            protocolId, walletAddress,
            assetSymbol: rest.assetSymbol,
            amount:      rest.amount,
          });
          break;

        case 'unstake':
          txData = await txBuilderService.buildUnstakeTx({
            protocolId: protocolId || 'lido',
            walletAddress,
            positionId: rest.positionId,
            amount:     rest.amount,
          });
          break;

        case 'addLiquidity':
          txData = await txBuilderService.buildPoolAddLiquidityTx({
            protocolId: protocolId || 'uniswap',
            walletAddress,
            poolId:       rest.poolId,
            token0Amount: rest.token0Amount,
            token1Amount: rest.token1Amount,
          });
          break;

        case 'removeLiquidity':
          txData = await txBuilderService.buildPoolRemoveLiquidityTx({
            protocolId: protocolId || 'uniswap',
            walletAddress,
            poolId:   rest.poolId,
            lpAmount: rest.lpAmount,
          });
          break;

        case 'deposit':
          txData = await txBuilderService.buildFarmDepositTx({
            protocolId: protocolId || 'curve',
            walletAddress,
            farmId: rest.farmId,
            amount: rest.amount,
          });
          break;

        case 'withdraw':
          txData = await txBuilderService.buildFarmWithdrawTx({
            protocolId: protocolId || 'curve',
            walletAddress,
            farmId: rest.farmId,
            amount: rest.amount,
          });
          break;

        case 'harvest':
          txData = await txBuilderService.buildFarmHarvestTx({
            protocolId: protocolId || 'curve',
            walletAddress,
            farmId: rest.farmId,
          });
          break;

        default:
          return res.status(400).json({ status: 'error', message: `Unknown action: ${action}` });
      }

      // Guard: if builder returned nothing, throw instead of returning empty data
      if (!txData || (!txData.to && !txData.data)) {
        throw new Error(
          `Transaction builder returned empty result for action: ${action}. ` +
          'Check tx.builder.js for the relevant build${action}Tx method.'
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

      // Select the correct provider based on network
      const { polygonProvider, arbitrumProvider } = require('../../config/blockchain');
      const { ethers } = require('ethers');

      let provider;
      if (network === 'sepolia' || network === 'sepolia testnet') {
        // Sepolia testnet provider — try each RPC URL sequentially until one works
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
            await p.getNetwork(); // verify it responds
            provider = p;
            logger.info(`confirmTransaction: connected to Sepolia via ${url}`);
            break;
          } catch (e) {
            logger.warn(`confirmTransaction: Sepolia RPC ${url} failed: ${e.message}`);
          }
        }

        if (!provider) {
          // All RPCs failed — on testnet just save the position and trust the txHash
          logger.warn('confirmTransaction: all Sepolia RPCs failed — saving position without receipt verification');
          provider = null;
        }
      } else if (network === 'polygon') {
        provider = polygonProvider;
      } else if (network === 'arbitrum') {
        provider = arbitrumProvider;
      } else {
        provider = ethereumProvider; // default: Ethereum Mainnet
      }

      // Wait up to 30 seconds for the receipt (handles indexing delay)
      let receipt = null;
      if (provider) {
        const maxAttempts = 6;
        for (let i = 0; i < maxAttempts; i++) {
          try {
            receipt = await provider.getTransactionReceipt(txHash);
            if (receipt) break;
          } catch (e) {
            logger.warn(`getTransactionReceipt attempt ${i + 1} failed: ${e.message}`);
          }
          if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, 5000));
        }
      }

      // For testnet: if still not found, save position anyway (tx was broadcast)
      const isTestnet = ['sepolia', 'goerli', 'mumbai', 'sepolia testnet'].includes(network);

      if (!receipt) {
        if (isTestnet) {
          // On testnet, trust the txHash — don't require on-chain confirmation
          logger.warn(`confirmTransaction: receipt not found on ${network} for ${txHash} — saving position anyway (testnet)`);
        } else {
          throw new Error('Transaction failed or not found on-chain');
        }
      }

      // On mainnet, verify the tx succeeded (status 1 = success)
      if (receipt && !isTestnet && receipt.status !== 1) {
        throw new Error('Transaction reverted on-chain');
      }

      const position = new DefiPosition({
        userId:           req.user.userId,
        protocolId:       metadata.protocolId,
        type:             positionType,
        asset: {
          symbol:  metadata.asset || '',
          amount:  parseFloat(metadata.amount) || 0,
          address: metadata.assetAddress || ''
        },
        apy:              metadata.apy || 0,
        lockPeriod:       metadata.lockPeriod || 0,
        transactionHash:  txHash,
        walletAddress:    metadata.walletAddress,
        network:          network,
        startedAt:        new Date(),
        status:           'active'
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

  async getChartHistory(req, res, next) {
    try {
      const { positionId } = req.validatedData.params;
      const { days = 30 } = req.validatedData.query || {};

      // Find position from database
      const position = await DefiPosition.findById(positionId);
      if (!position) {
        return res.status(404).json({
          status: 'error',
          message: 'Position not found'
        });
      }

      // Get chart history from chart history service
      const chartHistoryService = require('../../services/chart-history.service');
      const chartData = await chartHistoryService.getPositionChartHistory(position, parseInt(days));

      res.json({
        status: 'success',
        data: {
          chartData,
          positionId,
          asset: position.asset?.symbol,
          period: `${parseInt(days)} days`
        }
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

      // Try to get chart data from DefiChart model
      const DefiChart = require('../../models/defi-chart.model');
      let chart = await DefiChart.findOne({
        entityId: poolId,
        entityType: 'pool',
        metric: 'tvl'
      });

      let chartData = [];
      if (chart) {
        chartData = chart.get30DayTvlHistory();
      }

      // If no chart data yet, return empty — frontend shows "Collecting TVL history…"
      res.json({
        status: 'success',
        data: {
          chartData,
          poolId,
          period: `${parseInt(days)} days`
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DefiController();