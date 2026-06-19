const axios = require('axios');
const { ethers } = require('ethers');
const { Pool, Position, computePoolAddress } = require('@uniswap/v3-sdk');
const { Token, CurrencyAmount, Percent } = require('@uniswap/sdk-core');

const NFPM_ADDRESS = '0xC36442b4a4522E871399CD717aBDD847Ab11cb67'; // Uniswap V3 NonfungiblePositionManager
const ROUTER_ADDRESS = '0xE592427A0AEce92De3Edee1F18E0157C05861564'; // SwapRouter
const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea3113F6';
const QUOTER_ADDRESS = '0x61fFE014bA17989E8aBe8198ff8B04950d56B676';

class UniswapIntegration {
  constructor(config = {}) {
    this.thegraphEndpoints = {
      uniswap: config.thegraphEndpoint || 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
    };

    this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl || 'https://eth.llamarpc.com');

    // ABI imports
    this.NFPM_ABI = [
      'function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
      'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
      'function decreaseLiquidity((uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) external returns (uint256 amount0, uint256 amount1)',
      'function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) external returns (uint128 amount0, uint128 amount1)',
    ];

    this.POOL_ABI = [
      'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
      'function liquidity() external view returns (uint128)',
      'function fee() external view returns (uint24)',
      'function token0() external view returns (address)',
      'function token1() external view returns (address)',
    ];

    this.ERC20_ABI = [
      'function decimals() external view returns (uint8)',
      'function symbol() external view returns (string)',
      'function balanceOf(address owner) external view returns (uint256)',
      'function approve(address spender, uint256 amount) external returns (bool)',
    ];
  }

  /**
   * Query TheGraph for top 20 pools by TVL
   */
  async getPools() {
    try {
      const query = `{
        pools(first: 20, orderBy: totalValueLockedUSD, orderDirection: desc) {
          id
          feeTier
          token0 {
            id
            symbol
            decimals
          }
          token1 {
            id
            symbol
            decimals
          }
          totalValueLockedUSD
          volumeUSD
          feesUSD
          txCount
        }
      }`;

      const res = await axios.post(this.thegraphEndpoints.uniswap, { query });

      if (res.data.errors) {
        throw new Error(`TheGraph query error: ${res.data.errors[0].message}`);
      }

      return res.data.data.pools.map(pool => ({
        id: pool.id,
        address: pool.id,
        token0: {
          address: pool.token0.id,
          symbol: pool.token0.symbol,
          decimals: pool.token0.decimals,
        },
        token1: {
          address: pool.token1.id,
          symbol: pool.token1.symbol,
          decimals: pool.token1.decimals,
        },
        feeTier: parseInt(pool.feeTier),
        tvlUSD: parseFloat(pool.totalValueLockedUSD),
        volumeUSD: parseFloat(pool.volumeUSD),
        feesUSD: parseFloat(pool.feesUSD),
        txCount: parseInt(pool.txCount),
      }));
    } catch (error) {
      throw new Error(`Failed to fetch pools from TheGraph: ${error.message}`);
    }
  }

  /**
   * Get single pool data with 7-day price change and fee tier info
   */
  async getPool(poolAddress) {
    try {
      const query = `{
        pool(id: "${poolAddress.toLowerCase()}") {
          id
          feeTier
          token0 {
            id
            symbol
            decimals
            derivedETH
          }
          token1 {
            id
            symbol
            decimals
            derivedETH
          }
          sqrtPrice
          tick
          liquidity
          totalValueLockedUSD
          volumeUSD
          feesUSD
          txCount
          poolDayData(first: 7, orderBy: date, orderDirection: desc) {
            date
            high
            low
            open
            close
            volumeUSD
          }
        }
      }`;

      const res = await axios.post(this.thegraphEndpoints.uniswap, { query });

      if (res.data.errors) {
        throw new Error(`TheGraph query error: ${res.data.errors[0].message}`);
      }

      const pool = res.data.data.pool;

      if (!pool) {
        throw new Error(`Pool not found: ${poolAddress}`);
      }

      // Calculate 7-day price change
      const poolDayData = pool.poolDayData || [];
      let priceChange7d = 0;
      if (poolDayData.length > 0) {
        const oldestDay = poolDayData[poolDayData.length - 1];
        const newestDay = poolDayData[0];
        const oldPrice = parseFloat(oldestDay.open);
        const newPrice = parseFloat(newestDay.close);
        priceChange7d = ((newPrice - oldPrice) / oldPrice) * 100;
      }

      return {
        id: pool.id,
        address: pool.id,
        feeTier: parseInt(pool.feeTier),
        token0: {
          address: pool.token0.id,
          symbol: pool.token0.symbol,
          decimals: pool.token0.decimals,
          derivedETH: parseFloat(pool.token0.derivedETH),
        },
        token1: {
          address: pool.token1.id,
          symbol: pool.token1.symbol,
          decimals: pool.token1.decimals,
          derivedETH: parseFloat(pool.token1.derivedETH),
        },
        sqrtPrice: pool.sqrtPrice,
        tick: parseInt(pool.tick),
        liquidity: pool.liquidity,
        tvlUSD: parseFloat(pool.totalValueLockedUSD),
        volumeUSD: parseFloat(pool.volumeUSD),
        feesUSD: parseFloat(pool.feesUSD),
        txCount: parseInt(pool.txCount),
        priceChange7d,
        poolDayData: poolDayData.map(day => ({
          date: day.date,
          high: parseFloat(day.high),
          low: parseFloat(day.low),
          open: parseFloat(day.open),
          close: parseFloat(day.close),
          volumeUSD: parseFloat(day.volumeUSD),
        })),
      };
    } catch (error) {
      throw new Error(`Failed to fetch pool data: ${error.message}`);
    }
  }

  /**
   * Build unsigned calldata for adding liquidity
   * Returns { to, data, value } for MetaMask to sign
   */
  async addLiquidityCalldata(poolAddress, amount0, amount1, address, options = {}) {
    try {
      const deadline = Math.floor(Date.now() / 1000) + (options.slippageTolerance || 60);
      const amount0Min = BigInt(amount0) * BigInt(100 - (options.minSlippage || 0.5)) / BigInt(100);
      const amount1Min = BigInt(amount1) * BigInt(100 - (options.minSlippage || 0.5)) / BigInt(100);

      // Query pool details from TheGraph to get token addresses
      const query = `{
        pool(id: "${poolAddress.toLowerCase()}") {
          token0 { id decimals }
          token1 { id decimals }
          feeTier
          sqrtPrice
          tick
        }
      }`;

      const res = await axios.post(this.thegraphEndpoints.uniswap, { query });
      const poolData = res.data.data.pool;

      if (!poolData) {
        throw new Error(`Pool not found: ${poolAddress}`);
      }

      const token0Address = poolData.token0.id;
      const token1Address = poolData.token1.id;
      const feeTier = parseInt(poolData.feeTier);

      // Calculate tick range (simplified - ±100 ticks from current)
      const currentTick = parseInt(poolData.tick);
      const tickLower = Math.floor(currentTick / 60) * 60 - 60;
      const tickUpper = Math.ceil(currentTick / 60) * 60 + 60;

      // Build mint params
      const mintParams = {
        token0: token0Address,
        token1: token1Address,
        fee: feeTier,
        tickLower,
        tickUpper,
        amount0Desired: amount0.toString(),
        amount1Desired: amount1.toString(),
        amount0Min: amount0Min.toString(),
        amount1Min: amount1Min.toString(),
        recipient: address,
        deadline: deadline.toString(),
      };

      // Encode the function call
      const iface = new ethers.utils.Interface([
        'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) external returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
      ]);

      const data = iface.encodeFunctionData('mint', [mintParams]);

      return {
        to: NFPM_ADDRESS,
        data,
        value: '0',
        from: address,
        gasEstimate: options.gasEstimate || '500000',
        params: mintParams,
      };
    } catch (error) {
      throw new Error(`Failed to build addLiquidity calldata: ${error.message}`);
    }
  }

  /**
   * Build unsigned calldata for removing liquidity
   * Reads position from NonfungiblePositionManager contract
   */
  async removeLiquidityCalldata(tokenId, address, options = {}) {
    try {
      const nfpm = new ethers.Contract(NFPM_ADDRESS, this.NFPM_ABI, this.provider);

      // Get position data
      const positionData = await nfpm.positions(tokenId);

      const deadline = Math.floor(Date.now() / 1000) + (options.slippageTolerance || 60);
      const amount0Min = BigInt(positionData.tokensOwed0) * BigInt(100 - (options.minSlippage || 0.5)) / BigInt(100);
      const amount1Min = BigInt(positionData.tokensOwed1) * BigInt(100 - (options.minSlippage || 0.5)) / BigInt(100);

      const iface = new ethers.utils.Interface(this.NFPM_ABI);

      // Build decreaseLiquidity calldata
      const decreaseLiquidityParams = {
        tokenId: tokenId.toString(),
        liquidity: positionData.liquidity.toString(),
        amount0Min: amount0Min.toString(),
        amount1Min: amount1Min.toString(),
        deadline: deadline.toString(),
      };

      const decreaseLiquidityData = iface.encodeFunctionData('decreaseLiquidity', [
        decreaseLiquidityParams,
      ]);

      // Build collect calldata
      const collectParams = {
        tokenId: tokenId.toString(),
        recipient: address,
        amount0Max: '340282366920938463463374607431768211455', // uint128 max
        amount1Max: '340282366920938463463374607431768211455',
      };

      const collectData = iface.encodeFunctionData('collect', [collectParams]);

      return {
        transactionSequence: [
          {
            to: NFPM_ADDRESS,
            data: decreaseLiquidityData,
            value: '0',
            description: 'Decrease liquidity',
          },
          {
            to: NFPM_ADDRESS,
            data: collectData,
            value: '0',
            description: 'Collect tokens',
          },
        ],
        position: {
          tokenId,
          token0: positionData.token0,
          token1: positionData.token1,
          fee: positionData.fee,
          liquidity: positionData.liquidity.toString(),
          tokensOwed0: positionData.tokensOwed0.toString(),
          tokensOwed1: positionData.tokensOwed1.toString(),
        },
        from: address,
      };
    } catch (error) {
      throw new Error(`Failed to build removeLiquidity calldata: ${error.message}`);
    }
  }

  /**
   * Get position data from NonfungiblePositionManager (on-chain read)
   */
  async getPosition(tokenId, userAddress = null) {
    try {
      const nfpm = new ethers.Contract(NFPM_ADDRESS, this.NFPM_ABI, this.provider);

      const positionData = await nfpm.positions(tokenId);

      // Fetch token details
      const token0Contract = new ethers.Contract(
        positionData.token0,
        this.ERC20_ABI,
        this.provider
      );
      const token1Contract = new ethers.Contract(
        positionData.token1,
        this.ERC20_ABI,
        this.provider
      );

      const [token0Symbol, token0Decimals, token1Symbol, token1Decimals] = await Promise.all([
        token0Contract.symbol(),
        token0Contract.decimals(),
        token1Contract.symbol(),
        token1Contract.decimals(),
      ]);

      // Get current pool state for pricing
      const pool = new ethers.Contract(
        computePoolAddress({
          factoryAddress: FACTORY_ADDRESS,
          tokenA: new Token(1, positionData.token0, token0Decimals, token0Symbol),
          tokenB: new Token(1, positionData.token1, token1Decimals, token1Symbol),
          fee: positionData.fee,
        }),
        this.POOL_ABI,
        this.provider
      );

      const slot0 = await pool.slot0();

      return {
        tokenId: tokenId.toString(),
        nonce: positionData.nonce,
        operator: positionData.operator,
        token0: {
          address: positionData.token0,
          symbol: token0Symbol,
          decimals: token0Decimals,
        },
        token1: {
          address: positionData.token1,
          symbol: token1Symbol,
          decimals: token1Decimals,
        },
        fee: positionData.fee,
        tickLower: positionData.tickLower,
        tickUpper: positionData.tickUpper,
        liquidity: positionData.liquidity.toString(),
        feeGrowthInside0LastX128: positionData.feeGrowthInside0LastX128.toString(),
        feeGrowthInside1LastX128: positionData.feeGrowthInside1LastX128.toString(),
        tokensOwed0: positionData.tokensOwed0.toString(),
        tokensOwed1: positionData.tokensOwed1.toString(),
        sqrtPriceX96: slot0.sqrtPriceX96.toString(),
        currentTick: slot0.tick,
        isInRange: slot0.tick >= positionData.tickLower && slot0.tick <= positionData.tickUpper,
      };
    } catch (error) {
      throw new Error(`Failed to fetch position: ${error.message}`);
    }
  }

  /**
   * Helper: Get multiple positions for a user
   */
  async getPositions(userAddress) {
    try {
      const query = `{
        positions(where: { owner: "${userAddress.toLowerCase()}" }, first: 100) {
          id
          tokenId
          owner
          pool {
            id
            token0 { symbol decimals }
            token1 { symbol decimals }
            feeTier
          }
          tickLower
          tickUpper
          liquidity
        }
      }`;

      const res = await axios.post(this.thegraphEndpoints.uniswap, { query });

      if (res.data.errors) {
        throw new Error(`TheGraph query error: ${res.data.errors[0].message}`);
      }

      return res.data.data.positions.map(pos => ({
        tokenId: pos.tokenId,
        poolId: pos.pool.id,
        token0Symbol: pos.pool.token0.symbol,
        token1Symbol: pos.pool.token1.symbol,
        feeTier: pos.pool.feeTier,
        tickLower: pos.tickLower,
        tickUpper: pos.tickUpper,
        liquidity: pos.liquidity,
      }));
    } catch (error) {
      throw new Error(`Failed to fetch positions: ${error.message}`);
    }
  }
}

module.exports = UniswapIntegration;
