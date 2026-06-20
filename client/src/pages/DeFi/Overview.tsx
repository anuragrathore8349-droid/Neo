import { getAddress } from 'ethers';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ProtocolCard } from '../../components/defi/ProtocolCard';
import { StakingPositionCard } from '../../components/defi/StakingPositionCard';
import { GasTracker } from '../../components/defi/GasTracker';
import { LiquidityPoolCard } from '../../components/defi/LiquidityPoolCard';
import { YieldFarmCard } from '../../components/defi/YieldFarmCard';
import { ActionModal } from '../../components/defi/ActionModal';
import { StakingModal } from '../../components/defi/StakingModal';
import { ProtocolDetailsModal } from '../../components/defi/ProtocolDetailsModal';
import { WalletTxModal } from '../../components/defi/WalletTxModal';
import { DefiErrorBoundary } from '../../components/defi/DefiErrorBoundary';
import defiService, {
  Protocol,
  StakingPosition,
  LiquidityPool,
  YieldFarm,
  GasPrice,
  DefiStats
} from '../../services/defi.service';
import { useAsync } from '../../hooks/useAsync';
import { useUser } from '../../context/UserContext';
import { getNetworkName } from '../../utils/network';

// Loading skeleton component
const LoadingSkeleton = () => (
  <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
    <div className="h-4 bg-gray-700 rounded mb-4"></div>
    <div className="h-4 bg-gray-700 rounded mb-2"></div>
    <div className="h-4 bg-gray-700 rounded w-3/4"></div>
  </div>
);

// Error component
const ErrorMessage = ({ title, message }: { title: string; message: string }) => (
  <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-200">
    <h3 className="font-semibold mb-1">{title}</h3>
    <p className="text-sm">{message}</p>
  </div>
);

const DeFiOverview: React.FC = () => {
  const { user } = useUser();
  const [metaMaskAddress, setMetaMaskAddress] = useState<string>('');
  const metaMaskAddressRef = React.useRef<string>('');

  // Create a stable empty dependency array
  const emptyDeps = useMemo(() => [], []);

  // Wrap async functions in useCallback to prevent recreation on every render
  const fetchProtocols = useCallback(() => defiService.getProtocols(), []);
  const fetchStakingPositions = useCallback(() => defiService.getStakingPositions(), []);
  const fetchLiquidityPools = useCallback(() => defiService.getLiquidityPools(), []);
  const fetchYieldFarms = useCallback(() => defiService.getYieldFarms(), []);
  const fetchGasPrices = useCallback(() => defiService.getGasPrices(), []);
  const fetchDefiStats = useCallback(() => defiService.getDefiStats(), []);

  // Fetch all data with stable dependencies
  const protocols = useAsync(fetchProtocols, true, emptyDeps);
  const stakingPositions = useAsync(fetchStakingPositions, true, emptyDeps);
  const liquidityPools = useAsync(fetchLiquidityPools, true, emptyDeps);
  const yieldFarms = useAsync(fetchYieldFarms, true, emptyDeps);
  const gasPrices = useAsync(fetchGasPrices, true, emptyDeps);
  const defiStats = useAsync(fetchDefiStats, true, emptyDeps);

  // Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    actionType: string;
    selectedData: any;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    actionType: '',
    selectedData: null,
    isSubmitting: false
  });

  // WalletTxModal state
  const [walletTxModal, setWalletTxModal] = useState<{
    isOpen: boolean;
    action: string;
    params: Record<string, any>;
  }>({
    isOpen: false,
    action: '',
    params: {}
  });

  // Chart data cache (fetched once for all positions)
  const [chartDataMap, setChartDataMap] = useState<Record<string, Array<{ date: string; value: number }>>>({});

  // Network state for dynamic display
  const [currentNetwork, setCurrentNetwork] = useState<string>('Ethereum Mainnet');
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);

  // Read wallet address directly from MetaMask on mount and on account change
  // Ensures address is always EIP-55 checksummed
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;

    const readAccount = async () => {
      try {
        // eth_accounts: silent — returns already-connected accounts, empty if none
        const accounts: string[] = await eth.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          try {
            const addr = getAddress(accounts[0]);
            setMetaMaskAddress(addr);
            metaMaskAddressRef.current = addr;
          } catch {
            setMetaMaskAddress(accounts[0]);
            metaMaskAddressRef.current = accounts[0];
          }
        }
        // If accounts is empty, user hasn't connected yet — show Connect button
      } catch (err) {
        console.warn('Could not read MetaMask accounts:', err);
      }
    };

    const readNetwork = async () => {
      try {
        const chainId: string = await eth.request({ method: 'eth_chainId' });
        setCurrentNetwork(getNetworkName(chainId));
      } catch (err) {
        console.warn('Could not read network:', err);
      }
    };

    readAccount();
    readNetwork();

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        try {
          const addr = getAddress(accounts[0]);
          setMetaMaskAddress(addr);
          metaMaskAddressRef.current = addr;
        } catch {
          setMetaMaskAddress(accounts[0]);
          metaMaskAddressRef.current = accounts[0];
        }
      } else {
        setMetaMaskAddress('');
        metaMaskAddressRef.current = '';
      }
    };

    const handleChainChanged = (chainId: string) => {
      setCurrentNetwork(getNetworkName(chainId));
    };

    eth.on('accountsChanged', handleAccountsChanged);
    eth.on('chainChanged', handleChainChanged);

    return () => {
      eth.removeListener('accountsChanged', handleAccountsChanged);
      eth.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  // Use live MetaMask address — fallback to stored user address only for display
  const walletAddress = metaMaskAddress || (() => {
    if (!user?.walletAddress) return '';
    try { return getAddress(user.walletAddress); }
    catch { return ''; } // don't use an invalid address for transactions
  })();

  // Helper — always returns current wallet address, never stale closure value
  const getWalletAddress = (): string => {
    return metaMaskAddressRef.current || walletAddress;
  };

  // Handler to connect wallet via MetaMask
  const connectWallet = async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      alert('MetaMask is not installed. Please install it from metamask.io');
      return;
    }
    try {
      setIsWalletConnecting(true);
      // eth_requestAccounts: opens MetaMask popup, user approves connection
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        try {
          const addr = getAddress(accounts[0]);
          setMetaMaskAddress(addr);
          metaMaskAddressRef.current = addr;
        } catch {
          // Fallback if ethers is unavailable — use address as-is
          setMetaMaskAddress(accounts[0]);
          metaMaskAddressRef.current = accounts[0];
        }
      }
    } catch (err: any) {
      if (err?.code === 4001) {
        console.warn('User rejected wallet connection');
      } else {
        console.error('Could not connect wallet:', err);
      }
    } finally {
      setIsWalletConnecting(false);
    }
  };

  // Auto-refresh gas prices every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      gasPrices.refetch();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [gasPrices]);

  // Fetch chart history for all active positions in one pass
  const fetchAllChartData = useCallback(async (positions: StakingPosition[]) => {
    const activePositions = positions.filter(
      p => p.status !== 'available' && p.id && /^[a-f\d]{24}$/i.test(p.id)
    );
    const results: Record<string, Array<{ date: string; value: number }>> = {};
    await Promise.allSettled(
      activePositions.map(async p => {
        try {
          const data = await defiService.getChartHistory(p.id, 30);
          results[p.id] = data;
        } catch (_) { results[p.id] = []; }
      })
    );
    setChartDataMap(results);
  }, []);

  // When staking positions load, fetch chart data
  useEffect(() => {
    if (stakingPositions.data?.positions && stakingPositions.data.positions.length) {
      fetchAllChartData(stakingPositions.data.positions);
    }
  }, [stakingPositions.data, fetchAllChartData]);

  // Auto-refresh gas prices every 60 seconds (existing code removed - duplicate)

  // Handle refresh with proper binding
  const handleProtocolsRefresh = async () => {
    await protocols.refetch();
  };

  const handleStakingRefresh = async () => {
    await stakingPositions.refetch();
  };

  const handlePoolsRefresh = async () => {
    await liquidityPools.refetch();
  };

  const handleFarmsRefresh = async () => {
    await yieldFarms.refetch();
  };

  const handleGasRefresh = async () => {
    await gasPrices.refetch();
  };

  const handleStatsRefresh = async () => {
    await defiStats.refetch();
  };

  // Action Modal Handlers - Open modal for different actions
  const openModal = (actionType: string, selectedData: any) => {
    setModalState({
      isOpen: true,
      actionType,
      selectedData,
      isSubmitting: false
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      actionType: '',
      selectedData: null,
      isSubmitting: false
    });
  };

  // Protocol Card Handlers
  const handleViewDetails = (protocol: Protocol) => {
    openModal('viewDetails', protocol);
  };

  // Liquidity Pool Handlers
  const handleAddLiquidity = (pool: LiquidityPool) => {
    const token0 = pool.tokens[0]?.symbol || 'Token0';
    const token1 = pool.tokens[1]?.symbol || 'Token1';
    openModal('addLiquidity', {
      ...pool,
      _modalDescription: `Enter the amount of ${token0} to add. An equivalent value of ${token1} will be calculated automatically.`,
      _modalInputLabel: `Amount (${token0})`,
      _modalPlaceholder: `e.g. 100 ${token0}`,
    });
  };

  const handleRemoveLiquidity = (pool: LiquidityPool) => {
    openModal('removeLiquidity', pool);
  };

  // Yield Farm Handlers
  const handleDeposit = (farm: YieldFarm) => {
    openModal('deposit', farm);
  };

  const handleWithdraw = (farm: YieldFarm) => {
    openModal('withdraw', farm);
  };

  const handleHarvest = (farm: YieldFarm) => {
    setWalletTxModal({
      isOpen: true,
      action: 'harvest',
      params: {
        action:     'harvest',
        protocolId: farm.protocol?.toLowerCase() || 'curve',
        farmId:     farm.id,
        walletAddress: getWalletAddress(),
      },
    });
  };

  // Staking Position Handlers
  const handleClaimRewards = (position: StakingPosition) => {
    // Skip ActionModal for claimRewards — no input needed
    if (!position.id || position.status === 'available') return;
    setWalletTxModal({
      isOpen: true,
      action: 'claimRewards',
      params: {
        positionId: position.id || (position as any)._id,
        walletAddress: getWalletAddress()
      }
    });
  };

  const handleUnstake = (position: StakingPosition) => {
    openModal('unstake', position);
  };

  const handleStake = () => {
    // Use the first available protocol for staking, or create a default one
    const defaultProtocol = protocols.data?.[0] || {
      id: 'default-staking',
      name: 'Staking',
      type: 'staking' as const,
      networks: ['Ethereum'],
      tvl: '$0',
      apy: '0%',
      risk: 'Medium' as const,
      chain: 'Ethereum'
    };
    openModal('stake', defaultProtocol);
  };

  // Derive network string for transaction parameters
  const networkForParams = currentNetwork.toLowerCase().includes('sepolia')
    ? 'sepolia'
    : currentNetwork.toLowerCase().includes('polygon')
    ? 'polygon'
    : currentNetwork.toLowerCase().includes('arbitrum')
    ? 'arbitrum'
    : 'ethereum';

  // Modal submission handler - Opens WalletTxModal instead of directly calling defiService
  const handleModalSubmit = async (amount: string) => {
    if (modalState.actionType === 'viewDetails') { closeModal(); return; }

    // Guard: ensure wallet is connected before any tx
    if (!getWalletAddress()) {
      alert('Please connect your MetaMask wallet first.');
      return;
    }

    const base: Record<string, any> = { walletAddress: getWalletAddress() };

    switch (modalState.actionType) {
      case 'addLiquidity':
        setWalletTxModal({
          isOpen: true,
          action: 'addLiquidity',
          params: {
            ...base,
            action:       'addLiquidity',
            protocolId:   modalState.selectedData?.protocol?.toLowerCase().replace(' ', '') || 'uniswap',
            poolId:       modalState.selectedData?.id,
            token0Amount: amount,
            token1Amount: amount,  // equal split — user can refine in future
            network:      networkForParams,
          },
        });
        break;

      case 'removeLiquidity':
        setWalletTxModal({
          isOpen: true,
          action: 'removeLiquidity',
          params: {
            ...base,
            action:    'removeLiquidity',
            protocolId: modalState.selectedData?.protocol?.toLowerCase().replace(' ', '') || 'uniswap',
            poolId:    modalState.selectedData?.id,
            lpAmount:  amount,   // use lpAmount not amount
            network:   networkForParams,
          },
        });
        break;

      case 'deposit':
        setWalletTxModal({
          isOpen: true,
          action: 'deposit',
          params: {
            ...base,
            action:     'deposit',
            protocolId: modalState.selectedData?.protocol?.toLowerCase() || 'curve',
            farmId:     modalState.selectedData?.id,
            amount,
            network:    networkForParams,
          },
        });
        break;

      case 'withdraw':
        setWalletTxModal({
          isOpen: true,
          action: 'withdraw',
          params: {
            ...base,
            action:     'withdraw',
            protocolId: modalState.selectedData?.protocol?.toLowerCase() || 'curve',
            farmId:     modalState.selectedData?.id,
            amount,
            network:    networkForParams,
          },
        });
        break;

      case 'unstake':
        setWalletTxModal({
          isOpen: true,
          action: 'unstake',
          params: {
            ...base,
            action:     'unstake',
            protocolId: (modalState.selectedData?.protocol || 'lido').toLowerCase(),
            positionId: modalState.selectedData?.id || modalState.selectedData?._id,
            amount,
            network:    networkForParams,
          },
        });
        break;

      default:
        console.warn('Unknown action:', modalState.actionType);
        return;
    }
    closeModal();
  };

  // Open WalletTxModal for staking transaction
  const handleStakingModalSubmit = async (protocolId: string, assetSymbol: string, amount: string) => {
    // Guard: ensure wallet is connected before any tx
    if (!getWalletAddress()) {
      alert('Please connect your MetaMask wallet first.');
      return;
    }
    closeModal(); // close staking selection modal
    setWalletTxModal({
      isOpen: true,
      action: 'stake',
      params: {
        action: 'stake',
        protocolId,
        assetSymbol,
        amount,
        walletAddress: getWalletAddress(),
        positionType: 'staking',
        metadata: {
          protocolId,
          asset: assetSymbol,
          amount,
          walletAddress: getWalletAddress(),
          network: networkForParams
        }
      }
    });
  };

  // Handle WalletTxModal success - refetch positions and close
  const handleWalletTxSuccess = async (txHash: string) => {
    console.log('Transaction successful:', txHash);
    // Refetch all relevant data based on the action
    const action = walletTxModal.action;
    
    if (action === 'stake' || action === 'unstake' || action === 'claimRewards') {
      await stakingPositions.refetch();
    } else if (action === 'addLiquidity' || action === 'removeLiquidity') {
      await liquidityPools.refetch();
    } else if (action === 'deposit' || action === 'withdraw' || action === 'harvest') {
      await yieldFarms.refetch();
    }
    
    // Close wallet tx modal
    setWalletTxModal({ isOpen: false, action: '', params: {} });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Stats */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">DeFi Hub</h1>
              <p className="text-gray-400">Manage your decentralized finance positions and explore new opportunities</p>
            </div>
            {/* Connected Wallet Badge or Connect Button */}
            {metaMaskAddress ? (
              <div className="bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/40 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">Connected Wallet</p>
                <p className="text-sm font-mono text-primary">
                  {metaMaskAddress.slice(0, 6)}…{metaMaskAddress.slice(-4)}
                </p>
                <p className="text-xs text-secondary mt-1">{currentNetwork}</p>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isWalletConnecting}
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 text-white px-5 py-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
              >
                {isWalletConnecting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Connecting…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Connect MetaMask
                  </>
                )}
              </button>
            )}
          </div>
          
          {/* Stats Overview */}
          {!defiStats.loading && defiStats.data && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-sm mb-1">Total Value Locked</p>
                <p className="text-2xl font-bold text-green-400">{defiStats.data.totalValueLocked || '$0'}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-sm mb-1">Total Deposited</p>
                <p className="text-2xl font-bold text-blue-400">{defiStats.data.totalDeposited || '$0'}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-sm mb-1">Total Rewards</p>
                <p className="text-2xl font-bold text-yellow-400">{defiStats.data.totalRewards || '$0'}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-sm mb-1">Average APY</p>
                <p className="text-2xl font-bold text-purple-400">{defiStats.data.averageApy || '0%'}</p>
              </div>
            </div>
          )}
          {defiStats.error && (
            <button 
              onClick={handleStatsRefresh}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition"
            >
              Retry Loading Stats
            </button>
          )}
        </div>

        {/* Top Protocols Section */}
        <DefiErrorBoundary section="Protocols">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Top Protocols</h2>
              <button
                onClick={handleProtocolsRefresh}
                disabled={protocols.loading}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm transition"
              >
                {protocols.loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            
            {protocols.error && (
              <ErrorMessage title="Failed to load protocols" message={protocols.error.message} />
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {protocols.loading ? (
                <>
                  <LoadingSkeleton />
                  <LoadingSkeleton />
                  <LoadingSkeleton />
                </>
              ) : protocols.data && protocols.data.length > 0 ? (
                protocols.data.map((protocol) => (
                  <ProtocolCard 
                    key={protocol.id} 
                    protocol={protocol}
                    onViewDetails={handleViewDetails}
                  />
                ))
              ) : (
                <div className="col-span-3 text-center text-gray-400">
                  No protocols available. Try refreshing.
                </div>
              )}
            </div>
          </div>
        </DefiErrorBoundary>

        {/* Liquidity Positions Section */}
        <DefiErrorBoundary section="Liquidity Pools">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Your Liquidity Positions</h2>
              <button
                onClick={handlePoolsRefresh}
                disabled={liquidityPools.loading}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm transition"
              >
                {liquidityPools.loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            
            {liquidityPools.error && (
              <ErrorMessage title="Failed to load liquidity pools" message={liquidityPools.error.message} />
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {liquidityPools.loading ? (
                <>
                  <LoadingSkeleton />
                  <LoadingSkeleton />
                </>
              ) : liquidityPools.data && liquidityPools.data.length > 0 ? (
                liquidityPools.data.map((pool) => (
                  <LiquidityPoolCard 
                    key={pool.id} 
                    pool={pool}
                    onAddLiquidity={handleAddLiquidity}
                    onRemoveLiquidity={handleRemoveLiquidity}
                  />
                ))
              ) : (
                <div className="col-span-2 text-center text-gray-400 py-8">
                  No liquidity positions. Join a pool to get started.
                </div>
              )}
            </div>
          </div>
        </DefiErrorBoundary>

        {/* Active Yield Farms Section */}
        <DefiErrorBoundary section="Yield Farms">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Active Yield Farms</h2>
              <button
                onClick={handleFarmsRefresh}
                disabled={yieldFarms.loading}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm transition"
              >
                {yieldFarms.loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            
            {yieldFarms.error && (
              <ErrorMessage title="Failed to load yield farms" message={yieldFarms.error.message} />
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {yieldFarms.loading ? (
                <>
                  <LoadingSkeleton />
                  <LoadingSkeleton />
                </>
              ) : yieldFarms.data && yieldFarms.data.length > 0 ? (
                yieldFarms.data.map((farm) => (
                  <YieldFarmCard 
                    key={farm.id} 
                    farm={farm}
                    onDeposit={handleDeposit}
                    onWithdraw={handleWithdraw}
                    onHarvest={handleHarvest}
                  />
                ))
              ) : (
                <div className="col-span-2 text-center text-gray-400 py-8">
                  No active yield farms available.
                </div>
              )}
            </div>
          </div>
        </DefiErrorBoundary>

        {/* Staking Positions Section */}
        <DefiErrorBoundary section="Staking">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Staking Positions</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => openModal('stake', null)}
                  className="px-4 py-1 bg-green-600 hover:bg-green-700 rounded text-sm font-medium transition"
                >
                  + Stake Now
                </button>
                <button
                  onClick={handleStakingRefresh}
                  disabled={stakingPositions.loading}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm transition"
                >
                  {stakingPositions.loading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>
            
            {stakingPositions.error && (
              <ErrorMessage title="Failed to load staking positions" message={stakingPositions.error.message} />
            )}

          {/* Active/User Staking Positions */}
          {stakingPositions.loading ? (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">My Staking Positions</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LoadingSkeleton />
                <LoadingSkeleton />
              </div>
            </div>
          ) : (
            (() => {
              const myPositions = stakingPositions.data?.positions?.filter(
                pos => parseFloat(pos.amount?.replace(/[$,]/g, '') || '0') > 0
              ) || [];
              return myPositions.length > 0 ? (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4">My Staking Positions</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {myPositions.map((position) => (
                      <StakingPositionCard 
                        key={position.id} 
                        position={position}
                        chartData={chartDataMap[position.id || ''] || []}
                        onClaimRewards={handleClaimRewards}
                        onUnstake={handleUnstake}
                      />
                    ))}
                  </div>
                </div>
              ) : null;
            })()
          )}

          {/* Available Staking Opportunities */}
          {(() => {
            const opportunities = stakingPositions.data?.opportunities || [];
            return opportunities.length > 0 ? (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-300">Available Staking Opportunities</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {opportunities.map((position) => (
                    <StakingPositionCard 
                      key={position.id} 
                      position={position}
                      chartData={chartDataMap[position.id || ''] || []}
                      onStake={handleStake}
                    />
                  ))}
                </div>
              </div>
            ) : null;
          })()}

            {!stakingPositions.loading && (!stakingPositions.data?.positions || stakingPositions.data.positions.length === 0) && (!stakingPositions.data?.opportunities || stakingPositions.data.opportunities.length === 0) && (
              <div className="col-span-2 text-center text-gray-400 py-8">
                No staking positions yet. Start staking to earn rewards.
              </div>
            )}
          </div>
        </DefiErrorBoundary>

        {/* Gas Tracker Section */}
        <DefiErrorBoundary section="Gas Tracker">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Gas Prices</h2>
              <button
                onClick={handleGasRefresh}
                disabled={gasPrices.loading}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm transition"
              >
                {gasPrices.loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            
            {gasPrices.error && (
              <ErrorMessage title="Failed to load gas prices" message={gasPrices.error.message} />
            )}
            
            {gasPrices.loading ? (
              <LoadingSkeleton />
            ) : gasPrices.data && gasPrices.data.length > 0 ? (
              <GasTracker gasPrices={gasPrices.data} />
            ) : (
              <div className="text-center text-gray-400">
                No gas price data available.
              </div>
            )}
          </div>
        </DefiErrorBoundary>

        {/* Protocol Details Modal */}
        <ProtocolDetailsModal
          isOpen={modalState.isOpen && modalState.actionType === 'viewDetails'}
          protocol={modalState.actionType === 'viewDetails' ? (modalState.selectedData as Protocol | null) : null}
          onClose={closeModal}
        />

        {/* Staking Modal - Uses live data from getStakingPositions */}
        <StakingModal
          isOpen={modalState.isOpen && modalState.actionType === 'stake'}
          opportunities={stakingPositions.data?.opportunities || []}
          isLoading={modalState.isSubmitting}
          onClose={closeModal}
          onConfirm={handleStakingModalSubmit}
        />

        {/* Wallet Transaction Modal - Handles signing and confirmation */}
        <WalletTxModal
          isOpen={walletTxModal.isOpen}
          action={walletTxModal.action}
          params={walletTxModal.params}
          onClose={() => setWalletTxModal({ isOpen: false, action: '', params: {} })}
          onSuccess={handleWalletTxSuccess}
        />

        {/* Action Modal - For non-staking actions */}
        <ActionModal
          isOpen={modalState.isOpen && modalState.actionType !== 'viewDetails' && modalState.actionType !== 'stake'}
          title={getModalTitle(modalState.actionType)}
          description={getModalDescription(modalState.actionType, modalState.selectedData)}
          inputLabel={getModalInputLabel(modalState.actionType, modalState.selectedData)}
          inputPlaceholder={getModalInputPlaceholder(modalState.actionType)}
          actionLabel={getModalActionLabel(modalState.actionType)}
          isLoading={modalState.isSubmitting}
          onClose={closeModal}
          onConfirm={handleModalSubmit}
        />
      </div>
    </div>
  );
};

/**
 * Helper functions to get modal text based on action type
 */
function getModalTitle(actionType: string): string {
  const titles: { [key: string]: string } = {
    stake: 'Stake Your Assets',
    viewDetails: 'Protocol Details',
    addLiquidity: 'Add Liquidity',
    removeLiquidity: 'Remove Liquidity',
    deposit: 'Deposit to Farm',
    withdraw: 'Withdraw from Farm',
    harvest: 'Harvest Rewards',
    claimRewards: 'Claim Staking Rewards',
    unstake: 'Unstake Position'
  };
  return titles[actionType] || 'Confirm Action';
}

function getModalDescription(actionType: string, selectedData?: any): string {
  if (actionType === 'addLiquidity' && selectedData?._modalDescription) {
    return selectedData._modalDescription;
  }
  const descriptions: { [key: string]: string } = {
    stake: 'Choose an asset and enter the amount you want to stake to earn rewards',
    viewDetails: 'View detailed information about this protocol',
    addLiquidity: 'Enter the amount of the first token to add. Both tokens are required in the ratio set by the pool.',
    removeLiquidity: 'Enter the amount you want to remove from this pool',
    deposit: 'Enter the amount you want to deposit to this yield farm',
    withdraw: 'Enter the amount you want to withdraw from this farm',
    harvest: 'Harvest your accumulated farm rewards',
    claimRewards: 'Claim your accumulated staking rewards',
    unstake: 'Unstake your position'
  };
  return descriptions[actionType] || '';
}

function getModalInputLabel(actionType: string, selectedData?: any): string {
  if (actionType === 'addLiquidity' && selectedData?._modalInputLabel) {
    return selectedData._modalInputLabel;
  }
  const labels: { [key: string]: string } = {
    stake: 'Amount to Stake',
    viewDetails: '',
    addLiquidity: 'Amount (Token 0)',
    removeLiquidity: 'Amount to Remove',
    deposit: 'Amount to Deposit',
    withdraw: 'Amount to Withdraw',
    harvest: '',
    claimRewards: '',
    unstake: 'Amount to Unstake'
  };
  return labels[actionType] || '';
}

function getModalInputPlaceholder(actionType: string): string {
  const placeholders: { [key: string]: string } = {
    stake: 'Enter amount (ETH, AAVE, or CRV)',
    addLiquidity: 'Enter amount (USD)',
    removeLiquidity: 'Enter amount (USD)',
    deposit: 'Enter amount (USD)',
    withdraw: 'Enter amount (USD)',
    unstake: 'Enter amount'
  };
  return placeholders[actionType] || '';
}

function getModalActionLabel(actionType: string): string {
  const labels: { [key: string]: string } = {
    stake: 'Stake Now',
    viewDetails: 'Close',
    addLiquidity: 'Add Liquidity',
    removeLiquidity: 'Remove Liquidity',
    deposit: 'Deposit',
    withdraw: 'Withdraw',
    harvest: 'Harvest',
    claimRewards: 'Claim Rewards',
    unstake: 'Unstake'
  };
  return labels[actionType] || 'Confirm';
}

export default DeFiOverview;