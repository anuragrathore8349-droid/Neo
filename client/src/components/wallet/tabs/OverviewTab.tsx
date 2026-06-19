// FILE: src/components/wallet/tabs/OverviewTab.tsx
import React, { useState, useEffect } from 'react';
import {
  WalletIcon, Copy, QrCode, ExternalLink,
  ArrowUpRight, ArrowDownRight, RefreshCw, X, AlertCircle,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { WalletTransaction } from '../../../types/wallet';
import GlassCard       from '../../common/GlassCard';
import NetworkStatus   from '../NetworkStatus';
import QuickActions    from '../QuickActions';
import { getDepositAddress, withdrawFunds } from '../../../services/wallet.service';
import { getNetworkName, CHAIN_ID_TO_NETWORK } from '../../../utils/network';

interface ConnectedWallet {
  _id: string; name: string;
  type: 'exchange' | 'defi' | 'external';
  provider: string; address: string; network: string; isVerified: boolean;
  balances?: { assetId?: string; symbol: string; amount: number }[];
}

interface OverviewTabProps {
  connectedWallets:           ConnectedWallet[];
  transactions:               WalletTransaction[];
  gasPrice:                   { slow: number; medium: number; fast: number };
  isConnecting:               boolean;
  onConnect:                  () => void;
  formatAddress:              (address: string) => string;
  formatDate:                 (date: string)    => string;
  refreshWalletData?:         () => Promise<void>;
  currentChainId?:            string | null;
  // ✅ Navigation callbacks from Wallet.tsx
  onNavigateToTransactions?:  () => void;
  onNavigateToAddressBook?:   () => void;
  onNavigateToSecurity?:      () => void;
}

type SendForm = { asset: string; amount: string; destinationAddress: string; network: string };

const getExplorerUrl = (network: string, address: string) => {
  const key = (network || '').toLowerCase();
  if (key.includes('polygon'))  return `https://polygonscan.com/address/${address}`;
  if (key.includes('bsc') || key.includes('binance')) return `https://bscscan.com/address/${address}`;
  if (key.includes('optimism')) return `https://optimistic.etherscan.io/address/${address}`;
  if (key.includes('arbitrum')) return `https://arbiscan.io/address/${address}`;
  return `https://etherscan.io/address/${address}`;
};

const OverviewTab: React.FC<OverviewTabProps> = ({
  connectedWallets, transactions, gasPrice,
  isConnecting, onConnect, formatAddress, formatDate,
  refreshWalletData, currentChainId,
  onNavigateToTransactions, onNavigateToAddressBook, onNavigateToSecurity,
}) => {
  const networkOptions = Object.values(CHAIN_ID_TO_NETWORK || {});

  const [activeWallet,      setActiveWallet]      = useState<ConnectedWallet | null>(null);
  const [qrValue,           setQrValue]           = useState<string | null>(null);
  const [showQrModal,       setShowQrModal]       = useState(false);
  const [showSendModal,     setShowSendModal]     = useState(false);
  const [showReceiveModal,  setShowReceiveModal]  = useState(false);
  const [depositAddress,    setDepositAddress]    = useState<string | null>(null);
  const [isFetchingDeposit, setIsFetchingDeposit]= useState(false);
  const [isSending,         setIsSending]         = useState(false);
  const [sendForm,          setSendForm]          = useState<SendForm>({
    asset: 'ETH', amount: '', destinationAddress: '', network: 'Ethereum',
  });

  const getEffectiveNetwork = (w: ConnectedWallet) =>
    w.type === 'external' && currentChainId ? getNetworkName(currentChainId) : w.network;

  const copyText = async (text: string, label = 'Address') => {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copied`); }
    catch { toast.error(`Unable to copy ${label}`); }
  };

  const handleShowQr = (w: ConnectedWallet) => { setQrValue(w.address); setShowQrModal(true); };
  const handleOpenExplorer = (w: ConnectedWallet) => {
    window.open(getExplorerUrl(w.network, w.address), '_blank');
  };

  const handleSendClick = (w: ConnectedWallet) => {
    setActiveWallet(w);
    setSendForm({
      asset: w.balances?.[0]?.symbol || 'ETH',
      amount: '',
      destinationAddress: '',
      network: getEffectiveNetwork(w) || 'Ethereum',
    });
    setShowSendModal(true);
  };

  useEffect(() => {
    if (showSendModal && activeWallet?.type === 'external' && currentChainId) {
      setSendForm(p => ({ ...p, network: getNetworkName(currentChainId) }));
    }
  }, [currentChainId, activeWallet, showSendModal]);

  const handleReceiveClick = async (w: ConnectedWallet) => {
    setActiveWallet(w);
    setShowReceiveModal(true);
    setDepositAddress(null);
    setIsFetchingDeposit(true);
    try {
      const response = await getDepositAddress({
        walletId: w._id,
        asset:    w.balances?.[0]?.symbol || 'ETH',
        network:  getEffectiveNetwork(w) || 'Ethereum',
      });
      const addr = response.data?.address || '';
      if (!addr) throw new Error('No deposit address returned from server');
      setDepositAddress(addr);
    } catch (error: any) {
      toast.error(error?.message || 'Could not fetch deposit address');
      setShowReceiveModal(false);
    } finally { setIsFetchingDeposit(false); }
  };

  const handleSendSubmit = async () => {
    if (!activeWallet) return;
    const amount = Number(sendForm.amount);
    if (!sendForm.destinationAddress.trim() || amount <= 0) {
      toast.error('Enter a destination address and amount'); return;
    }
    setIsSending(true);
    try {
      if (activeWallet.type === 'external') {
        if (!window.ethereum) throw new Error('No Ethereum wallet detected');
        const provider      = new ethers.BrowserProvider(window.ethereum);
        const signer        = await provider.getSigner();
        const signerAddress = await signer.getAddress();
        if (signerAddress.toLowerCase() !== activeWallet.address.toLowerCase())
          throw new Error('Wallet address mismatch');
        const balance   = await provider.getBalance(signerAddress);
        const amountWei = ethers.parseEther(sendForm.amount);
        const txReq     = { to: sendForm.destinationAddress.trim(), value: amountWei };
        const gasLimit  = await provider.estimateGas(txReq);
        const feeData   = await provider.getFeeData();
        const totalCost = amountWei + gasLimit * (feeData.gasPrice ?? 0n);
        if (balance < totalCost) throw new Error(`Insufficient funds. Need ${ethers.formatEther(totalCost)} ETH`);
        const tx = await signer.sendTransaction(txReq);
        await tx.wait();
        await withdrawFunds({
          walletId:           activeWallet._id,
          asset:              sendForm.asset,
          amount,
          destinationAddress: sendForm.destinationAddress.trim(),
          network:            sendForm.network || activeWallet.network,
          signedTx:           tx.hash,
        });
        toast.success('Transaction sent successfully');
      } else {
        await withdrawFunds({
          walletId:           activeWallet._id,
          asset:              sendForm.asset,
          amount,
          destinationAddress: sendForm.destinationAddress.trim(),
          network:            sendForm.network || activeWallet.network,
        });
        toast.success('Send request submitted');
      }
      setShowSendModal(false);
      setActiveWallet(null);
      setSendForm({ asset: 'ETH', amount: '', destinationAddress: '', network: 'Ethereum' });
      refreshWalletData?.();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send transaction');
    } finally { setIsSending(false); }
  };

  return (
    <div className="pt-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Connected wallets */}
          <GlassCard className="p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold mb-4">Connected Wallets</h3>
            {connectedWallets.length === 0 ? (
              <div className="text-center py-10">
                <WalletIcon size={44} className="mx-auto mb-3 text-dark-400" />
                <p className="text-lg font-medium mb-1">No Wallets Connected</p>
                <p className="text-dark-400 text-sm mb-5">Connect your wallet to manage assets</p>
                <button className="btn-primary" onClick={onConnect} disabled={isConnecting}>
                  {isConnecting ? 'Connecting…' : 'Connect Wallet'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {connectedWallets.map(wallet => (
                  <div key={wallet._id} className="bg-dark-800/50 rounded-xl p-4 border border-dark-700">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center min-w-0">
                        <div className="bg-primary/20 p-2 rounded-lg mr-3 flex-shrink-0">
                          <WalletIcon size={18} className="text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{wallet.name || wallet.provider}</p>
                          <p className="text-dark-400 text-xs font-mono truncate">{formatAddress(wallet.address)}</p>
                          {wallet.isVerified && <span className="text-xs text-secondary">✓ Verified</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => copyText(wallet.address, 'Wallet address')}
                          className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-light" title="Copy">
                          <Copy size={14}/>
                        </button>
                        <button onClick={() => handleShowQr(wallet)}
                          className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-light" title="QR">
                          <QrCode size={14}/>
                        </button>
                        <button onClick={() => handleOpenExplorer(wallet)}
                          className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-light" title="Explorer">
                          <ExternalLink size={14}/>
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-dark-400 text-xs">Provider</p>
                        <p className="font-medium truncate">{wallet.provider}</p>
                        <p className="text-dark-500 text-xs capitalize">{wallet.type}</p>
                      </div>
                      <div>
                        <p className="text-dark-400 text-xs">Network</p>
                        <p className="font-medium truncate">
                          {wallet.type === 'external' && currentChainId
                            ? getNetworkName(currentChainId)
                            : wallet.network}
                        </p>
                        <p className="text-secondary text-xs">Connected</p>
                      </div>
                      <div>
                        <p className="text-dark-400 text-xs">Balance</p>
                        <p className="font-medium text-xs leading-snug">
                          {wallet.balances?.length
                            ? `${wallet.balances[0].amount.toFixed(6)} ${wallet.balances[0].symbol}`
                            : '—'}
                        </p>
                        {wallet.balances && wallet.balances.length > 1 && (
                          <p className="text-dark-500 text-xs">+{wallet.balances.length - 1} more</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button className="btn-primary flex-1 py-1.5 text-sm" onClick={() => handleSendClick(wallet)}>Send</button>
                      <button className="btn-outline flex-1 py-1.5 text-sm" onClick={() => handleReceiveClick(wallet)}>Receive</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Recent activity */}
          <GlassCard className="p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold mb-4">Recent Activity</h3>
            {transactions.length === 0 ? (
              <p className="text-center text-dark-400 text-sm py-8">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {transactions.slice(0, 5).map(tx => (
                  <div key={tx.id} className="bg-dark-800/50 rounded-xl p-3 hover:bg-dark-800 transition-all">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${
                          tx.type === 'send'    ? 'bg-red-500/20'   :
                          tx.type === 'receive' ? 'bg-secondary/20' : 'bg-primary/20'
                        }`}>
                          {tx.type === 'send'    ? <ArrowUpRight   size={14} className="text-red-500"   /> :
                           tx.type === 'receive' ? <ArrowDownRight size={14} className="text-secondary" /> :
                                                   <RefreshCw      size={14} className="text-primary"   />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium capitalize text-sm">{tx.type}</p>
                          <p className="text-dark-400 text-xs">{formatDate(tx.timestamp)}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-medium text-sm">{tx.amount} {tx.asset}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          tx.status === 'completed' ? 'bg-secondary/20 text-secondary' :
                          tx.status === 'pending'   ? 'bg-amber-500/20 text-amber-500' :
                                                      'bg-red-500/20 text-red-500'
                        }`}>{tx.status}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dark-400">
                      {tx.from && (
                        <div className="flex items-center gap-1">
                          <span>From:</span>
                          <span className="font-medium text-light">{formatAddress(tx.from)}</span>
                          <button onClick={() => copyText(tx.from, 'From address')} className="hover:text-light"><Copy size={10}/></button>
                        </div>
                      )}
                      {tx.to && (
                        <div className="flex items-center gap-1">
                          <span>To:</span>
                          <span className="font-medium text-light">{formatAddress(tx.to)}</span>
                          <button onClick={() => copyText(tx.to, 'To address')} className="hover:text-light"><Copy size={10}/></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* ✅ Fixed: was a dead button — now navigates to transactions tab */}
            <button
              className="w-full mt-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-all"
              onClick={onNavigateToTransactions}
            >
              View All Transactions
            </button>
          </GlassCard>
        </div>

        {/* Right: network status + quick actions */}
        <div className="space-y-4">
          <NetworkStatus gasPrice={gasPrice} />
          {/* ✅ Fixed: QuickActions now gets real navigation callbacks */}
          <QuickActions
            onSwap={undefined}
            onAddressBook={onNavigateToAddressBook}
            onSecurity={onNavigateToSecurity}
          />
        </div>
      </div>

      {/* QR Modal */}
      {showQrModal && qrValue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-sm rounded-2xl bg-dark-900 border border-dark-700 p-5">
            <button className="absolute right-3 top-3 p-1.5 rounded-full hover:bg-dark-700 text-dark-400"
              onClick={() => setShowQrModal(false)}><X size={16}/></button>
            <h3 className="text-lg font-semibold mb-3">Wallet QR Code</h3>
            <div className="flex justify-center mb-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrValue)}`}
                alt="Wallet QR" className="rounded-xl bg-white p-2"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs text-dark-300 flex-1">{qrValue}</p>
              <button className="btn-primary text-sm px-3 py-1.5 flex-shrink-0"
                onClick={() => copyText(qrValue, 'QR wallet address')}>Copy</button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && activeWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-dark-900 border border-dark-700 p-5">
            <button className="absolute right-3 top-3 p-1.5 rounded-full hover:bg-dark-700 text-dark-400"
              onClick={() => setShowReceiveModal(false)}><X size={16}/></button>
            <h3 className="text-lg font-semibold mb-1">Receive Funds</h3>
            <p className="text-dark-400 text-sm mb-4">{activeWallet.provider} · {getEffectiveNetwork(activeWallet)}</p>
            {isFetchingDeposit ? (
              <div className="rounded-xl border border-dark-700 bg-dark-800 p-6 text-center text-dark-400 text-sm">
                Loading deposit information…
              </div>
            ) : depositAddress ? (
              <div className="rounded-xl border border-dark-700 bg-dark-800 p-4 space-y-3">
                <div>
                  <p className="text-xs text-dark-400 mb-1">Asset</p>
                  <p className="font-semibold">{activeWallet.balances?.[0]?.symbol || 'ETH'}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-400 mb-1">Deposit Address</p>
                  <p className="break-all font-mono text-sm text-light">{depositAddress}</p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button className="btn-primary text-sm px-3 py-1.5"
                    onClick={() => copyText(depositAddress, 'Deposit address')}>Copy Address</button>
                  <button className="btn-outline text-sm px-3 py-1.5"
                    onClick={() => { setQrValue(depositAddress); setShowQrModal(true); }}>Show QR</button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dark-700 bg-dark-800 p-6 text-center text-dark-400 text-sm flex items-center justify-center gap-2">
                <AlertCircle size={16}/> Unable to load deposit details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Send Modal */}
      {showSendModal && activeWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-dark-900 border border-dark-700 p-5">
            <button className="absolute right-3 top-3 p-1.5 rounded-full hover:bg-dark-700 text-dark-400"
              onClick={() => setShowSendModal(false)}><X size={16}/></button>
            <h3 className="text-lg font-semibold mb-1">Send Funds</h3>
            <p className="text-dark-400 text-sm mb-4">{activeWallet.provider} · {getEffectiveNetwork(activeWallet)}</p>
            <div className="space-y-3">
              {/* Asset selector — shows all balances */}
              <div>
                <label className="block text-xs text-dark-400 mb-1">Asset</label>
                <select
                  className="w-full rounded-lg border border-dark-700 bg-dark-800 p-2.5 text-sm text-light"
                  value={sendForm.asset}
                  onChange={e => setSendForm(p => ({ ...p, asset: e.target.value }))}
                >
                  {(activeWallet.balances?.length ? activeWallet.balances : [{ symbol: 'ETH', amount: 0 }]).map(b => (
                    <option key={b.symbol} value={b.symbol}>{b.symbol} ({b.amount.toFixed(6)})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-dark-400 mb-1">Amount</label>
                <input className="w-full rounded-lg border border-dark-700 bg-dark-800 p-2.5 text-sm text-light"
                  placeholder="0.01" value={sendForm.amount}
                  onChange={e => setSendForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-dark-400 mb-1">Destination Address</label>
                <input className="w-full rounded-lg border border-dark-700 bg-dark-800 p-2.5 text-sm text-light font-mono"
                  placeholder="0x…" value={sendForm.destinationAddress}
                  onChange={e => setSendForm(p => ({ ...p, destinationAddress: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-dark-400 mb-1">Network</label>
                <select className="w-full rounded-lg border border-dark-700 bg-dark-800 p-2.5 text-sm text-light"
                  value={sendForm.network} onChange={e => setSendForm(p => ({ ...p, network: e.target.value }))}>
                  {(networkOptions.length > 0 ? networkOptions : ['Ethereum','Polygon','Arbitrum','Optimism','Base']).map((n: any) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button className="btn-outline text-sm px-4 py-2" onClick={() => setShowSendModal(false)}>Cancel</button>
                <button className="btn-primary text-sm px-4 py-2" onClick={handleSendSubmit} disabled={isSending}>
                  {isSending ? 'Sending…' : 'Confirm Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewTab;