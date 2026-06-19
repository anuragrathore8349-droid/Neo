// FILE: src/pages/wallet/Wallet.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/common/Tabs';
import { WalletTransaction, AddressBookEntry } from '../../types/wallet';
import WalletHeader     from '../../components/wallet/WalletHeader';
import OverviewTab      from '../../components/wallet/tabs/OverviewTab';
import TransactionsTab  from '../../components/wallet/tabs/TransactionsTab';
import AddressBookTab   from '../../components/wallet/tabs/AddressBookTab';
import SecurityTab      from '../../components/wallet/tabs/SecurityTab';
import SettingsTab      from '../../components/wallet/tabs/SettingsTab';
import {
  connectWallet as connectWalletBackend,
  getWalletTransactions,
  getWallets,
  getGasPrices,
  WalletRecord,
  getAddressBook,
  addAddressToBook,
  deleteAddressFromBook,
} from '../../services/wallet.service';
import { AlertCircle, CheckCircle } from 'lucide-react';

const Wallet: React.FC = () => {
  const [activeTab,          setActiveTab]          = useState('overview');
  const [connectedWallets,   setConnectedWallets]   = useState<WalletRecord[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [addressBook,        setAddressBook]        = useState<AddressBookEntry[]>([]);
  const [gasPrice,           setGasPrice]           = useState({ slow: 15, medium: 25, fast: 40 });
  const [selectedGasPrice,   setSelectedGasPrice]   = useState('medium');
  const [isConnecting,       setIsConnecting]       = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [walletError,        setWalletError]        = useState<string | null>(null);
  const [walletSuccess,      setWalletSuccess]      = useState<string | null>(null);
  const [chainId,            setChainId]            = useState<string | null>(null);
  const [providerName,       setProviderName]       = useState<string | null>(null);
  const [addressBookError,   setAddressBookError]   = useState<string | null>(null);
  const [isAddingAddress,    setIsAddingAddress]    = useState(false);

  // ── Map raw server tx to WalletTransaction shape ──────────────────────
  const mapServerTransaction = (tx: any): WalletTransaction => ({
    id:        tx._id    || tx.id   || tx.hash || '',
    type:      tx.type === 'deposit'    ? 'receive'
             : tx.type === 'withdrawal' ? 'send'
             : tx.type === 'transfer'   ? 'transfer'
             : tx.type === 'send'       ? 'send'
             : tx.type === 'receive'    ? 'receive'
             : tx.type                  || 'transfer',
    hash:      tx.hash   || tx.txHash  || '',
    from:      tx.from   || tx.sourceAddress      || '',
    to:        tx.to     || tx.destinationAddress || '',
    amount:    tx.amount != null ? String(tx.amount) : tx.value != null ? String(tx.value) : '0',
    asset:     tx.asset  || tx.token || 'ETH',
    status:    tx.status === 'cancelled' ? 'failed' : (tx.status || 'pending'),
    timestamp: tx.timestamp  ? String(tx.timestamp)
             : tx.createdAt  ? String(tx.createdAt)
             : new Date().toISOString(),
    gasUsed:  tx.gasUsed  != null ? String(tx.gasUsed)  : undefined,
    gasPrice: tx.gasPrice != null ? String(tx.gasPrice) : undefined,
  });

  const loadWalletTransactions = async (walletId?: string) => {
    setIsLoadingTransactions(true);
    try {
      const response = await getWalletTransactions({ walletId, page: 1, limit: 50, type: 'all' });
      const txData   = response.data as { transactions: any[]; pagination: any };
      setWalletTransactions((txData?.transactions || []).map(mapServerTransaction));
    } catch (error: any) {
      console.error('Failed to load wallet transactions:', error?.message || error);
      // Non-critical error - wallet still connected
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const handleAddAddress = async (newAddress: Omit<AddressBookEntry, 'id'>) => {
    setIsAddingAddress(true);
    setAddressBookError(null);
    try {
      const response     = await addAddressToBook(newAddress);
      const savedAddress = response.data;
      setAddressBook(prev => [savedAddress, ...prev]);
    } catch (error: any) {
      setAddressBookError(error?.message || 'Failed to save address');
    } finally {
      setIsAddingAddress(false);
    }
  };

  // ✅ Wire delete
  const handleDeleteAddress = async (id: string) => {
    try {
      await deleteAddressFromBook(id);
      setAddressBook(prev => prev.filter(a => a.id !== id));
    } catch (error: any) {
      setAddressBookError(error?.message || 'Failed to delete address');
    }
  };

  // ── MetaMask event listeners ──────────────────────────────────────────
  useEffect(() => {
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setWalletError('Wallet disconnected');
        setChainId(null);
        setProviderName(null);
      }
    };
    const handleChainChanged = (id: string) => setChainId(id);

    const initChainId = async () => {
      const provider = getInjectedProvider();
      if (!provider) return;
      try {
        const bp = new ethers.BrowserProvider(provider);
        const id = await bp.send('eth_chainId', []);
        if (id) setChainId(id);
      } catch { /* silent */ }
    };

    const provider = getInjectedProvider();
    if (provider) {
      provider.on('accountsChanged', handleAccountsChanged);
      provider.on('chainChanged',    handleChainChanged);
      initChainId();
      return () => {
        provider.removeListener('accountsChanged', handleAccountsChanged);
        provider.removeListener('chainChanged',    handleChainChanged);
      };
    }
  }, []);

  // ── Load initial data ─────────────────────────────────────────────────
  const loadInitialData = useCallback(async () => {
    try {
      const [walletsRes, gasPricesRes, addressBookRes] = await Promise.allSettled([
        getWallets(),
        getGasPrices(),
        getAddressBook(),
      ]);

      if (walletsRes.status === 'fulfilled') {
        setConnectedWallets(walletsRes.value.data || []);
        await loadWalletTransactions();
      }
      if (gasPricesRes.status === 'fulfilled') {
        setGasPrice(gasPricesRes.value.data || { slow: 15, medium: 25, fast: 40 });
      }
      if (addressBookRes.status === 'fulfilled') {
        setAddressBook(addressBookRes.value.data || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);

  // ── Provider detection ────────────────────────────────────────────────
  const getInjectedProvider = () => {
    if (typeof window === 'undefined') return null;
    const w   = window as any;
    const inj = w.ethereum;
    if (!inj) return null;
    if (Array.isArray(inj.providers) && inj.providers.length > 0) {
      return inj.providers.find((p: any) => p.isMetaMask) || inj.providers[0];
    }
    return inj;
  };

  const getProviderDisplayName = (provider: any) => {
    if (!provider)                  return 'Ethereum Wallet';
    if (provider.isMetaMask)        return 'MetaMask';
    if (provider.isCoinbaseWallet)  return 'Coinbase Wallet';
    if (provider.isBraveWallet)     return 'Brave Wallet';
    if (provider.isFrame)           return 'Frame';
    if (provider.isTally)           return 'Tally';
    return provider.name || 'Ethereum Wallet';
  };

  // ── Connect wallet ────────────────────────────────────────────────────
  const connectWallet = async () => {
    setIsConnecting(true);
    setWalletError(null);
    setWalletSuccess(null);

    try {
      const provider = getInjectedProvider();
      if (!provider) throw new Error('No Ethereum wallet detected. Install MetaMask or another wallet extension.');

      const name = getProviderDisplayName(provider);
      setProviderName(name);

      const bp       = new ethers.BrowserProvider(provider);
      const accounts = await bp.send('eth_requestAccounts', []);
      const account  = Array.isArray(accounts) ? accounts[0] : accounts;
      if (!account)  throw new Error('Wallet connection was rejected or no account selected.');

      const normalizedAddress = ethers.getAddress(account);
      const messageToSign     = `Connect wallet ${normalizedAddress} to NeoFin`;
      const signer            = await bp.getSigner(account);
      const signature         = await signer.signMessage(messageToSign);
      const chainIdResult     = await bp.send('eth_chainId', []);
      setChainId(chainIdResult);

      const payload = {
        name,
        type:      'external' as const,
        provider:  name,
        address:   normalizedAddress,
        network:   chainIdResult || 'unknown',
        signature,
      };

      const response  = await connectWalletBackend(payload);
      const newWallet = response.data;

      setConnectedWallets(prev => {
        const exists = prev.some(w => w.address.toLowerCase() === newWallet.address.toLowerCase());
        return exists ? prev : [newWallet, ...prev];
      });

      // Load transactions for the newly connected wallet
      await loadWalletTransactions(newWallet._id);
      setWalletSuccess(`${name} connected successfully`);
      setTimeout(() => setWalletSuccess(null), 4000);
    } catch (error: any) {
      const msg =
        error?.code === 4001 ? 'Connection request rejected by user.' :
        error?.message       ? error.message :
        'Error connecting wallet.';
      setWalletError(msg);
    } finally {
      setIsConnecting(false);
    }
  };

  // ── Export CSV ────────────────────────────────────────────────────────
  const handleExportHistory = () => {
    if (!walletTransactions.length) return;
    const rows = [
      ['Type', 'Hash', 'From', 'To', 'Asset', 'Amount', 'Status', 'Date'],
      ...walletTransactions.map(tx => [
        tx.type, tx.hash, tx.from, tx.to, tx.asset,
        tx.amount, tx.status, new Date(tx.timestamp).toLocaleString(),
      ]),
    ];
    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'wallet-history.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const formatAddress = (address: string) =>
    address ? `${address.substring(0, 6)}…${address.substring(address.length - 4)}` : '—';

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="min-h-screen">
      <WalletHeader
        isConnecting={isConnecting}
        onConnect={connectWallet}
        onExport={walletTransactions.length > 0 ? handleExportHistory : undefined}
      />

      {walletError && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/50 p-4 text-sm text-red-100">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-400" />
          <div>
            <p className="font-semibold text-red-300 mb-0.5">Wallet connection error</p>
            <p className="text-red-200/80">{walletError}</p>
          </div>
          <button onClick={() => setWalletError(null)} className="ml-auto text-red-400 hover:text-red-200 flex-shrink-0">✕</button>
        </div>
      )}

      {walletSuccess && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-secondary/40 bg-secondary/10 p-4 text-sm text-secondary">
          <CheckCircle size={16} className="flex-shrink-0" />
          {walletSuccess}
        </div>
      )}

      {providerName && chainId && !walletError && (
        <div className="mb-4 rounded-xl border border-blue-600/40 bg-blue-950/40 p-3 text-sm text-blue-200">
          <span className="font-medium">{providerName}</span>
          <span className="text-blue-400"> · Chain ID {parseInt(chainId, 16)}</span>
        </div>
      )}

      {/* ✅ Controlled tabs so QuickActions can switch tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="flex w-max min-w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="addressbook">Address Book</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <OverviewTab
            connectedWallets={connectedWallets}
            transactions={walletTransactions}
            gasPrice={gasPrice}
            isConnecting={isConnecting}
            onConnect={connectWallet}
            formatAddress={formatAddress}
            formatDate={formatDate}
            refreshWalletData={loadInitialData}
            currentChainId={chainId}
            // ✅ Wire QuickActions tab switching
            onNavigateToTransactions={() => setActiveTab('transactions')}
            onNavigateToAddressBook={() => setActiveTab('addressbook')}
            onNavigateToSecurity={() => setActiveTab('security')}
          />
        </TabsContent>

        <TabsContent value="transactions">
          <TransactionsTab
            transactions={walletTransactions}
            formatAddress={formatAddress}
            formatDate={formatDate}
          />
        </TabsContent>

        <TabsContent value="addressbook">
          <AddressBookTab
            addressBook={addressBook}
            formatAddress={formatAddress}
            onAddAddress={handleAddAddress}
            onDeleteAddress={handleDeleteAddress}
            isAdding={isAddingAddress}
            error={addressBookError}
            onDismissError={() => setAddressBookError(null)}
          />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab
            gasPrice={gasPrice}
            selectedGasPrice={selectedGasPrice}
            onGasPriceChange={setSelectedGasPrice}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Wallet;