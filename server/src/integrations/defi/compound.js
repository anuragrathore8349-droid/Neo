const axios = require('axios');
const ethers = require('ethers');
const { logger } = require('../../api/middlewares/logger.middleware');

/**
 * Compound V3 (Comet) Integration
 * Uses REST API for market data and builds unsigned calldata for on-chain operations
 */
class CompoundIntegration {
  constructor(provider, cometAddress = null, chainId = 1) {
    this.provider = provider;
    this.cometAddress = cometAddress;
    this.chainId = chainId;
    
    // Comet contract ABI (core functions for supply, withdraw, borrow, repay)
    this.cometABI = [
      'function supply(address asset, uint256 amount)',
      'function supplyTo(address dst, address asset, uint256 amount)',
      'function withdraw(address asset, uint256 amount)',
      'function withdrawTo(address to, address asset, uint256 amount)',
      'function borrow(uint256 amount)',
      'function borrowTo(address receiver, uint256 amount)',
      'function repayTo(address account, address asset, uint256 amount)',
      'function repay(address asset, uint256 amount)'
    ];
    
    this.cometInterface = new ethers.utils.Interface(this.cometABI);
  }

  /**
   * Fetch market data from Compound V3 REST API
   */
  async getMarkets() {
    try {
      const res = await axios.get('https://api.compound.finance/api/v2/ctoken');
      return res.data.cToken.map(token => ({
        symbol: token.symbol,
        supplyRate: (parseFloat(token.supply_rate.value) * 100).toFixed(2) + '%',
        borrowRate: (parseFloat(token.borrow_rate.value) * 100).toFixed(2) + '%',
        totalSupply: token.total_supply.value,
        address: token.token_address,
        decimals: token.underlying_price?.decimals || 18
      }));
    } catch (error) {
      logger.error('Error fetching Compound markets:', error);
      throw error;
    }
  }

  /**
   * Get market information for a specific asset
   */
  async getMarketInfo(assetSymbol) {
    try {
      const res = await axios.get('https://api.compound.finance/api/v2/ctoken');
      const market = res.data.cToken.find(t => t.symbol === assetSymbol);
      
      if (!market) {
        throw new Error(`Market not found for asset: ${assetSymbol}`);
      }
      
      return {
        symbol: market.symbol,
        address: market.token_address,
        supplyRate: parseFloat(market.supply_rate.value),
        borrowRate: parseFloat(market.borrow_rate.value),
        totalSupply: market.total_supply.value,
        totalBorrow: market.total_borrows.value,
        collateralFactor: market.collateral_factor.value,
        underlyingToken: market.underlying_address,
        decimals: market.underlying_price?.decimals || 18
      };
    } catch (error) {
      logger.error(`Error fetching market info for ${assetSymbol}:`, error);
      throw error;
    }
  }

  /**
   * Get account liquidity and balances
   */
  async getUserData(address) {
    try {
      const res = await axios.get(`https://api.compound.finance/api/v2/account?addresses[]=${address}`);
      const account = res.data.accounts[0];
      
      if (!account) {
        return {
          address,
          balances: [],
          totalSupplyUSD: 0,
          totalBorrowUSD: 0,
          netAPY: 0
        };
      }
      
      return {
        address,
        balances: account.tokens || [],
        totalSupplyUSD: parseFloat(account.total_supply_usd || 0),
        totalBorrowUSD: parseFloat(account.total_borrow_usd || 0),
        netAPY: parseFloat(account.net_apy || 0),
        accountLiquidity: account.account_liquidity
      };
    } catch (error) {
      logger.error('Error fetching Compound user data:', error);
      throw error;
    }
  }

  /**
   * Build unsigned calldata for supply operation
   * Returns calldata to be signed by client
   */
  async buildSupplyCalldata(assetAddress, amount) {
    try {
      if (!this.cometAddress) {
        throw new Error('Comet address not configured');
      }
      
      const parsedAmount = ethers.toBigInt(amount);
      const calldata = this.cometInterface.encodeFunctionData('supply', [
        assetAddress,
        parsedAmount
      ]);
      
      logger.info(`Built supply calldata for ${assetAddress} amount: ${amount}`);
      
      return {
        target: this.cometAddress,
        calldata,
        value: '0',
        operation: 'supply',
        asset: assetAddress,
        amount: amount.toString()
      };
    } catch (error) {
      logger.error('Error building supply calldata:', error);
      throw error;
    }
  }

  /**
   * Build unsigned calldata for redeem/withdraw operation
   * Returns calldata to be signed by client
   */
  async buildRedeemCalldata(assetAddress, amount) {
    try {
      if (!this.cometAddress) {
        throw new Error('Comet address not configured');
      }
      
      const parsedAmount = ethers.toBigInt(amount);
      const calldata = this.cometInterface.encodeFunctionData('withdraw', [
        assetAddress,
        parsedAmount
      ]);
      
      logger.info(`Built redeem calldata for ${assetAddress} amount: ${amount}`);
      
      return {
        target: this.cometAddress,
        calldata,
        value: '0',
        operation: 'redeem',
        asset: assetAddress,
        amount: amount.toString()
      };
    } catch (error) {
      logger.error('Error building redeem calldata:', error);
      throw error;
    }
  }

  /**
   * Build unsigned calldata for borrow operation
   * Returns calldata to be signed by client
   */
  async buildBorrowCalldata(amount) {
    try {
      if (!this.cometAddress) {
        throw new Error('Comet address not configured');
      }
      
      const parsedAmount = ethers.toBigInt(amount);
      const calldata = this.cometInterface.encodeFunctionData('borrow', [
        parsedAmount
      ]);
      
      logger.info(`Built borrow calldata amount: ${amount}`);
      
      return {
        target: this.cometAddress,
        calldata,
        value: '0',
        operation: 'borrow',
        amount: amount.toString()
      };
    } catch (error) {
      logger.error('Error building borrow calldata:', error);
      throw error;
    }
  }

  /**
   * Build unsigned calldata for repay borrow operation
   * Returns calldata to be signed by client
   */
  async buildRepayBorrowCalldata(assetAddress, amount) {
    try {
      if (!this.cometAddress) {
        throw new Error('Comet address not configured');
      }
      
      const parsedAmount = ethers.toBigInt(amount);
      const calldata = this.cometInterface.encodeFunctionData('repay', [
        assetAddress,
        parsedAmount
      ]);
      
      logger.info(`Built repay borrow calldata for ${assetAddress} amount: ${amount}`);
      
      return {
        target: this.cometAddress,
        calldata,
        value: '0',
        operation: 'repayBorrow',
        asset: assetAddress,
        amount: amount.toString()
      };
    } catch (error) {
      logger.error('Error building repay borrow calldata:', error);
      throw error;
    }
  }

  /**
   * Legacy method - returns supply calldata for client signing
   */
  async supply(assetAddress, amount, address) {
    return this.buildSupplyCalldata(assetAddress, amount);
  }

  /**
   * Legacy method - returns redeem calldata for client signing
   */
  async redeem(assetAddress, amount, address) {
    return this.buildRedeemCalldata(assetAddress, amount);
  }

  /**
   * Legacy method - returns borrow calldata for client signing
   */
  async borrow(amount, address) {
    return this.buildBorrowCalldata(amount);
  }

  /**
   * Legacy method - returns repay borrow calldata for client signing
   */
  async repayBorrow(assetAddress, amount, address) {
    return this.buildRepayBorrowCalldata(assetAddress, amount);
  }
}

module.exports = CompoundIntegration;