'use strict';

const axios   = require('axios');
const { ethers } = require('ethers');
const { logger } = require('../../api/middlewares/logger.middleware');

const NFPM_ADDRESS    = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const ROUTER_ADDRESS  = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

// Known pool data — fallback when TheGraph is unavailable
// Avoids on-chain RPC calls entirely for common pools
const KNOWN_POOLS = {
  // ETH-USDC 0.05% fee
  '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640': {
    token0: { id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', decimals: 6  },
    token1: { id: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'WETH', decimals: 18 },
    feeTier: 500,
    tickSpacing: 10,
  },
  // ETH-USDC 0.3% fee
  '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8': {
    token0: { id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', decimals: 6  },
    token1: { id: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'WETH', decimals: 18 },
    feeTier: 3000,
    tickSpacing: 60,
  },
  // USDC-USDT 0.01% fee
  '0x3416cf6c708da44db2624d63ea0aaef7113527c6': {
    token0: { id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', decimals: 6  },
    token1: { id: '0xdac17f958d2ee523a2206206994597c13d831ec7', symbol: 'USDT', decimals: 6  },
    feeTier: 100,
    tickSpacing: 1,
  },
  // WBTC-ETH 0.3% fee
  '0xcbcdf9626bc03e24f779434178a73a0b4bad62ed': {
    token0: { id: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', symbol: 'WBTC', decimals: 8  },
    token1: { id: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'WETH', decimals: 18 },
    feeTier: 3000,
    tickSpacing: 60,
  },
};

// Tick spacing per fee tier
const TICK_SPACING = { 100: 1, 500: 10, 3000: 60, 10000: 200 };

// NFPM ABI (ethers v6 format — use ethers.Interface)
const NFPM_ABI = [
  'function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function decreaseLiquidity((uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) external payable returns (uint256 amount0, uint256 amount1)',
  'function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) external payable returns (uint128 amount0, uint128 amount1)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
];

class UniswapIntegration {
  /**
   * @param {ethers.Provider} provider — ethers v6 provider from config/blockchain.js
   */
  constructor(provider) {
    // Accept the ethers v5 provider passed in — do NOT create a new one
    if (!provider) throw new Error('UniswapIntegration requires an ethers v5 provider');
    this.provider = provider;

    const tgKey = process.env.THEGRAPH_API_KEY || '';
    this.thegraphUrl = tgKey
      ? `https://gateway.thegraph.com/api/${tgKey}/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV`
      : 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3';

    this.nfpm = new ethers.Contract(NFPM_ADDRESS, NFPM_ABI, this.provider);
  }

  // ── Pool data ─────────────────────────────────────────────────────────────

  /**
   * Get pool data — uses local cache first, then TheGraph, NO on-chain calls.
   * On-chain RPC calls for pool data are unreliable on public endpoints.
   */
  async getPoolData(poolAddress) {
    const lower = poolAddress.toLowerCase();

    // 1. Local known-pools cache (instant, no network)
    if (KNOWN_POOLS[lower]) {
      logger.debug(`UniswapIntegration: pool ${lower} from local cache`);
      return KNOWN_POOLS[lower];
    }

    // 2. TheGraph (network, but no on-chain RPC)
    try {
      const query = `{
        pool(id: "${lower}") {
          token0 { id symbol decimals }
          token1 { id symbol decimals }
          feeTier tick sqrtPrice
        }
      }`;
      const resp = await axios.post(this.thegraphUrl, { query }, { timeout: 6000 });
      const pool = resp.data?.data?.pool;
      if (pool) {
        const data = {
          token0:      { id: pool.token0.id, symbol: pool.token0.symbol, decimals: parseInt(pool.token0.decimals) },
          token1:      { id: pool.token1.id, symbol: pool.token1.symbol, decimals: parseInt(pool.token1.decimals) },
          feeTier:     parseInt(pool.feeTier),
          tickSpacing: TICK_SPACING[parseInt(pool.feeTier)] || 60,
          currentTick: parseInt(pool.tick || 0),
        };
        // Cache it for this process lifetime
        KNOWN_POOLS[lower] = data;
        return data;
      }
    } catch (err) {
      logger.warn(`UniswapIntegration: TheGraph failed for pool ${lower}:`, err.message);
    }

    throw new Error(
      `Pool ${poolAddress} not found in local cache or TheGraph. ` +
      'Add it to KNOWN_POOLS in uniswap.js or set THEGRAPH_API_KEY in .env'
    );
  }

  async getPools() {
    try {
      const query = `{
        pools(first: 20, orderBy: totalValueLockedUSD, orderDirection: desc) {
          id token0 { id symbol decimals } token1 { id symbol decimals }
          feeTier totalValueLockedUSD volumeUSD feesUSD tick
        }
      }`;
      const resp = await axios.post(this.thegraphUrl, { query }, { timeout: 8000 });
      return resp.data?.data?.pools || [];
    } catch (err) {
      logger.error('UniswapIntegration.getPools failed:', err.message);
      return [];
    }
  }

  // ── Add liquidity ─────────────────────────────────────────────────────────

  /**
   * Build unsigned addLiquidity calldata for NonfungiblePositionManager.mint().
   *
   * @param poolAddress  - Pool contract address
   * @param amount0      - Human-readable amount of token0 (e.g. "100" for 100 USDC)
   * @param amount1      - Human-readable amount of token1 (e.g. "0.05" for 0.05 ETH)
   * @param userAddress  - User's wallet address (recipient)
   * @param options      - { slippageBps: 50, deadlineMinutes: 30, tickLower?, tickUpper? }
   */
  async addLiquidityCalldata(poolAddress, amount0, amount1, userAddress, options = {}) {
    try {
      // Checksum both addresses before any ABI encoding
      const checksummedUser = ethers.utils.getAddress(userAddress);
      const checksummedPool = ethers.utils.getAddress(poolAddress);
      const poolData    = await this.getPoolData(checksummedPool);
      const slippageBps = options.slippageBps   || 50;  // 0.5% default
      const deadline    = Math.floor(Date.now() / 1000) + (options.deadlineMinutes || 30) * 60;
      const tickSpacing = poolData.tickSpacing   || TICK_SPACING[poolData.feeTier] || 60;

      // Convert human-readable amounts to wei using correct token decimals
      const amount0Wei = ethers.utils.parseUnits(
        parseFloat(amount0).toFixed(poolData.token0.decimals),
        poolData.token0.decimals
      );
      const amount1Wei = ethers.utils.parseUnits(
        parseFloat(amount1).toFixed(poolData.token1.decimals),
        poolData.token1.decimals
      );

      // Apply slippage to min amounts
      const slippageFactor = 10000 - slippageBps;
      const amount0Min = amount0Wei.mul(slippageFactor).div(10000);
      const amount1Min = amount1Wei.mul(slippageFactor).div(10000);

      // Tick range — use ±10 tick spacings from current tick (wide range = less management needed)
      const currentTick = poolData.currentTick || 0;
      const range = tickSpacing * 10;
      const tickLower = options.tickLower !== undefined
        ? options.tickLower
        : Math.floor((currentTick - range) / tickSpacing) * tickSpacing;
      const tickUpper = options.tickUpper !== undefined
        ? options.tickUpper
        : Math.ceil((currentTick + range) / tickSpacing) * tickSpacing;

      const mintParams = {
        token0:         ethers.utils.getAddress(poolData.token0.id),
        token1:         ethers.utils.getAddress(poolData.token1.id),
        fee:            poolData.feeTier,
        tickLower,
        tickUpper,
        amount0Desired: amount0Wei.toString(),
        amount1Desired: amount1Wei.toString(),
        amount0Min:     amount0Min.toString(),
        amount1Min:     amount1Min.toString(),
        recipient:      checksummedUser,
        deadline:       deadline.toString(),
      };

      // ethers v5: use ethers.utils.Interface
      const iface = new ethers.utils.Interface([
        'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
      ]);

      const data = iface.encodeFunctionData('mint', [mintParams]);

      logger.info(`addLiquidityCalldata: pool=${checksummedPool} amounts=${amount0Wei}/${amount1Wei} ticks=${tickLower}/${tickUpper}`);

      return {
        to:          NFPM_ADDRESS,
        data,
        value:       '0',
        gasLimit:    '500000',
        from:        checksummedUser,
        mintParams,  // include for debugging
      };
    } catch (err) {
      logger.error('addLiquidityCalldata failed:', err.message);
      throw new Error(`Failed to build addLiquidity calldata: ${err.message}`);
    }
  }

  // ── Remove liquidity ──────────────────────────────────────────────────────

  /**
   * Build unsigned removeLiquidity calldata.
   * For Uniswap V3, lpAmount is the NFT tokenId.
   * Encodes decreaseLiquidity + collect in sequence (two txs or multicall).
   */
  async removeLiquidityCalldata(tokenId, userAddress, options = {}) {
    try {
      if (!tokenId) throw new Error('tokenId is required for removeLiquidity');

      // Checksum the user address before any ABI encoding
      const checksummedUser = ethers.utils.getAddress(userAddress);

      // Get position data from contract
      const position = await this.nfpm.positions(tokenId);
      const liquidity = position.liquidity.toString();

      if (liquidity === '0') throw new Error('Position has no liquidity');

      const slippageBps = options.slippageBps || 50;
      const deadline    = Math.floor(Date.now() / 1000) + (options.deadlineMinutes || 30) * 60;
      const slippage    = (10000 - slippageBps);

      const iface = new ethers.utils.Interface([
        'function decreaseLiquidity((uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params) external payable returns (uint256 amount0, uint256 amount1)',
        'function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params) external payable returns (uint128 amount0, uint128 amount1)',
        'function multicall(bytes[] data) external payable returns (bytes[] results)',
      ]);

      const MAX_UINT128 = '340282366920938463463374607431768211455';

      // Encode both calls for multicall
      const decreaseData = iface.encodeFunctionData('decreaseLiquidity', [{
        tokenId:    tokenId.toString(),
        liquidity,
        amount0Min: '0',
        amount1Min: '0',
        deadline:   deadline.toString(),
      }]);

      const collectData = iface.encodeFunctionData('collect', [{
        tokenId:    tokenId.toString(),
        recipient:  checksummedUser,
        amount0Max: MAX_UINT128,
        amount1Max: MAX_UINT128,
      }]);

      const multicallData = iface.encodeFunctionData('multicall', [[decreaseData, collectData]]);

      logger.info(`removeLiquidityCalldata: tokenId=${tokenId} liquidity=${liquidity}`);

      return {
        to:       NFPM_ADDRESS,
        data:     multicallData,
        value:    '0',
        gasLimit: '400000',
        from:     checksummedUser,
      };
    } catch (err) {
      logger.error('removeLiquidityCalldata failed:', err.message);
      throw new Error(`Failed to build removeLiquidity calldata: ${err.message}`);
    }
  }

  // ── Position read ─────────────────────────────────────────────────────────

  async getPosition(tokenId) {
    try {
      const pos = await this.nfpm.positions(tokenId);
      return {
        tokenId:     tokenId.toString(),
        token0:      pos.token0,
        token1:      pos.token1,
        fee:         pos.fee,
        tickLower:   pos.tickLower,
        tickUpper:   pos.tickUpper,
        liquidity:   pos.liquidity.toString(),
        tokensOwed0: pos.tokensOwed0.toString(),
        tokensOwed1: pos.tokensOwed1.toString(),
      };
    } catch (err) {
      logger.error(`getPosition(${tokenId}) failed:`, err.message);
      throw err;
    }
  }

  async getPositions(userAddress) {
    try {
      const count = await this.nfpm.balanceOf(userAddress);
      const tokenIds = await Promise.all(
        Array.from({ length: count.toNumber() }, (_, i) =>
          this.nfpm.tokenOfOwnerByIndex(userAddress, i)
        )
      );
      return Promise.all(tokenIds.map(id => this.getPosition(id)));
    } catch (err) {
      logger.error('getPositions failed:', err.message);
      return [];
    }
  }
}

module.exports = UniswapIntegration;