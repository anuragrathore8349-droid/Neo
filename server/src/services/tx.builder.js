'use strict';

/**
 * Transaction Builder Service
 *
 * Builds unsigned Ethereum transactions for all DeFi operations.
 * Returns { to, data, value, gasLimit } objects ready for MetaMask to sign.
 *
 * Pattern:
 *   1. POST /api/defi/build-tx  → buildTx() returns unsignedTx
 *   2. MetaMask signs + submits → returns txHash
 *   3. POST /api/defi/confirm-tx → saves DefiPosition with real txHash
 */

const { ethers }  = require('ethers');
const { logger }  = require('../api/middlewares/logger.middleware');
const { ethereumProvider, polygonProvider } = require('../config/blockchain');

// ── Protocol integration classes ────────────────────────────────────────────
const LidoIntegration     = require('../integrations/defi/lido');
const AaveIntegration     = require('../integrations/defi/aave');
const UniswapIntegration  = require('../integrations/defi/uniswap');
const CurveIntegration    = require('../integrations/defi/curve');

// ── Token address map (mainnet) ──────────────────────────────────────────────
const TOKEN_ADDRESSES = {
  ETH:   'native',
  WETH:  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  stETH: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
  AAVE:  '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
  CRV:   '0xD533a949740bb3306d119CC777fa900bA034cd52',
  USDC:  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDT:  '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  DAI:   '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  WBTC:  '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  UNI:   '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
};

// ── Aave V3 asset addresses ───────────────────────────────────────────────────
const AAVE_ASSETS = {
  ETH:  TOKEN_ADDRESSES.WETH,
  WETH: TOKEN_ADDRESSES.WETH,
  USDC: TOKEN_ADDRESSES.USDC,
  USDT: TOKEN_ADDRESSES.USDT,
  DAI:  TOKEN_ADDRESSES.DAI,
  WBTC: TOKEN_ADDRESSES.WBTC,
};

// ── Curve pool addresses ──────────────────────────────────────────────────────
const CURVE_POOLS = {
  '3pool': '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7',
  'steth': '0xDC24316b9AE028F1497c275EB9192a3Ea0f67022',
  'frax':  '0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B',
};

// ── Gas limit constants ───────────────────────────────────────────────────────
const GAS_LIMITS = {
  ETH_TRANSFER:     21_000n,
  ERC20_TRANSFER:   65_000n,
  LIDO_STAKE:      200_000n,
  AAVE_SUPPLY:     250_000n,
  AAVE_WITHDRAW:   250_000n,
  UNISWAP_ADD:     500_000n,
  UNISWAP_REMOVE:  400_000n,
  CURVE_DEPOSIT:   400_000n,
  CURVE_WITHDRAW:  400_000n,
  FARM_HARVEST:    200_000n,
  GENERIC:         300_000n,
};

// ── Address checksum helper ────────────────────────────────────────────────────
/**
 * Normalize any Ethereum address to EIP-55 checksum format.
 * ethers v5 ABI encoder requires checksummed addresses.
 * Throws a clear error if the address is fundamentally invalid.
 */
function checksumAddress(address, fieldName = 'address') {
  if (!address || typeof address !== 'string' || address.trim() === '') {
    throw new Error(
      `${fieldName} is empty. Please connect your MetaMask wallet before making transactions.`
    );
  }
  try {
    return ethers.utils.getAddress(address);
  } catch (err) {
    throw new Error(
      `Invalid Ethereum address for ${fieldName}: "${address}". ` +
      'Connect MetaMask and ensure the correct account is selected.'
    );
  }
}

class TxBuilderService {

  // ════════════════════════════════════════════════════════════════════════════
  // MAIN ROUTER — called by buildTransaction controller
  // ════════════════════════════════════════════════════════════════════════════
  async buildTx(userId, params) {
    const { action } = params;
    // Checksum the wallet address once here — all downstream methods receive clean address
    const walletAddress = checksumAddress(params.walletAddress, 'walletAddress');
    const cleanParams = { ...params, walletAddress };

    logger.info(`buildTx: action=${action} wallet=${walletAddress}`);

    switch (action) {
      case 'stake':           return this.buildStakeTx(cleanParams);
      case 'unstake':         return this.buildUnstakeTx(cleanParams);
      case 'addLiquidity':    return this.buildPoolAddLiquidityTx(cleanParams);
      case 'removeLiquidity': return this.buildPoolRemoveLiquidityTx(cleanParams);
      case 'deposit':         return this.buildFarmDepositTx(cleanParams);
      case 'withdraw':        return this.buildFarmWithdrawTx(cleanParams);
      case 'harvest':         return this.buildFarmHarvestTx(cleanParams);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STAKING
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Build stake transaction.
   * Routes to the correct protocol (Lido for ETH, Aave for governance tokens).
   */
  async buildStakeTx({ protocolId, assetSymbol, amount, walletAddress }) {
    if (!protocolId)    throw new Error('protocolId is required for stake');
    if (!assetSymbol)   throw new Error('assetSymbol is required for stake');
    if (!amount)        throw new Error('amount is required for stake');
    if (!walletAddress) throw new Error('walletAddress is required for stake');

    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || amountFloat <= 0) throw new Error('amount must be a positive number');

    const protocol = protocolId.toLowerCase().replace(/\s+/g, '');
    const symbol   = assetSymbol.toUpperCase();

    logger.info(`buildStakeTx: protocol=${protocol} asset=${symbol} amount=${amount}`);

    // ── Lido: ETH → stETH ──────────────────────────────────────────────────
    if (protocol === 'lido' || symbol === 'ETH') {
      const lido = new LidoIntegration(ethereumProvider);
      const amountWei = ethers.parseEther(amount.toString());
      const unsignedTx = await lido.buildStakeCalldata(amountWei);
      return {
        ...unsignedTx,
        gasLimit: GAS_LIMITS.LIDO_STAKE.toString(),
      };
    }

    // ── Aave: Supply any supported asset ──────────────────────────────────
    if (protocol === 'aave' || protocol === 'aavev3') {
      const aave = new AaveIntegration(ethereumProvider);
      const assetAddress = AAVE_ASSETS[symbol];
      if (!assetAddress) throw new Error(`Asset ${symbol} not supported on Aave V3`);
      const unsignedTx = await aave.deposit(assetAddress, amount, walletAddress);
      return {
        ...unsignedTx,
        gasLimit: GAS_LIMITS.AAVE_SUPPLY.toString(),
      };
    }

    // ── Curve: Lock CRV for veCRV ─────────────────────────────────────────
    if (protocol === 'curve' && symbol === 'CRV') {
      // veCRV locking — encode lockTokens calldata
      const VOTING_ESCROW = '0x5f3b5DfEb7B28CDbD7FAba78963Fb202c93EfEA7';
      const iface = new ethers.utils.Interface([
        'function create_lock(uint256 _value, uint256 _unlock_time) external',
      ]);
      const amountWei  = ethers.utils.parseUnits(amount.toString(), 18);
      const unlockTime = Math.floor(Date.now() / 1000) + 4 * 365 * 24 * 3600; // max 4 years
      const data = iface.encodeFunctionData('create_lock', [amountWei, unlockTime]);
      return {
        to:       VOTING_ESCROW,
        data,
        value:    '0',
        gasLimit: GAS_LIMITS.GENERIC.toString(),
      };
    }

    // ── Generic ERC-20 approve + stake stub ───────────────────────────────
    // For any protocol not yet specifically integrated, return an ERC-20 transfer
    // to the protocol's staking contract as a placeholder.
    // Replace this with the real integration as you add protocols.
    logger.warn(`buildStakeTx: no specific integration for protocol=${protocol}, using generic stub`);
    const tokenAddress = TOKEN_ADDRESSES[symbol];
    if (!tokenAddress || tokenAddress === 'native') {
      throw new Error(`No token address found for ${symbol}. Add it to TOKEN_ADDRESSES in tx.builder.js`);
    }
    const iface = new ethers.utils.Interface([
      'function transfer(address to, uint256 amount) external returns (bool)',
    ]);
    const amountWei = ethers.utils.parseUnits(amount.toString(), 18);
    const data = iface.encodeFunctionData('transfer', [walletAddress, amountWei]);
    return {
      to:       tokenAddress,
      data,
      value:    '0',
      gasLimit: GAS_LIMITS.GENERIC.toString(),
    };
  }

  /**
   * Build unstake transaction.
   */
  async buildUnstakeTx({ protocolId, assetSymbol, amount, positionId, walletAddress }) {
    if (!walletAddress) throw new Error('walletAddress is required');
    if (!amount)        throw new Error('amount is required');

    const protocol = (protocolId || '').toLowerCase().replace(/\s+/g, '');
    const symbol   = (assetSymbol || 'ETH').toUpperCase();

    logger.info(`buildUnstakeTx: protocol=${protocol} asset=${symbol} amount=${amount}`);

    // ── Aave: Withdraw ────────────────────────────────────────────────────
    if (protocol === 'aave' || protocol === 'aavev3') {
      const aave = new AaveIntegration(ethereumProvider);
      const assetAddress = AAVE_ASSETS[symbol];
      if (!assetAddress) throw new Error(`Asset ${symbol} not supported on Aave V3`);
      const unsignedTx = await aave.withdraw(assetAddress, amount, walletAddress);
      return { ...unsignedTx, gasLimit: GAS_LIMITS.AAVE_WITHDRAW.toString() };
    }

    // ── Lido: stETH has no direct unstake tx in V1 (use withdrawal queue) ─
    if (protocol === 'lido') {
      // Lido V2 withdrawal queue
      const WITHDRAWAL_QUEUE = '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1';
      const iface = new ethers.utils.Interface([
        'function requestWithdrawals(uint256[] amounts, address owner) external returns (uint256[])',
      ]);
      const amountWei = ethers.parseEther(amount.toString());
      const data = iface.encodeFunctionData('requestWithdrawals', [[amountWei], walletAddress]);
      return { to: WITHDRAWAL_QUEUE, data, value: '0', gasLimit: GAS_LIMITS.GENERIC.toString() };
    }

    throw new Error(`Unstake not implemented for protocol: ${protocol}. Add the integration in tx.builder.js`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LIQUIDITY POOLS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Build add liquidity transaction.
   * For Uniswap V3: encodes NonfungiblePositionManager.mint() calldata.
   */
  async buildPoolAddLiquidityTx({ protocolId, poolId, token0Amount, token1Amount, walletAddress }) {
    if (!poolId)        throw new Error('poolId is required');
    if (!token0Amount)  throw new Error('token0Amount is required');
    if (!token1Amount)  throw new Error('token1Amount is required');
    if (!walletAddress) throw new Error('walletAddress is required');

    const protocol = (protocolId || 'uniswap').toLowerCase().replace(/\s+/g, '');

    logger.info(`buildPoolAddLiquidityTx: protocol=${protocol} pool=${poolId} amounts=${token0Amount}/${token1Amount}`);

    // ── Uniswap V3 ────────────────────────────────────────────────────────
    if (protocol.includes('uniswap')) {
      const uniswap = new UniswapIntegration(ethereumProvider);
      // token0Amount and token1Amount are human-readable (e.g. "100" for 100 USDC)
      // UniswapIntegration.addLiquidityCalldata handles decimal conversion internally
      return uniswap.addLiquidityCalldata(
        poolId,
        token0Amount,  // e.g. "100" → parsed as 100 USDC (6 decimals)
        token1Amount,  // e.g. "100" → parsed as 100 WETH (18 decimals)
        walletAddress,
        { slippageBps: 50, deadlineMinutes: 30 }
      );
    }

    // ── Curve: add_liquidity ──────────────────────────────────────────────
    if (protocol.includes('curve')) {
      return this._buildCurveAddLiquidity(poolId, token0Amount, token1Amount, walletAddress);
    }

    throw new Error(`addLiquidity not implemented for protocol: ${protocol}`);
  }

  /**
   * Build remove liquidity transaction.
   */
  async buildPoolRemoveLiquidityTx({ protocolId, poolId, lpAmount, walletAddress }) {
    if (!poolId)        throw new Error('poolId is required');
    if (!lpAmount)      throw new Error('lpAmount is required');
    if (!walletAddress) throw new Error('walletAddress is required');

    const protocol = (protocolId || 'uniswap').toLowerCase().replace(/\s+/g, '');

    logger.info(`buildPoolRemoveLiquidityTx: protocol=${protocol} pool=${poolId} lp=${lpAmount}`);

    if (protocol.includes('uniswap')) {
      const uniswap = new UniswapIntegration(ethereumProvider);
      // lpAmount here is the NFT tokenId for Uniswap V3
      return uniswap.removeLiquidity(lpAmount, null, walletAddress);
    }

    if (protocol.includes('curve')) {
      return this._buildCurveRemoveLiquidity(poolId, lpAmount, walletAddress);
    }

    throw new Error(`removeLiquidity not implemented for protocol: ${protocol}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // YIELD FARMS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Build farm deposit transaction.
   */
  async buildFarmDepositTx({ protocolId, farmId, amount, walletAddress }) {
    if (!farmId)        throw new Error('farmId is required');
    if (!amount)        throw new Error('amount is required');
    if (!walletAddress) throw new Error('walletAddress is required');

    const protocol = (protocolId || '').toLowerCase();
    const amountWei = ethers.utils.parseUnits(amount.toString(), 18);

    logger.info(`buildFarmDepositTx: protocol=${protocol} farm=${farmId} amount=${amount}`);

    // ── Curve gauge deposit ───────────────────────────────────────────────
    if (protocol.includes('curve')) {
      const iface = new ethers.utils.Interface([
        'function deposit(uint256 _value) external',
        'function deposit(uint256 _value, address _addr) external',
      ]);
      const poolAddress = this._resolveCurvePool(farmId);
      const data = iface.encodeFunctionData('deposit(uint256)', [amountWei]);
      return { to: poolAddress, data, value: '0', gasLimit: GAS_LIMITS.CURVE_DEPOSIT.toString() };
    }

    // ── Uniswap staking (if applicable) ──────────────────────────────────
    if (protocol.includes('uniswap')) {
      // Uniswap V3 farms stake LP NFTs, not ERC20
      // Return a generic approval as placeholder
      const STAKER = '0xe34139463bA50bD61336E0c446Bd8C0867c6Fe65'; // Uniswap V3 Staker
      const iface = new ethers.utils.Interface([
        'function onERC721Received(address,address,uint256,bytes) external returns (bytes4)',
      ]);
      return { to: STAKER, data: '0x', value: '0', gasLimit: GAS_LIMITS.GENERIC.toString() };
    }

    throw new Error(`Farm deposit not implemented for protocol: ${protocol}. Add it in tx.builder.js`);
  }

  /**
   * Build farm withdraw transaction.
   */
  async buildFarmWithdrawTx({ protocolId, farmId, amount, walletAddress }) {
    if (!farmId)        throw new Error('farmId is required');
    if (!amount)        throw new Error('amount is required');
    if (!walletAddress) throw new Error('walletAddress is required');

    const protocol = (protocolId || '').toLowerCase();
    const amountWei = ethers.utils.parseUnits(amount.toString(), 18);

    logger.info(`buildFarmWithdrawTx: protocol=${protocol} farm=${farmId} amount=${amount}`);

    if (protocol.includes('curve')) {
      const iface = new ethers.utils.Interface(['function withdraw(uint256 _value) external']);
      const poolAddress = this._resolveCurvePool(farmId);
      const data = iface.encodeFunctionData('withdraw', [amountWei]);
      return { to: poolAddress, data, value: '0', gasLimit: GAS_LIMITS.CURVE_WITHDRAW.toString() };
    }

    throw new Error(`Farm withdraw not implemented for protocol: ${protocol}`);
  }

  /**
   * Build farm harvest transaction.
   */
  async buildFarmHarvestTx({ protocolId, farmId, walletAddress }) {
    if (!farmId)        throw new Error('farmId is required');
    if (!walletAddress) throw new Error('walletAddress is required');

    const protocol = (protocolId || '').toLowerCase();

    logger.info(`buildFarmHarvestTx: protocol=${protocol} farm=${farmId}`);

    if (protocol.includes('curve')) {
      // Curve gauges: claim_rewards() or mint() on minter
      const MINTER = '0xd061D61a4d941c39E5453435B6345Dc261C2fcE0';
      const iface  = new ethers.utils.Interface(['function mint(address gauge_addr) external']);
      const poolAddress = this._resolveCurvePool(farmId);
      const data = iface.encodeFunctionData('mint', [poolAddress]);
      return { to: MINTER, data, value: '0', gasLimit: GAS_LIMITS.FARM_HARVEST.toString() };
    }

    if (protocol.includes('uniswap')) {
      const STAKER = '0xe34139463bA50bD61336E0c446Bd8C0867c6Fe65';
      const iface  = new ethers.utils.Interface([
        'function claimReward(address rewardToken, address to, uint256 amountRequested) external returns (uint256)',
      ]);
      const data = iface.encodeFunctionData('claimReward', [
        '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI token
        walletAddress,
        ethers.MaxUint256,
      ]);
      return { to: STAKER, data, value: '0', gasLimit: GAS_LIMITS.FARM_HARVEST.toString() };
    }

    throw new Error(`Harvest not implemented for protocol: ${protocol}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  _resolveCurvePool(farmId) {
    // farmId format from defi.service.js: 'curve-farm-0', 'curve-farm-1', etc.
    // or a direct pool address
    if (farmId.startsWith('0x')) return farmId;
    // Return 3pool as default for curve farms (most common)
    return CURVE_POOLS['3pool'];
  }

  async _buildCurveAddLiquidity(poolAddress, amount0, amount1, walletAddress) {
    const iface = new ethers.utils.Interface([
      'function add_liquidity(uint256[3] amounts, uint256 min_mint_amount) external',
      'function add_liquidity(uint256[2] amounts, uint256 min_mint_amount) external',
    ]);
    const a0 = ethers.utils.parseUnits(amount0.toString(), 18);
    const a1 = ethers.utils.parseUnits(amount1.toString(), 18);
    const target = poolAddress.startsWith('0x') ? poolAddress : CURVE_POOLS['3pool'];
    const data = iface.encodeFunctionData('add_liquidity(uint256[2],uint256)', [[a0, a1], 0]);
    return { to: target, data, value: '0', gasLimit: GAS_LIMITS.CURVE_DEPOSIT.toString() };
  }

  async _buildCurveRemoveLiquidity(poolAddress, lpAmount, walletAddress) {
    const iface = new ethers.utils.Interface([
      'function remove_liquidity(uint256 _amount, uint256[2] min_amounts) external',
    ]);
    const lp = ethers.utils.parseUnits(lpAmount.toString(), 18);
    const target = poolAddress.startsWith('0x') ? poolAddress : CURVE_POOLS['3pool'];
    const data = iface.encodeFunctionData('remove_liquidity', [lp, [0, 0]]);
    return { to: target, data, value: '0', gasLimit: GAS_LIMITS.CURVE_WITHDRAW.toString() };
  }
}

module.exports = new TxBuilderService();
