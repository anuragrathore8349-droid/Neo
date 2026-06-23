'use strict';

/**
 * Transaction Builder Service
 * Builds unsigned Ethereum transactions for all DeFi operations.
 * Pattern: build-tx → MetaMask signs → confirm-tx saves position
 */

const { ethers }  = require('ethers');
const { logger }  = require('../api/middlewares/logger.middleware');
const { ethereumProvider } = require('../config/blockchain');

const LidoIntegration    = require('../integrations/defi/lido');
const AaveIntegration    = require('../integrations/defi/aave');
const UniswapIntegration = require('../integrations/defi/uniswap');

// ── Token address map (mainnet) ──────────────────────────────────────────────
const TOKEN_ADDRESSES = {
  ETH:   'native',
  WETH:  ethers.utils.getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'),
  stETH: ethers.utils.getAddress('0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'),
  AAVE:  ethers.utils.getAddress('0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9'),
  CRV:   ethers.utils.getAddress('0xD533a949740bb3306d119CC777fa900bA034cd52'),
  USDC:  ethers.utils.getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
  USDT:  ethers.utils.getAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7'),
  DAI:   ethers.utils.getAddress('0x6B175474E89094C44Da98b954EedeAC495271d0F'),
  WBTC:  ethers.utils.getAddress('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'),
  UNI:   ethers.utils.getAddress('0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'),
};

const AAVE_ASSETS = {
  ETH: TOKEN_ADDRESSES.WETH, WETH: TOKEN_ADDRESSES.WETH,
  USDC: TOKEN_ADDRESSES.USDC, USDT: TOKEN_ADDRESSES.USDT,
  DAI: TOKEN_ADDRESSES.DAI,  WBTC: TOKEN_ADDRESSES.WBTC,
};

const CURVE_POOLS = {
  '3pool': ethers.utils.getAddress('0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7'),
  'steth': ethers.utils.getAddress('0xDC24316b9AE028F1497c275EB9192a3Ea0f67022'),
  'frax':  ethers.utils.getAddress('0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B'),
};

const GAS_LIMITS = {
  ETH_TRANSFER:    '21000',
  ERC20_TRANSFER:  '65000',
  LIDO_STAKE:      '200000',
  AAVE_SUPPLY:     '250000',
  AAVE_WITHDRAW:   '250000',
  UNISWAP_ADD:     '500000',
  UNISWAP_REMOVE:  '400000',
  CURVE_DEPOSIT:   '400000',
  CURVE_WITHDRAW:  '400000',
  FARM_HARVEST:    '200000',
  GENERIC:         '300000',
};

function checksumAddress (address, fieldName = 'address') {
  if (!address || typeof address !== 'string' || !address.trim()) {
    throw new Error(`${fieldName} is empty. Connect your MetaMask wallet before transacting.`);
  }
  try {
    return ethers.utils.getAddress(address);
  } catch (err) {
    throw new Error(`Invalid Ethereum address for ${fieldName}: "${address}". ` +
      'Connect MetaMask and ensure the correct account is selected.');
  }
}

class TxBuilderService {

  // ── Main router ──────────────────────────────────────────────────────────
  async buildTx (userId, params) {
    const { action } = params;
    const walletAddress = checksumAddress(params.walletAddress, 'walletAddress');
    const p = { ...params, walletAddress };
    logger.info(`buildTx: action=${action} wallet=${walletAddress}`);

    switch (action) {
      case 'stake':           return this.buildStakeTx(p);
      case 'unstake':         return this.buildUnstakeTx(p);
      case 'addLiquidity':    return this.buildPoolAddLiquidityTx(p);
      case 'removeLiquidity': return this.buildPoolRemoveLiquidityTx(p);
      case 'deposit':         return this.buildFarmDepositTx(p);
      case 'withdraw':        return this.buildFarmWithdrawTx(p);
      case 'harvest':         return this.buildFarmHarvestTx(p);
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  // ── Staking ──────────────────────────────────────────────────────────────

  async buildStakeTx ({ protocolId, assetSymbol, amount, walletAddress }) {
    if (!protocolId)    throw new Error('protocolId is required for stake');
    if (!assetSymbol)   throw new Error('assetSymbol is required for stake');
    if (!amount)        throw new Error('amount is required for stake');
    if (!walletAddress) throw new Error('walletAddress is required for stake');

    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || amountFloat <= 0) throw new Error('amount must be a positive number');

    const protocol = protocolId.toLowerCase().replace(/\s+/g, '');
    const symbol   = assetSymbol.toUpperCase();

    logger.info(`buildStakeTx: protocol=${protocol} asset=${symbol} amount=${amount}`);

    // Lido: ETH → stETH
    if (protocol === 'lido' || symbol === 'ETH') {
      const lido      = new LidoIntegration(ethereumProvider);
      // ethers v5: utils.parseEther returns BigNumber
      const amountWei = ethers.utils.parseEther(amount.toString());
      const unsignedTx = await lido.buildStakeCalldata(amountWei);
      return { ...unsignedTx, gasLimit: GAS_LIMITS.LIDO_STAKE };
    }

    // Aave: supply any supported asset
    if (protocol === 'aave' || protocol === 'aavev3') {
      const aave         = new AaveIntegration(ethereumProvider);
      const assetAddress = AAVE_ASSETS[symbol];
      if (!assetAddress) throw new Error(`Asset ${symbol} not supported on Aave V3`);
      const unsignedTx = await aave.deposit(assetAddress, amount, walletAddress);
      return { ...unsignedTx, gasLimit: GAS_LIMITS.AAVE_SUPPLY };
    }

    // Curve: lock CRV for veCRV
    if (protocol === 'curve' && symbol === 'CRV') {
      const VOTING_ESCROW = ethers.utils.getAddress('0x5f3b5DfEb7B28CDbD7FAba78963Fb202c93EfEA7');
      const iface       = new ethers.utils.Interface([
        'function create_lock(uint256 _value, uint256 _unlock_time) external',
      ]);
      const amountWei   = ethers.utils.parseUnits(amount.toString(), 18);
      const unlockTime  = Math.floor(Date.now() / 1000) + 4 * 365 * 24 * 3600;
      const data        = iface.encodeFunctionData('create_lock', [amountWei, unlockTime]);
      return { to: VOTING_ESCROW, data, value: '0', gasLimit: GAS_LIMITS.GENERIC };
    }

    // Generic ERC-20 stub for unsupported protocols
    logger.warn(`buildStakeTx: no specific integration for protocol=${protocol}, using generic stub`);
    const tokenAddress = TOKEN_ADDRESSES[symbol];
    if (!tokenAddress || tokenAddress === 'native') {
      throw new Error(`No token address found for ${symbol}. Add it to TOKEN_ADDRESSES in tx.builder.js`);
    }
    const iface     = new ethers.utils.Interface([
      'function transfer(address to, uint256 amount) external returns (bool)',
    ]);
    const amountWei = ethers.utils.parseUnits(amount.toString(), 18);
    const data      = iface.encodeFunctionData('transfer', [walletAddress, amountWei]);
    return { to: tokenAddress, data, value: '0', gasLimit: GAS_LIMITS.GENERIC };
  }

  async buildUnstakeTx ({ protocolId, assetSymbol, amount, positionId, walletAddress }) {
    if (!walletAddress) throw new Error('walletAddress is required');
    if (!amount)        throw new Error('amount is required');

    const protocol = (protocolId || '').toLowerCase().replace(/\s+/g, '');
    const symbol   = (assetSymbol || 'ETH').toUpperCase();

    logger.info(`buildUnstakeTx: protocol=${protocol} asset=${symbol} amount=${amount} positionId=${positionId}`);

    if (protocol === 'aave' || protocol === 'aavev3') {
      const aave         = new AaveIntegration(ethereumProvider);
      const assetAddress = AAVE_ASSETS[symbol];
      if (!assetAddress) throw new Error(`Asset ${symbol} not supported on Aave V3`);
      const unsignedTx = await aave.withdraw(assetAddress, amount, walletAddress);
      return { ...unsignedTx, gasLimit: GAS_LIMITS.AAVE_WITHDRAW };
    }

    if (protocol === 'lido') {
      const WITHDRAWAL_QUEUE = ethers.utils.getAddress('0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1');
      const iface     = new ethers.utils.Interface([
        'function requestWithdrawals(uint256[] amounts, address owner) external returns (uint256[])',
      ]);
      const amountWei = ethers.utils.parseEther(amount.toString());
      const data      = iface.encodeFunctionData('requestWithdrawals', [[amountWei], walletAddress]);
      return { to: WITHDRAWAL_QUEUE, data, value: '0', gasLimit: GAS_LIMITS.GENERIC };
    }

    if (protocol.includes('uniswap')) {
      if (!positionId) throw new Error('positionId (NFT tokenId) is required for Uniswap unstake');
      const uniswap = new UniswapIntegration(ethereumProvider);
      return uniswap.removeLiquidityCalldata(
        positionId, walletAddress,
        { slippageBps: 50, deadlineMinutes: 30 }
      );
    }

    throw new Error(`Unstake not implemented for protocol: ${protocol}`);
  }

  // ── Liquidity pools ──────────────────────────────────────────────────────

  async buildPoolAddLiquidityTx ({ protocolId, poolId, token0Amount, token1Amount, walletAddress }) {
    if (!poolId)        throw new Error('poolId is required');
    if (!token0Amount)  throw new Error('token0Amount is required');
    if (!token1Amount)  throw new Error('token1Amount is required');
    if (!walletAddress) throw new Error('walletAddress is required');

    const protocol = (protocolId || 'uniswap').toLowerCase().replace(/\s+/g, '');
    logger.info(`buildPoolAddLiquidityTx: protocol=${protocol} pool=${poolId}`);

    if (protocol.includes('uniswap')) {
      const uniswap = new UniswapIntegration(ethereumProvider);
      return uniswap.addLiquidityCalldata(
        poolId, token0Amount, token1Amount, walletAddress,
        { slippageBps: 50, deadlineMinutes: 30 }
      );
    }

    if (protocol.includes('curve')) {
      return this._buildCurveAddLiquidity(poolId, token0Amount, token1Amount, walletAddress);
    }

    throw new Error(`addLiquidity not implemented for protocol: ${protocol}`);
  }

  async buildPoolRemoveLiquidityTx ({ protocolId, poolId, lpAmount, walletAddress }) {
    if (!poolId)        throw new Error('poolId is required');
    if (!lpAmount)      throw new Error('lpAmount is required');
    if (!walletAddress) throw new Error('walletAddress is required');

    const protocol = (protocolId || 'uniswap').toLowerCase().replace(/\s+/g, '');
    logger.info(`buildPoolRemoveLiquidityTx: protocol=${protocol} pool=${poolId}`);

    if (protocol.includes('uniswap')) {
      const uniswap = new UniswapIntegration(ethereumProvider);
      return uniswap.removeLiquidityCalldata(
        lpAmount, walletAddress,
        { slippageBps: 50, deadlineMinutes: 30 }
      );
    }

    if (protocol.includes('curve')) {
      return this._buildCurveRemoveLiquidity(poolId, lpAmount, walletAddress);
    }

    throw new Error(`removeLiquidity not implemented for protocol: ${protocol}`);
  }

  // ── Yield farms ──────────────────────────────────────────────────────────

  async buildFarmDepositTx ({ protocolId, farmId, amount, walletAddress }) {
    if (!farmId)        throw new Error('farmId is required');
    if (!amount)        throw new Error('amount is required');
    if (!walletAddress) throw new Error('walletAddress is required');

    const protocol  = (protocolId || '').toLowerCase();
    const amountWei = ethers.utils.parseUnits(amount.toString(), 18);
    logger.info(`buildFarmDepositTx: protocol=${protocol} farm=${farmId}`);

    if (protocol.includes('curve')) {
      const iface       = new ethers.utils.Interface(['function deposit(uint256 _value) external']);
      const poolAddress = this._resolveCurvePool(farmId);
      const data        = iface.encodeFunctionData('deposit', [amountWei]);
      return { to: poolAddress, data, value: '0', gasLimit: GAS_LIMITS.CURVE_DEPOSIT };
    }

    if (protocol.includes('uniswap')) {
      const STAKER = ethers.utils.getAddress('0xe34139463ba50bd61336e0c446bd8c0867c6fe65');
      return { to: STAKER, data: '0x', value: '0', gasLimit: GAS_LIMITS.GENERIC };
    }

    throw new Error(`Farm deposit not implemented for protocol: ${protocol}`);
  }

  async buildFarmWithdrawTx ({ protocolId, farmId, amount, walletAddress }) {
    if (!farmId)        throw new Error('farmId is required');
    if (!amount)        throw new Error('amount is required');
    if (!walletAddress) throw new Error('walletAddress is required');

    const protocol  = (protocolId || '').toLowerCase();
    const amountWei = ethers.utils.parseUnits(amount.toString(), 18);
    logger.info(`buildFarmWithdrawTx: protocol=${protocol} farm=${farmId}`);

    if (protocol.includes('curve')) {
      const iface       = new ethers.utils.Interface(['function withdraw(uint256 _value) external']);
      const poolAddress = this._resolveCurvePool(farmId);
      const data        = iface.encodeFunctionData('withdraw', [amountWei]);
      return { to: poolAddress, data, value: '0', gasLimit: GAS_LIMITS.CURVE_WITHDRAW };
    }

    throw new Error(`Farm withdraw not implemented for protocol: ${protocol}`);
  }

  async buildFarmHarvestTx ({ protocolId, farmId, walletAddress }) {
    if (!farmId)        throw new Error('farmId is required');
    if (!walletAddress) throw new Error('walletAddress is required');

    const protocol = (protocolId || '').toLowerCase();
    logger.info(`buildFarmHarvestTx: protocol=${protocol} farm=${farmId}`);

    if (protocol.includes('curve')) {
      const MINTER     = ethers.utils.getAddress('0xd061D61a4d941c39E5453435B6345Dc261C2fcE0');
      const iface      = new ethers.utils.Interface(['function mint(address gauge_addr) external']);
      const poolAddress = ethers.utils.getAddress(this._resolveCurvePool(farmId));
      const data       = iface.encodeFunctionData('mint', [poolAddress]);
      return { to: MINTER, data, value: '0', gasLimit: GAS_LIMITS.FARM_HARVEST };
    }

    if (protocol.includes('uniswap')) {
      const STAKER = ethers.utils.getAddress('0xe34139463ba50bd61336e0c446bd8c0867c6fe65');
      const iface  = new ethers.utils.Interface([
        'function claimReward(address rewardToken, address to, uint256 amountRequested) external returns (uint256)',
      ]);
      const data   = iface.encodeFunctionData('claimReward', [
        ethers.utils.getAddress(TOKEN_ADDRESSES.UNI),
        walletAddress,
        ethers.constants.MaxUint256,    // ethers v5: constants.MaxUint256
      ]);
      return { to: STAKER, data, value: '0', gasLimit: GAS_LIMITS.FARM_HARVEST };
    }

    throw new Error(`Harvest not implemented for protocol: ${protocol}`);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  _resolveCurvePool (farmId) {
    if (farmId && farmId.startsWith('0x')) return ethers.utils.getAddress(farmId);
    return CURVE_POOLS['3pool'];
  }

  async _buildCurveAddLiquidity (poolAddress, amount0, amount1, walletAddress) {
    const iface  = new ethers.utils.Interface([
      'function add_liquidity(uint256[2] amounts, uint256 min_mint_amount) external',
    ]);
    const a0     = ethers.utils.parseUnits(amount0.toString(), 18);
    const a1     = ethers.utils.parseUnits(amount1.toString(), 18);
    const target = poolAddress.startsWith('0x') ? ethers.utils.getAddress(poolAddress) : CURVE_POOLS['3pool'];
    const data   = iface.encodeFunctionData('add_liquidity', [[a0, a1], 0]);
    return { to: target, data, value: '0', gasLimit: GAS_LIMITS.CURVE_DEPOSIT };
  }

  async _buildCurveRemoveLiquidity (poolAddress, lpAmount, walletAddress) {
    const iface  = new ethers.utils.Interface([
      'function remove_liquidity(uint256 _amount, uint256[2] min_amounts) external',
    ]);
    const lp     = ethers.utils.parseUnits(lpAmount.toString(), 18);
    const target = poolAddress.startsWith('0x') ? ethers.utils.getAddress(poolAddress) : CURVE_POOLS['3pool'];
    const data   = iface.encodeFunctionData('remove_liquidity', [lp, [0, 0]]);
    return { to: target, data, value: '0', gasLimit: GAS_LIMITS.CURVE_WITHDRAW };
  }
}

module.exports = new TxBuilderService();
