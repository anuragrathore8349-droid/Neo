import React, { useState, useEffect } from 'react';
import { Copy, Check, AlertCircle, Loader, Wallet } from 'lucide-react';
import Modal from '../common/Modal';
import * as walletService from '../../services/wallet.service';
import { Asset } from '../../types';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
}

interface WalletItem {
  _id: string;
  name: string;
  address: string;
  network: string;
  type: string;
}

const NETWORKS = [
  { id: 'ethereum', name: 'Ethereum',    symbol: 'ETH',  color: '#627EEA' },
  { id: 'bsc',      name: 'BNB Chain',   symbol: 'BNB',  color: '#F3BA2F' },
  { id: 'polygon',  name: 'Polygon',     symbol: 'POL',  color: '#8247E5' },
  { id: 'solana',   name: 'Solana',      symbol: 'SOL',  color: '#14F195' },
  { id: 'arbitrum', name: 'Arbitrum',    symbol: 'ARB',  color: '#2D374B' },
  { id: 'base',     name: 'Base',        symbol: 'BASE', color: '#0052FF' },
];

const DepositModal: React.FC<DepositModalProps> = ({ isOpen, onClose, assets }) => {
  const [selectedAsset,   setSelectedAsset]   = useState<Asset | null>(assets[0] || null);
  const [selectedNetwork, setSelectedNetwork] = useState('ethereum');
  const [depositAddress,  setDepositAddress]  = useState<string | null>(null);
  const [wallets,         setWallets]         = useState<WalletItem[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [copied,          setCopied]          = useState(false);
  const [selectedWallet,  setSelectedWallet]  = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        setLoading(true); setError(null);
        const res  = await walletService.getWallets();
        const list = res.data || [];
        setWallets(list);
        if (list.length) setSelectedWallet(list[0]._id);
      } catch { setError('Failed to load wallets.'); }
      finally  { setLoading(false); }
    })();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedWallet || !selectedAsset || !selectedNetwork) {
      setDepositAddress(null); return;
    }
    (async () => {
      try {
        setLoading(true); setError(null);
        const res = await walletService.getDepositAddress({
          walletId: selectedWallet,
          asset:    selectedAsset.symbol,
          network:  selectedNetwork,
        });
        if (res.data?.address) setDepositAddress(res.data.address);
        else setError('Unable to fetch deposit address.');
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch deposit address.');
        setDepositAddress(null);
      } finally { setLoading(false); }
    })();
  }, [isOpen, selectedAsset, selectedNetwork, selectedWallet]);

  const copy = () => {
    if (!depositAddress) return;
    navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const net = NETWORKS.find(n => n.id === selectedNetwork);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Deposit Funds" size="lg">
      <div className="space-y-5">

        {/* ── Asset Selection ── */}
        <div>
          <label className="block text-sm font-medium text-light mb-2">Select Asset</label>
          <select
            value={selectedAsset?.id || ''}
            onChange={e => {
              const a = assets.find(x => x.id === e.target.value);
              if (a) setSelectedAsset(a);
            }}
            className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-light focus:outline-none focus:border-primary transition-colors text-sm"
          >
            <option value="">Choose an asset…</option>
            {assets.map(a => (
              <option key={a.id} value={a.id}>{a.symbol} — {a.name}</option>
            ))}
          </select>
        </div>

        {/* ── Wallet Selection ── */}
        {wallets.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-light mb-2">
              <Wallet size={14} className="inline mr-1" />Select Wallet
            </label>
            <select
              value={selectedWallet || ''}
              onChange={e => setSelectedWallet(e.target.value)}
              className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-light focus:outline-none focus:border-primary transition-colors text-sm"
            >
              {wallets.map(w => (
                <option key={w._id} value={w._id}>
                  {w.name} — {w.address.slice(0, 12)}…
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── Network Selection ── */}
        <div>
          <label className="block text-sm font-medium text-light mb-3">Select Network</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {NETWORKS.map(n => (
              <button
                key={n.id}
                onClick={() => setSelectedNetwork(n.id)}
                className={`flex flex-col items-center px-3 py-3 rounded-xl border-2 transition-all text-center ${
                  selectedNetwork === n.id
                    ? 'border-primary bg-primary/10 text-white'
                    : 'border-dark-700 bg-dark-800 text-dark-400 hover:border-dark-500'
                }`}
              >
                <span className="font-bold text-sm">{n.symbol}</span>
                <span className="text-xs mt-0.5 opacity-70 leading-tight">{n.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader size={20} className="text-primary animate-spin" />
            <span className="text-dark-400 text-sm">Fetching address…</span>
          </div>
        )}

        {/* ── Address Display ── */}
        {depositAddress && !loading && (
          <div className="space-y-3">
            <div className="p-4 bg-dark-800 rounded-xl border border-dark-700">
              <p className="text-xs text-dark-400 mb-2 uppercase tracking-wider">Deposit Address ({net?.name})</p>
              <div className="flex items-start gap-2">
                <code className="flex-1 text-xs sm:text-sm break-all font-mono text-light bg-dark-900 p-3 rounded-lg border border-dark-600 leading-relaxed">
                  {depositAddress}
                </code>
                <button
                  onClick={copy}
                  className="p-2.5 rounded-lg bg-dark-700 hover:bg-dark-600 transition-colors flex-shrink-0"
                  title="Copy address"
                >
                  {copied
                    ? <Check size={16} className="text-secondary" />
                    : <Copy size={16} className="text-light" />}
                </button>
              </div>
              {copied && (
                <p className="text-xs text-secondary mt-2 flex items-center gap-1">
                  <Check size={11} /> Address copied to clipboard
                </p>
              )}
            </div>

            <div className="p-4 bg-primary/8 border border-primary/25 rounded-xl">
              <div className="flex gap-2">
                <AlertCircle size={18} className="text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm text-primary">
                  <p className="font-semibold mb-1">Important</p>
                  <ul className="text-xs space-y-1 text-primary/80">
                    <li>• Only send <strong>{selectedAsset?.symbol}</strong> to this address</li>
                    <li>• Only use the <strong>{net?.name}</strong> network</li>
                    <li>• Double-check the address before sending</li>
                    <li>• Deposits arrive within 5–30 min depending on congestion</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── No Wallets ── */}
        {!loading && wallets.length === 0 && (
          <div className="text-center py-8">
            <Wallet size={32} className="mx-auto text-dark-500 mb-3" />
            <p className="text-dark-400 font-medium">No wallets connected</p>
            <p className="text-xs text-dark-500 mt-1">Connect a wallet from the Wallet section first</p>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-dark-700">
          <button
            onClick={onClose}
            className="order-2 sm:order-1 px-5 py-2.5 rounded-xl bg-dark-800 text-light hover:bg-dark-700 transition-colors font-medium text-sm"
          >
            Close
          </button>
          {depositAddress && (
            <button
              onClick={() => { copy(); setTimeout(onClose, 600); }}
              className="order-1 sm:order-2 px-5 py-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors font-medium text-sm"
            >
              Copy & Close
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default DepositModal;