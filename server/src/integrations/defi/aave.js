const { 
  UiPoolDataProvider,
  Pool,
  InterestRate,
  PERMISSION
} = require('@aave/contract-helpers');
const { 
  computeRxr,
  normalize,
  ReserveData
} = require('@aave/math-utils');
const ethers = require('ethers');
const { logger } = require('../../api/middlewares/logger.middleware');

/**
 * Aave V3 Integration using contract-helpers library
 * Generates unsigned transactions and retrieves live reserve data
 */
class AaveIntegration {
  constructor(provider) {
    this.provider = provider;
    
    // Mainnet Aave V3 addresses
    this.addresses = {
      lendingPoolAddressProvider: '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e', // V3
      uiPoolDataProvider: '0x91c0eA31b49B69Ea18607702c5d9fB57FFe2DF15', // V3
      lendingPool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', // V3 Pool Proxy
      wethGateway: '0xD322A49006FC828F9B5B37Ab215F99B4E5caB19C'  // V3 WETHGateway
    };

    this.poolDataProvider = new UiPoolDataProvider({
      uiPoolDataProviderAddress: this.addresses.uiPoolDataProvider,
      provider: this.provider,
      chainId: 1 // Mainnet
    });

    this.pool = new Pool(this.provider, {
      lendingPoolAddress: this.addresses.lendingPool,
      erc20Service: {
        approve: this.generateApprovalTransaction.bind(this),
        isApproved: this.checkTokenApproval.bind(this),
        decimalsOf: this.getTokenDecimals.bind(this)
      }
    });
  }

  /**
   * Get all live reserve data including supply APY (liquidityRate)
   * @returns {Promise<Array>} Array of reserves with real-time data
   */
  async getReserves() {
    try {
      const reserves = await this.poolDataProvider.getReservesHumanized({
        lendingPoolAddressProvider: this.addresses.lendingPoolAddressProvider
      });

      // Enrich reserves with APY calculation
      const enrichedReserves = reserves.reservesData.map(reserve => ({
        address: reserve.underlyingAsset,
        symbol: reserve.symbol,
        name: reserve.name,
        decimals: reserve.decimals,
        supplyCap: reserve.supplyCap,
        borrowCap: reserve.borrowCap,
        totalSupply: reserve.totalLiquidity,
        totalBorrowed: reserve.totalDebt,
        availableLiquidity: reserve.availableLiquidity,
        // Supply APY is stored in liquidityRate
        supplyAPY: normalize(reserve.liquidityRate, 25),
        // Variable borrow APY
        variableBorrowAPY: normalize(reserve.variableBorrowRate, 25),
        // Stable borrow APY
        stableBorrowAPY: normalize(reserve.stableBorrowRate, 25),
        // Usage ratio
        utilizationRate: normalize(reserve.utilizationRate, 4),
        isActive: reserve.isActive,
        isFrozen: reserve.isFrozen,
        borrowingEnabled: reserve.borrowingEnabled,
        stableBorrowRateEnabled: reserve.stableBorrowRateEnabled,
        usageAsCollateral: reserve.usageAsCollateralEnabled
      }));

      logger.info(`Fetched ${enrichedReserves.length} Aave reserves with live APY data`);
      return enrichedReserves;
    } catch (error) {
      logger.error('Error fetching Aave reserves:', error.message);
      throw error;
    }
  }

  /**
   * Get real per-wallet position data using getUserReservesHumanized
   * @param {string} userAddress - User's wallet address
   * @returns {Promise<Object>} User's reserve positions, collateral, and debt
   */
  async getUserData(userAddress) {
    try {
      const userReserves = await this.poolDataProvider.getUserReservesHumanized({
        lendingPoolAddressProvider: this.addresses.lendingPoolAddressProvider,
        user: userAddress
      });

      // Map user reserves to readable format
      const userPositions = {
        address: userAddress,
        totalCollateral: userReserves.userSummary.totalCollateralMarketReferenceCurrency,
        totalDebt: userReserves.userSummary.totalBorrowsMarketReferenceCurrency,
        availableBorrow: userReserves.userSummary.availableBorrowsMarketReferenceCurrency,
        currentLiquidationThreshold: userReserves.userSummary.currentLiquidationThreshold,
        ltv: userReserves.userSummary.ltv,
        healthFactor: userReserves.userSummary.healthFactor,
        isInIsolationMode: userReserves.userSummary.isInIsolationMode,
        reserves: userReserves.userReserves.map(reserve => ({
          address: reserve.underlyingAsset,
          symbol: reserve.reserve.symbol,
          scaledATokenBalance: reserve.scaledATokenBalance,
          usageAsCollateral: reserve.usageAsCollateralEnabledOnUser,
          stableBorrows: reserve.stableBorrows,
          variableBorrows: reserve.variableBorrows,
          principalStableBorrows: reserve.principalStableBorrows,
          isCollateral: reserve.usageAsCollateralEnabledOnUser
        }))
      };

      logger.info(`Fetched position data for user ${userAddress}`);
      return userPositions;
    } catch (error) {
      logger.error(`Error fetching user data for ${userAddress}:`, error.message);
      throw error;
    }
  }

  /**
   * Generate unsigned deposit transaction (Aave V3)
   * @param {string} asset - Token address to deposit
   * @param {string} amount - Amount in human readable format
   * @param {string} userAddress - User's wallet address
   * @param {number} referralCode - Referral code (default: 0)
   * @returns {Promise<Object>} Unsigned transaction { to, data, value }
   */
  async deposit(asset, amount, userAddress, referralCode = 0) {
    try {
      // Aave V3 uses supply() not depositTxBuilder()
      const iface = new ethers.utils.Interface([
        'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)'
      ]);
      const amountWei = ethers.utils.parseUnits(amount.toString(), 18);
      const data = iface.encodeFunctionData('supply', [asset, amountWei, userAddress, referralCode]);
      logger.info(`Generated Aave V3 supply tx for ${amount} of ${asset}`);
      return { to: this.addresses.lendingPool, data, value: '0' };
    } catch (error) {
      logger.error('Error generating Aave V3 supply transaction:', error.message);
      throw error;
    }
  }

  /**
   * Generate unsigned withdrawal transaction (Aave V3)
   * @param {string} asset - Token address to withdraw
   * @param {string} amount - Amount in human readable format (use '-1' for max)
   * @param {string} userAddress - User's wallet address
   * @returns {Promise<Object>} Unsigned transaction { to, data, value }
   */
  async withdraw(asset, amount, userAddress) {
    try {
      const iface = new ethers.utils.Interface([
        'function withdraw(address asset, uint256 amount, address to) returns (uint256)'
      ]);
      const amountWei = amount === 'max' || amount === '-1'
        ? ethers.MaxUint256
        : ethers.utils.parseUnits(amount.toString(), 18);
      const data = iface.encodeFunctionData('withdraw', [asset, amountWei, userAddress]);
      logger.info(`Generated Aave V3 withdraw tx for ${amount} of ${asset}`);
      return { to: this.addresses.lendingPool, data, value: '0' };
    } catch (error) {
      logger.error('Error generating Aave V3 withdraw transaction:', error.message);
      throw error;
    }
  }

  /**
   * Generate unsigned borrow transaction
   * @param {string} asset - Token address to borrow
   * @param {string} amount - Amount in human readable format
   * @param {number} interestRateMode - 1 for stable, 2 for variable
   * @param {string} userAddress - User's wallet address
   * @param {number} referralCode - Referral code (default: 0)
   * @returns {Promise<Object>} Unsigned transaction { to, data, value }
   */
  async borrow(asset, amount, interestRateMode, userAddress, referralCode = 0) {
    try {
      const rateMode = interestRateMode === 1 ? InterestRate.Stable : InterestRate.Variable;

      const txData = this.pool.borrowTxBuilder({
        reserve: asset,
        amount: amount,
        interestRateMode: rateMode,
        user: userAddress,
        referralCode: referralCode,
        onBehalfOf: userAddress
      });

      const unsignedTx = {
        to: txData.to,
        data: txData.data,
        value: txData.value || '0'
      };

      logger.info(`Generated borrow transaction for ${amount} of ${asset} (${interestRateMode === 1 ? 'stable' : 'variable'})`);
      return unsignedTx;
    } catch (error) {
      logger.error('Error generating borrow transaction:', error.message);
      throw error;
    }
  }

  /**
   * Generate unsigned repay transaction
   * @param {string} asset - Token address to repay
   * @param {string} amount - Amount in human readable format (use '-1' to repay max)
   * @param {number} interestRateMode - 1 for stable, 2 for variable
   * @param {string} userAddress - User's wallet address
   * @returns {Promise<Object>} Unsigned transaction { to, data, value }
   */
  async repay(asset, amount, interestRateMode, userAddress) {
    try {
      const rateMode = interestRateMode === 1 ? InterestRate.Stable : InterestRate.Variable;

      const txData = this.pool.repayTxBuilder({
        reserve: asset,
        amount: amount === 'max' || amount === '-1' ? '-1' : amount,
        interestRateMode: rateMode,
        user: userAddress,
        onBehalfOf: userAddress
      });

      const unsignedTx = {
        to: txData.to,
        data: txData.data,
        value: txData.value || '0'
      };

      logger.info(`Generated repay transaction for ${amount} of ${asset} (${interestRateMode === 1 ? 'stable' : 'variable'})`);
      return unsignedTx;
    } catch (error) {
      logger.error('Error generating repay transaction:', error.message);
      throw error;
    }
  }

  /**
   * Generate unsigned ERC20 approval transaction
   * @private
   */
  async generateApprovalTransaction(tokenAddress, spenderAddress, amount) {
    try {
      // This is typically handled by the client-side
      // But included for completeness
      logger.info(`Approval request for ${tokenAddress} to ${spenderAddress}`);
      return null;
    } catch (error) {
      logger.error('Error generating approval transaction:', error.message);
      throw error;
    }
  }

  /**
   * Check if token is approved for spending
   * @private
   */
  async checkTokenApproval(tokenAddress, userAddress, spenderAddress) {
    try {
      const erc20 = new ethers.Contract(
        tokenAddress,
        ['function allowance(address, address) public view returns (uint256)'],
        this.provider
      );
      
      const allowance = await erc20.allowance(userAddress, spenderAddress);
      return allowance.gt(0);
    } catch (error) {
      logger.error('Error checking token approval:', error.message);
      return false;
    }
  }

  /**
   * Get token decimals
   * @private
   */
  async getTokenDecimals(tokenAddress) {
    try {
      const erc20 = new ethers.Contract(
        tokenAddress,
        ['function decimals() public view returns (uint8)'],
        this.provider
      );
      
      return await erc20.decimals();
    } catch (error) {
      logger.error('Error getting token decimals:', error.message);
      return 18; // Default to 18 if error
    }
  }
}

module.exports = AaveIntegration;