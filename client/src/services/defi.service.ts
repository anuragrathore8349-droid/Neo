import { apiFetch } from './api';

/**
 * DeFi Service - Handles all DeFi-related API calls
 * Fetches real data from the backend instead of mock data
 */

// Types for API responses
export interface Protocol {
  id: string;
  name: string;
  type: 'lending' | 'dex' | 'staking' | 'yield-farming';
  networks: string[];
  tvl?: string;
  apy?: string;
  risk?: 'Low' | 'Medium' | 'High';
  chain?: string;
  icon?: string;
}

export interface ProtocolDetails extends Protocol {
  description?: string;
  totalSupply?: string;
  totalBorrows?: string;
  utilizationRate?: string;
  liquidationThreshold?: string;
}

export interface StakingPosition {
  id: string;
  asset: string;
  amount: string;
  value: string;
  apy: string;
  rewards: string;
  earnedSoFar?: string;
  lockPeriod?: string;
  unlocksAt?: string;
  status?: 'active' | 'completed' | 'unstaking' | 'available' | 'partial_exit';
  chartData?: Array<{ date: string; value: number }>;
  protocol?: string;
  description?: string;
  minAmount?: string;
  tvl?: string;
  transactionHash?: string;
  section?: 'position' | 'opportunity';
}

export interface LiquidityPool {
  id: string;
  name: string;
  protocol: string;
  protocolIcon?: string;
  tokens: {
    symbol: string;
    icon?: string;
    amount: string;
    value: string;
    address?: string;
  }[];
  tvl: string;
  apr: string;
  volume24h: string;
  myLiquidity: string;
  feePercentage?: string;
  range?: {
    min: number;
    max: number;
  };
  chartData?: Array<{ date: string; tvl: number }>;
}

export interface YieldFarm {
  id: string;
  name: string;
  protocol: string;
  protocolIcon?: string;
  depositToken: {
    symbol: string;
    icon?: string;
    amount: string;
    value: string;
  };
  rewardTokens: {
    symbol: string;
    icon?: string;
    amount: string;
    value: string;
  }[];
  apy: string;
  tvl: string;
  myDeposit: string;
  rewards: string;
  status?: 'active' | 'inactive' | 'paused';
  estimatedDailyReward?: string;
  performanceChart?: Array<{ date: string; apy: number }>;
}

export interface GasPrice {
  network: string;
  price: string;
  speed: 'Slow' | 'Normal' | 'Fast';
  trend: 'up' | 'down' | 'stable';
  estimatedTime?: string;
  gweiPrice?: string;
}

export interface DefiPosition {
  id: string;
  type: 'staking' | 'liquidity' | 'lending' | 'borrowing';
  protocol: string;
  asset: string;
  amount: string;
  value: string;
  apy?: string;
  status: string;
}

export interface DefiStats {
  totalValueLocked: string;
  totalDeposited: string;
  totalRewards: string;
  averageApy: string;
}

export interface BuildTxParams {
  action: string;
  entityId: string;
  amount: string;
  walletAddress: string;
  [key: string]: any;
}

export interface ConfirmTxParams {
  transactionHash: string;
  signedTx: any;
  [key: string]: any;
}

class DefiService {
  /**
   * Fetch all available DeFi protocols
   */
  async getProtocols(): Promise<Protocol[]> {
    try {
      const response = await apiFetch<{ data: Protocol[] }>('/api/defi/protocols');
      return (response.data || []).map(protocol => ({
        ...protocol,
        // Ensure all required properties have values
        icon: protocol.icon || this.getDefaultProtocolIcon(protocol.name),
        tvl: protocol.tvl || '$0',
        apy: protocol.apy || '0%',
        risk: protocol.risk || 'Medium',
        chain: protocol.chain || protocol.networks?.[0] || 'Ethereum'
      }));
    } catch (error) {
      console.error('Error fetching protocols:', error);
      throw error;
    }
  }

  /**
   * Fetch details for a specific protocol
   */
  async getProtocolDetails(protocolId: string): Promise<ProtocolDetails> {
    try {
      const response = await apiFetch<{ data: ProtocolDetails }>(
        `/api/defi/protocols/${protocolId}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching protocol details:', error);
      throw error;
    }
  }

  /**
   * Fetch all DeFi positions for the current user
   */
  async getPositions(): Promise<DefiPosition[]> {
    try {
      const response = await apiFetch<{ data: DefiPosition[] }>('/api/defi/positions');
      return response.data || [];
    } catch (error) {
      console.error('Error fetching positions:', error);
      throw error;
    }
  }

  /**
   * Fetch staking positions
   */
  async getStakingPositions(): Promise<{
    positions: StakingPosition[];
    opportunities: StakingPosition[];
  }> {
    try {
      const response = await apiFetch<{
        data:
          | StakingPosition[]
          | { positions: StakingPosition[]; opportunities: StakingPosition[] }
      }>('/api/defi/staking-positions');

      const raw = response.data;

      // Handle BOTH old flat-array shape and new object shape from backend
      let positions: StakingPosition[] = [];
      let opportunities: StakingPosition[] = [];

      if (Array.isArray(raw)) {
        // Backend still returns flat array — split by status
        positions = raw.filter(p => p.status !== 'available');
        opportunities = raw.filter(p => p.status === 'available');
      } else if (raw && typeof raw === 'object') {
        // Backend returns { positions, opportunities }
        positions = Array.isArray((raw as any).positions)
          ? (raw as any).positions
          : [];
        opportunities = Array.isArray((raw as any).opportunities)
          ? (raw as any).opportunities
          : [];
      }

      const normalize = (p: StakingPosition): StakingPosition => {
        const assetSymbol =
          typeof p.asset === 'string'
            ? p.asset
            : typeof p.asset === 'object' && (p.asset as any)?.symbol
            ? (p.asset as any).symbol
            : 'Unknown';
        return {
          ...p,
          id: (p as any).id || (p as any)._id || '',
          asset: assetSymbol
        };
      };

      return {
        positions: positions.map(normalize),
        opportunities: opportunities.map(normalize)
      };
    } catch (error) {
      console.error('Error fetching staking positions:', error);
      throw error;
    }
  }

  /**
   * Fetch liquidity pools
   */
  async getLiquidityPools(protocol?: string, token?: string): Promise<LiquidityPool[]> {
    try {
      const params = new URLSearchParams();
      if (protocol) params.append('protocol', protocol);
      if (token) params.append('token', token);

      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await apiFetch<{ data: LiquidityPool[] }>(`/api/defi/pools${query}`);
      
      // Enrich each pool with real TVL history
      return Promise.all((response.data || []).map(async (pool) => {
        // Fetch real TVL history data
        const tvlHistory = await this.getPoolTVLHistory(pool.id, 30).catch(() => []);
        
        // Use local icon map or fallback — do NOT call non-existent /api/defi/token-icon endpoint
        const enrichedTokens = pool.tokens.map((token) => ({
          ...token,
          icon: token.icon || this.getDefaultTokenIcon(token.address || '')
        }));
        
        return {
          ...pool,
          tokens: enrichedTokens,
          chartData: tvlHistory
        };
      }));
    } catch (error) {
      console.error('Error fetching liquidity pools:', error);
      throw error;
    }
  }

  /**
   * Fetch yield farms
   */
  async getYieldFarms(): Promise<YieldFarm[]> {
    try {
      const response = await apiFetch<{ data: YieldFarm[] }>('/api/defi/yield-farms');
      // Performance chart data now comes from server via getChartHistory()
      return response.data || [];
    } catch (error) {
      console.error('Error fetching yield farms:', error);
      throw error;
    }
  }

  /**
   * Fetch current gas prices across networks
   */
  async getGasPrices(): Promise<GasPrice[]> {
    try {
      const response = await apiFetch<{ data: GasPrice[] }>('/api/defi/gas-prices');
      return response.data || [];
    } catch (error) {
      console.error('Error fetching gas prices:', error);
      throw error;
    }
  }

  /**
   * Get DeFi overview statistics
   */
  async getDefiStats(): Promise<DefiStats> {
    try {
      const response = await apiFetch<{ data: DefiStats }>('/api/defi/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching DeFi stats:', error);
      throw error;
    }
  }

  /**
   * Stake assets in a protocol
   */
  async stakeAssets(data: {
    protocolId: string;
    assetSymbol: string;
    amount: string;
    duration: number;
    walletAddress: string;
  }) {
    try {
      // Validate required fields
      if (!data.protocolId?.trim()) {
        throw new Error('Protocol ID is required');
      }
      if (!data.assetSymbol?.trim()) {
        throw new Error('Asset symbol is required');
      }
      const amountNum = parseFloat(data.amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Amount must be a positive number');
      }
      if (!data.walletAddress?.trim()) {
        throw new Error('Wallet address is required');
      }

      console.log('Staking assets with data:', {
        protocolId: data.protocolId,
        assetSymbol: data.assetSymbol,
        amount: amountNum,
        duration: data.duration,
        walletAddress: data.walletAddress
      });

      const response = await apiFetch<{
        data: {
          positionId: string;
          transactionHash: string;
          estimatedApy: string;
        };
      }>('/api/defi/stake', {
        method: 'POST',
        body: {
          ...data,
          amount: amountNum // Convert to number for server expectation
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error staking assets:', error);
      throw error;
    }
  }

  /**
   * Unstake assets from a protocol
   */
  async unstakeAssets(data: {
    positionId: string;
    amount?: string;
    walletAddress: string;
  }) {
    try {
      // Validate required fields
      if (!data.positionId?.trim()) {
        throw new Error('Position ID is required');
      }
      if (data.amount && !data.amount.trim()) {
        throw new Error('Amount must not be empty');
      }
      if (!data.walletAddress?.trim()) {
        throw new Error('Wallet address is required');
      }

      console.log('Unstaking assets with data:', {
        positionId: data.positionId,
        amount: data.amount,
        walletAddress: data.walletAddress
      });

      const response = await apiFetch<{
        data: {
          transactionHash: string;
          remainingAmount: string;
        };
      }>('/api/defi/unstake', {
        method: 'POST',
        body: data
      });
      return response.data;
    } catch (error) {
      console.error('Error unstaking assets:', error);
      throw error;
    }
  }

  /**
   * Join a liquidity pool
   */
  async joinLiquidityPool(data: {
    poolId: string;
    token0Amount: string;
    token1Amount: string;
    minLpAmount?: string;
    walletAddress: string;
  }) {
    try {
      // Validate required fields
      if (!data.poolId?.trim()) {
        throw new Error('Pool ID is required');
      }
      if (!data.token0Amount?.trim()) {
        throw new Error('Token 0 amount is required');
      }
      if (!data.token1Amount?.trim()) {
        throw new Error('Token 1 amount is required');
      }
      if (!data.walletAddress?.trim()) {
        throw new Error('Wallet address is required');
      }

      console.log('Joining liquidity pool with data:', {
        poolId: data.poolId,
        token0Amount: data.token0Amount,
        token1Amount: data.token1Amount,
        walletAddress: data.walletAddress
      });

      const response = await apiFetch<{
        data: {
          positionId: string;
          transactionHash: string;
          lpTokensReceived: string;
        };
      }>('/api/defi/pools/join', {
        method: 'POST',
        body: data
      });
      return response.data;
    } catch (error) {
      console.error('Error joining liquidity pool:', error);
      throw error;
    }
  }

  /**
   * Exit a liquidity pool
   */
  async exitLiquidityPool(data: {
    poolId: string;
    lpAmount: string;
    walletAddress: string;
  }) {
    try {
      // Validate required fields
      if (!data.poolId?.trim()) {
        throw new Error('Pool ID is required');
      }
      if (!data.lpAmount?.trim()) {
        throw new Error('LP amount is required');
      }
      if (!data.walletAddress?.trim()) {
        throw new Error('Wallet address is required');
      }

      console.log('Exiting liquidity pool with data:', {
        poolId: data.poolId,
        lpAmount: data.lpAmount,
        walletAddress: data.walletAddress
      });

      const response = await apiFetch<{
        data: {
          transactionHash: string;
          token0Amount: string;
          token1Amount: string;
        };
      }>('/api/defi/pools/exit', {
        method: 'POST',
        body: data
      });
      return response.data;
    } catch (error) {
      console.error('Error exiting liquidity pool:', error);
      throw error;
    }
  }

  /**
   * Deposit to a yield farm
   */
  async depositToFarm(data: {
    farmId: string;
    amount: string;
    walletAddress: string;
  }) {
    try {
      // Validate required fields
      if (!data.farmId?.trim()) {
        throw new Error('Farm ID is required');
      }
      if (!data.amount?.trim()) {
        throw new Error('Amount is required');
      }
      if (!data.walletAddress?.trim()) {
        throw new Error('Wallet address is required');
      }

      console.log('Depositing to farm with data:', {
        farmId: data.farmId,
        farmIdType: typeof data.farmId,
        amount: data.amount,
        amountType: typeof data.amount,
        amountValue: parseFloat(data.amount),
        walletAddress: data.walletAddress,
        walletAddressType: typeof data.walletAddress,
        fullData: JSON.stringify(data)
      });

      const response = await apiFetch<{
        data: {
          transactionHash: string;
          deposited: string;
          estimatedDailyReward: string;
        };
      }>('/api/defi/farms/deposit', {
        method: 'POST',
        body: data
      });
      return response.data;
    } catch (error) {
      console.error('Error depositing to farm:', error);
      throw error;
    }
  }

  /**
   * Withdraw from a yield farm
   */
  async withdrawFromFarm(data: {
    farmId: string;
    amount: string;
    walletAddress: string;
  }) {
    try {
      // Validate required fields
      if (!data.farmId?.trim()) {
        throw new Error('Farm ID is required');
      }
      if (!data.amount?.trim()) {
        throw new Error('Amount is required');
      }
      if (!data.walletAddress?.trim()) {
        throw new Error('Wallet address is required');
      }

      console.log('Withdrawing from farm with data:', {
        farmId: data.farmId,
        farmIdType: typeof data.farmId,
        amount: data.amount,
        amountType: typeof data.amount,
        walletAddress: data.walletAddress,
        walletAddressType: typeof data.walletAddress,
        fullData: JSON.stringify(data)
      });

      const response = await apiFetch<{
        data: {
          transactionHash: string;
          withdrawn: string;
          rewardsHarvested: string;
        };
      }>('/api/defi/farms/withdraw', {
        method: 'POST',
        body: data
      });
      return response.data;
    } catch (error) {
      console.error('Error withdrawing from farm:', error);
      throw error;
    }
  }

  /**
   * Harvest rewards from a yield farm
   */
  async harvestFarmRewards(data: {
    farmId: string;
    walletAddress: string;
  }) {
    try {
      // Validate required fields
      if (!data.farmId?.trim()) {
        throw new Error('Farm ID is required');
      }
      if (!data.walletAddress?.trim()) {
        throw new Error('Wallet address is required');
      }

      console.log('Harvesting farm rewards with data:', {
        farmId: data.farmId,
        farmIdType: typeof data.farmId,
        walletAddress: data.walletAddress,
        walletAddressType: typeof data.walletAddress,
        fullData: JSON.stringify(data)
      });

      const response = await apiFetch<{
        data: {
          transactionHash: string;
          harvestedAmount: string;
          totalRewardTokens: number;
        };
      }>('/api/defi/farms/harvest', {
        method: 'POST',
        body: data
      });
      return response.data;
    } catch (error) {
      console.error('Error harvesting farm rewards:', error);
      throw error;
    }
  }

  /**
   * Claim rewards from a staking position
   */
  async claimStakingRewards(data: {
    positionId: string;
    walletAddress: string;
  }) {
    try {
      // Validate required fields
      if (!data.positionId?.trim()) {
        throw new Error('Position ID is required');
      }
      if (!data.walletAddress?.trim()) {
        throw new Error('Wallet address is required');
      }

      console.log('Claiming staking rewards with data:', {
        positionId: data.positionId,
        walletAddress: data.walletAddress
      });

      const response = await apiFetch<{
        data: {
          transactionHash: string;
          claimedAmount: string;
          newRewardBalance: string;
        };
      }>('/api/defi/claim-staking-rewards', {
        method: 'POST',
        body: data
      });
      return response.data;
    } catch (error) {
      console.error('Error claiming staking rewards:', error);
      throw error;
    }
  }

  /**
   * Build a transaction for a DeFi action
   * Constructs an unsigned transaction that can be signed and confirmed
   */
  async buildTransaction(params: BuildTxParams) {
    try {
      const res = await apiFetch<{ data: { unsignedTx: any } }>('/api/defi/build-tx', {
        method: 'POST',
        body: params
      });
      // Return the full response so callers can destructure correctly
      return res;
    } catch (error) {
      console.error('Error building transaction:', error);
      throw error;
    }
  }

  /**
   * Fetch chart history data for a specific position
   * Real historical data from the chart-history service
   */
  async getChartHistory(positionId: string, days: number = 30): Promise<Array<{ date: string; value?: number; apy?: number; tvl?: number }>> {
    try {
      const response = await apiFetch<{ data: { chartData: Array<{ date: string; value?: number; apy?: number; tvl?: number }> } }>(
        `/api/defi/chart-history/${positionId}?days=${days}`
      );
      return response.data?.chartData || [];
    } catch (error) {
      console.error(`Error fetching chart history for ${positionId}:`, error);
      // Return empty array on error - component will handle gracefully
      return [];
    }
  }

  /**
   * Fetch 30-day TVL history for a liquidity pool from TheGraph
   * Real historical TVL data via backend API
   */
  async getPoolTVLHistory(
    poolId: string,
    days: number = 30
  ): Promise<Array<{ date: string; tvl: number }>> {
    try {
      const response = await apiFetch<{
        data: { chartData: Array<{ date: string; tvl: number }> };
      }>(
        `/api/defi/pools/${encodeURIComponent(poolId)}/tvl-history?days=${days}`
      );
      return response.data?.chartData || [];
    } catch {
      // Silently return empty — chart will show "Collecting TVL history…"
      return [];
    }
  }

  /**
   * Get token icon from local map (no API call — route doesn't exist on backend)
   */
  async getTokenIcon(tokenAddress: string): Promise<string> {
    return this.getDefaultTokenIcon(tokenAddress);
  }

  /**
   * Get default token icon fallback
   * Uses common token logo URLs or a generic token icon
   */
  private getDefaultTokenIcon(tokenAddress: string): string {
    // Common token addresses to icons mapping
    const tokenIconMap: { [key: string]: string } = {
      // USDC
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
      // USDT
      '0xdac17f958d2ee523a2206206994597c13d831ec7': 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
      // DAI
      '0x6b175474e89094c44da98b954eedeac495271d0f': 'https://assets.coingecko.com/coins/images/9956/small/dai-multi-collateral-mcd.png',
      // WETH
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
      // WBTC
      '0x2260fac5e5542a773aa44fbcff9d822dcb4fce54': 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
      // UNI
      '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png',
      // AAVE
      '0x7fc66500c84a76ad7e9c93437e434122a1f16fdf': 'https://assets.coingecko.com/coins/images/12645/small/aave-token-square.png',
      // CRV
      '0xd533a949740bb3306d119cc777fa900ba034cd52': 'https://assets.coingecko.com/coins/images/12124/small/Curve.png',
      // LINK
      '0x514910771af9ca656af840dff83e8264ecf986ca': 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
    };

    const lowerAddress = tokenAddress.toLowerCase();
    return tokenIconMap[lowerAddress] || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
  }

  /**
   * Confirm a transaction after it has been signed and broadcast
   * Updates backend with transaction confirmation status
   */
  async confirmTransaction(data: {
    txHash: string;
    positionType?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      if (!data.txHash?.trim()) {
        throw new Error('Transaction hash is required');
      }

      console.log('Confirming transaction:', {
        txHash: data.txHash,
        positionType: data.positionType,
        metadata: data.metadata
      });

      const response = await apiFetch<{
        data: {
          success: boolean;
          message: string;
        };
      }>('/api/defi/confirm-tx', {
        method: 'POST',
        body: data
      });
      return response.data;
    } catch (error) {
      console.error('Error confirming transaction:', error);
      throw error;
    }
  }

  /**
   * Helper method to get default protocol icon
   */
  private getDefaultProtocolIcon(protocolName: string): string {
    const iconMap: { [key: string]: string } = {
      'Aave': 'https://cryptologos.cc/logos/aave-aave-logo.png',
      'Curve': 'https://cryptologos.cc/logos/curve-dao-token-crv-logo.png',
      'Uniswap': 'https://cryptologos.cc/logos/uniswap-uni-logo.png',
      'Compound': 'https://cryptologos.cc/logos/compound-comp-logo.png',
      'Lido': 'https://cryptologos.cc/logos/lido-dao-ldo-logo.png',
      'MakerDAO': 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png'
    };
    return iconMap[protocolName] || 'https://cryptologos.cc/logos/ethereum-eth-logo.png';
  }
}

export default new DefiService();
