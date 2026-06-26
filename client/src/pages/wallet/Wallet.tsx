// client/src/pages/wallet/Wallet.tsx
import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/common/Tabs';
import WalletHeader from '../../components/wallet/WalletHeader';
import ConnectedWallet from '../../components/wallet/ConnectedWallet';
import QuickActions from '../../components/wallet/QuickActions';
import NetworkStatus from '../../components/wallet/NetworkStatus';
import OverviewTab from '../../components/wallet/tabs/OverviewTab';
import TransactionsTab from '../../components/wallet/tabs/TransactionsTab';
import AddressBookTab from '../../components/wallet/tabs/AddressBookTab';
import SecurityTab from '../../components/wallet/tabs/SecurityTab';
import SettingsTab from '../../components/wallet/tabs/SettingsTab';
import ConnectWalletModal from '../../components/wallet/ConnectWalletModal';
import SendModal from '../../components/wallet/modals/SendModal';
import ReceiveModal from '../../components/wallet/modals/ReceiveModal';
import GlassCard from '../../components/common/GlassCard';
import { 
  getWallets, getWalletTransactions, getGasPrices, 
  connectWallet, removeWallet, getAddressBook, 
  addAddressToBook, deleteAddressFromBook 
} from '../../services/wallet.service';
import { getMarketPrices } from '../../services/market.service';
import { Loader, Wallet as WalletIcon, X } from 'lucide-react';
import { toast } from 'react-toastify';
import QRCodeWrapper from '../../components/wallet/QRCodeWrapper';

interface ConnectedWallet {
  _id:        string;
  name:       string;
  type:       'exchange' | 'defi' | 'external';
  provider:   string;
  address:    string;
  network:    string;
  isVerified: boolean;
  balances?:  Array<{ assetId?: string; symbol: string; amount: number }>;
}

interface WalletTransaction {
  hash:      string;
  from:      string;
  to:        string;
  asset:     string;
  amount:    number;
  type:      'send' | 'receive' | 'swap' | 'stake';
  status:    'pending' | 'confirmed' | 'failed';
  timestamp: string;
  gasUsed?:  number;
  gasPrice?: number;
}

interface AddressBookEntry {
  id:      string;
  name:    string;
  address: string;
  network: string;
  notes?:  string;
}

const Wallet: React.FC = () => {
  // Core state
  const [connectedWallets, setConnectedWallets] = useState<ConnectedWallet[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>([]);
  const [gasPrice, setGasPrice] = useState({ slow: 20, medium: 25, fast: 35 });
  const [assetPrices, setAssetPrices] = useState<Record<string, number>>({});

  // UI state
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedWalletForAction, setSelectedWalletForAction] = useState<ConnectedWallet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentChainId, setCurrentChainId] = useState<string | null>(null);

  // Address formatting
  const formatAddress = (address: string): string => 
    address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : '';

  const formatDate = (date: string): string => 
    new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Load all wallet data
  const loadWalletData = async (isBackgroundRefresh = false) => {
    try {
      if (isBackgroundRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Parallel load: wallets, transactions, address book, gas prices
      const [walletsRes, transRes, addressRes, gasRes] = await Promise.allSettled([
        getWallets(),
        getWalletTransactions({ page: 1, limit: 50 }),
        getAddressBook(),
        getGasPrices(),
      ]);

      if (walletsRes.status === 'fulfilled') {
        const wData = (walletsRes.value as any)?.data || [];
        setConnectedWallets(wData);

        // Fetch live prices for wallet assets
        const symbols = new Set<string>();
        wData.forEach(w => {
          w.balances?.forEach((b: any) => symbols.add(b.symbol));
        });

        if (symbols.size > 0) {
          try {
            const pricesRes = await getMarketPrices(Array.from(symbols));
            const prices: Record<string, number> = {};
            Object.entries((pricesRes as any).data || {}).forEach(([sym, data]: [string, any]) => {
              prices[sym] = data?.price || 0;
            });
            setAssetPrices(prices);
          } catch (e) {
            console.warn('Failed to fetch asset prices:', e);
          }
        }
      }

      if (transRes.status === 'fulfilled') {
        setTransactions((transRes.value as any)?.data?.transactions || []);
      }

      if (addressRes.status === 'fulfilled') {
        setAddressBook((addressRes.value as any)?.data || []);
      }

      if (gasRes.status === 'fulfilled') {
        const gData = (gasRes.value as any)?.data;
        if (gData) setGasPrice(gData);
      }
    } catch (err: any) {
      console.error('Failed to load wallet data:', err);
      if (!isBackgroundRefresh) {
        setError(err.message || 'Failed to load wallet data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Setup MetaMask listeners once - SEPARATE effect to prevent duplicate listeners
  useEffect(() => {
    if (!window.ethereum) return;

    const handleChainChanged = (chainId: string) => {
      setCurrentChainId(chainId);
    };

    const handleAccountsChanged = () => {
      loadWalletData();
    };

    // Add listeners
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('accountsChanged', handleAccountsChanged);

    // Get initial chain ID
    try {
      window.ethereum.request({ method: 'eth_chainId' }).then((chainId: string) => {
        setCurrentChainId(chainId);
      });
    } catch (e) {
      console.warn('Could not get chain ID:', e);
    }

    // IMPORTANT: Remove listeners on cleanup to prevent duplicate listeners
    return () => {
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, []);

  useEffect(() => {
    loadWalletData(false); // initial load — show full loading spinner
    const interval = setInterval(() => loadWalletData(true), 30000); // background refresh — no spinner
    return () => clearInterval(interval);
  }, []);

  // Connect new wallet
  const handleConnectWallet = async (name: string, type: 'external' | 'exchange' | 'defi') => {
    setConnecting(true);
    try {
      if (type === 'external') {
        if (!window.ethereum) {
          throw new Error('MetaMask or compatible wallet not detected. Please install MetaMask.');
        }

        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });

        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts returned from wallet');
        }

        const address = accounts[0];
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const networkMap: Record<string, string> = {
          '0x1': 'Ethereum',
          '0x89': 'Polygon',
          '0xa4b1': 'Arbitrum',
          '0xa': 'Optimism',
          '0x8': 'Testnet',
        };
        const network = networkMap[chainId] || 'Ethereum';

        // Sign a message to verify ownership - use fixed format that server can verify
        const message = `Connect wallet ${address} to NeoFin`;
        const signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [message, address],
        });

        const res = await connectWallet({
          name: name || `${network} Wallet`,
          type: 'external',
          provider: 'MetaMask',
          address,
          network,
          signature,
        });

        if (res.status === 'success' || res.data) {
          toast.success('Wallet connected successfully!');
          setShowConnectModal(false);
          loadWalletData();
        }
      } else {
        // Exchange/DeFi wallets would need API key input
        toast.info('Exchange connection coming soon');
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to connect wallet';
      setError(msg);
      toast.error(msg);
    } finally {
      setConnecting(false);
    }
  };

  // Remove wallet
  const handleRemoveWallet = async (walletId: string) => {
    if (!window.confirm('Are you sure? This action cannot be undone.')) return;
    try {
      await removeWallet(walletId);
      toast.success('Wallet removed');
      loadWalletData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove wallet');
    }
  };

  // Add address to book
  const handleAddAddress = async (addr: Omit<AddressBookEntry, 'id'>) => {
    try {
      const res = await addAddressToBook(addr as any);
      toast.success('Address added to book');
      setAddressBook([...addressBook, res.data]);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add address');
      throw err;
    }
  };

  // Delete address from book
  const handleDeleteAddress = async (id: string) => {
    try {
      await deleteAddressFromBook(id);
      setAddressBook(addressBook.filter(a => a.id !== id));
      toast.success('Address removed');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete address');
      throw err;
    }
  };

  // Export transaction history
  const handleExportTransactions = () => {
    const rows = [
      ['Hash', 'Type', 'From', 'To', 'Asset', 'Amount', 'Status', 'Date'],
      ...transactions.map(t => [
        t.hash, t.type, t.from, t.to, t.asset, t.amount, t.status, formatDate(t.timestamp),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto relative">
      {refreshing && (
        <div className="fixed top-4 right-4 z-50 bg-dark-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-400 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Updating wallet data...
        </div>
      )}
      {/* Header */}
      <WalletHeader 
        isConnecting={connecting}
        onConnect={() => setShowConnectModal(true)}
        onExport={handleExportTransactions}
      />

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">✕</button>
        </div>
      )}

      {/* Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-4 sm:p-6">
          <p className="text-dark-400 text-sm mb-1">Connected Wallets</p>
          <p className="text-2xl font-bold text-white">{connectedWallets.length}</p>
          <p className="text-dark-400 text-xs mt-2">
            {connectedWallets.length === 0 ? 'No wallets connected' : 'Active'}
          </p>
        </GlassCard>
        <GlassCard className="p-4 sm:p-6">
          <p className="text-dark-400 text-sm mb-1">Total Balance (USD)</p>
          <p className="text-2xl font-bold text-white">
            $
            {connectedWallets
              .reduce((sum, w) => {
                const balance = w.balances?.reduce((b, bal) => {
                  const price = assetPrices[bal.symbol] || 0;
                  return b + bal.amount * price;
                }, 0) || 0;
                return sum + balance;
              }, 0)
              .toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
        </GlassCard>
        <GlassCard className="p-4 sm:p-6">
          <p className="text-dark-400 text-sm mb-1">Transactions</p>
          <p className="text-2xl font-bold text-white">{transactions.length}</p>
          <p className="text-dark-400 text-xs mt-2">In transaction history</p>
        </GlassCard>
      </div>

      {/* Main Content with Tabs */}
      <GlassCard className="overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="border-b border-dark-700 rounded-none w-full justify-start px-4 sm:px-6 pt-4 sm:pt-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="addressbook">Address Book</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="p-4 sm:p-6">
            <div className="space-y-6">
              {/* Connected Wallets */}
              <div>
                <h3 className="text-lg sm:text-xl font-semibold mb-4">Connected Wallets</h3>
                {connectedWallets.length === 0 ? (
                  <div className="text-center py-10 bg-dark-800/50 rounded-lg border border-dark-700">
                    <WalletIcon size={44} className="mx-auto mb-3 text-dark-400" />
                    <p className="text-lg font-medium mb-1">No Wallets Connected</p>
                    <p className="text-dark-400 text-sm mb-5">Connect your wallet to manage assets</p>
                    <button 
                      className="btn-primary" 
                      onClick={() => setShowConnectModal(true)}
                      disabled={connecting}
                    >
                      {connecting ? 'Connecting…' : 'Connect Wallet'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {connectedWallets.map(wallet => (
                      <ConnectedWallet
                        key={wallet._id}
                        wallet={wallet}
                        formatAddress={formatAddress}
                        currentChainId={currentChainId}
                        assetPrices={assetPrices}
                        onCopy={(addr) => {
                          navigator.clipboard.writeText(addr);
                          toast.success('Address copied');
                        }}
                        onQr={(w) => {
                          setSelectedWalletForAction(w);
                          setShowQrModal(true);
                        }}
                        onExplorer={(w) => {
                          const explorerUrls: Record<string, string> = {
                            'Ethereum': 'https://etherscan.io',
                            'Polygon': 'https://polygonscan.com',
                            'Arbitrum': 'https://arbiscan.io',
                            'Optimism': 'https://optimistic.etherscan.io',
                          };
                          const url = (explorerUrls[w.network] || 'https://etherscan.io') + `/address/${w.address}`;
                          window.open(url, '_blank');
                        }}
                        onSend={(w) => {
                          setSelectedWalletForAction(w);
                          setShowSendModal(true);
                        }}
                        onReceive={(w) => {
                          setSelectedWalletForAction(w);
                          setShowReceiveModal(true);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions & Network Status */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <QuickActions
                    onAddressBook={() => setActiveTab('addressbook')}
                    onSecurity={() => setActiveTab('security')}
                  />
                </div>
                <NetworkStatus gasPrice={gasPrice} />
              </div>
            </div>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="p-4 sm:p-6">
            <TransactionsTab 
              transactions={transactions}
              formatAddress={formatAddress}
              formatDate={formatDate}
            />
          </TabsContent>

          {/* Address Book Tab */}
          <TabsContent value="addressbook" className="p-4 sm:p-6">
            <AddressBookTab
              addressBook={addressBook}
              formatAddress={formatAddress}
              onAddAddress={handleAddAddress}
              onDeleteAddress={handleDeleteAddress}
            />
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="p-4 sm:p-6">
            <SecurityTab />

      {/* Send Modal */}
      {selectedWalletForAction && (
        <SendModal
          isOpen={showSendModal}
          onClose={() => {
            setShowSendModal(false);
            setSelectedWalletForAction(null);
          }}
          wallet={selectedWalletForAction}
          assetPrices={assetPrices}
          onSuccess={loadWalletData}
        />
      )}

      {/* Receive Modal */}
      {selectedWalletForAction && (
        <ReceiveModal
          isOpen={showReceiveModal}
          onClose={() => {
            setShowReceiveModal(false);
            setSelectedWalletForAction(null);
          }}
          wallet={selectedWalletForAction}
        />
      )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="p-4 sm:p-6">
            <SettingsTab wallets={connectedWallets} onUpdate={loadWalletData} onRemove={handleRemoveWallet} />
          </TabsContent>
        </Tabs>
      </GlassCard>

      {/* Connect Wallet Modal */}
      <ConnectWalletModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onConnect={handleConnectWallet}
        isConnecting={connecting}
      />

      {/* QR Code Modal */}
      {showQrModal && selectedWalletForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-dark-900 border border-dark-700 rounded-lg p-4 sm:p-6 md:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 gap-2">
              <h3 className="text-base sm:text-lg md:text-xl font-semibold truncate">Wallet QR Code</h3>
              <button
                onClick={() => {
                  setShowQrModal(false);
                  setSelectedWalletForAction(null);
                }}
                className="text-dark-400 hover:text-white transition-colors flex-shrink-0"
              >
                <X size={20} className="sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {/* Wallet Info */}
              <div className="bg-dark-800/50 rounded-lg p-3 sm:p-4 space-y-2 text-sm sm:text-base">
                <div>
                  <p className="text-xs sm:text-sm text-dark-400">Wallet Name</p>
                  <p className="font-semibold break-words">{selectedWalletForAction.name}</p>
                </div>
                
                <div>
                  <p className="text-xs sm:text-sm text-dark-400 mt-2">Address</p>
                  <p className="font-mono text-xs sm:text-sm break-all">{selectedWalletForAction.address}</p>
                </div>

                <div>
                  <p className="text-xs sm:text-sm text-dark-400 mt-2">Network</p>
                  <p className="font-semibold text-xs sm:text-sm">{selectedWalletForAction.network}</p>
                </div>
              </div>

              {/* QR Code */}
              <div className="flex justify-center bg-dark-800/50 rounded-lg p-3 sm:p-4 w-full">
                <div className="w-full max-w-xs">
                  <QRCodeWrapper
                    value={selectedWalletForAction.address}
                    size={Math.min(window.innerWidth - 80, 280)}
                    level="H"
                    includeMargin={true}
                    fgColor="#ffffff"
                    bgColor="#1a1a2e"
                  />
                </div>
              </div>

              {/* Copy Button */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedWalletForAction.address);
                  toast.success('Address copied to clipboard');
                }}
                className="w-full btn-primary text-sm sm:text-base py-2 sm:py-2.5"
              >
                Copy Address
              </button>

              {/* Close Button */}
              <button
                onClick={() => {
                  setShowQrModal(false);
                  setSelectedWalletForAction(null);
                }}
                className="w-full btn-secondary text-sm sm:text-base py-2 sm:py-2.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;