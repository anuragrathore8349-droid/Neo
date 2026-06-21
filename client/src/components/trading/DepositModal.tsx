import React, { useState, useEffect } from 'react';
import { Copy, Check, AlertCircle, Loader } from 'lucide-react';
import Modal from '../common/Modal';
import * as walletService from '../../services/wallet.service';
import { Asset } from '../../types';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
}

interface Wallet {
  _id: string;
  name: string;
  address: string;
  network: string;
  type: string;
}

const NETWORKS = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
  { id: 'bsc', name: 'Binance Smart Chain', symbol: 'BSC' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC' },
  { id: 'solana', name: 'Solana', symbol: 'SOL' },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ARB' }
];

const DepositModal: React.FC<DepositModalProps> = ({ isOpen, onClose, assets }) => {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(assets[0] || null);
  const [selectedNetwork, setSelectedNetwork] = useState('ethereum');
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  // Load wallets on component mount
  const loadWallets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await walletService.getWallets();
      const walletList = response.data || [];
      setWallets(walletList);
      
      if (walletList.length > 0) {
        setSelectedWallet(walletList[0]._id);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError('Failed to load wallets. Please try again.');
      console.error('Error loading wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadWallets();
    }
  }, [isOpen]);

  // Fetch deposit address when asset, network, or wallet changes
  useEffect(() => {
    if (!isOpen || !selectedWallet || !selectedAsset || !selectedNetwork) {
      setDepositAddress(null);
      return;
    }

    const fetchDepositAddress = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await walletService.getDepositAddress({
          walletId: selectedWallet,
          asset: selectedAsset.symbol,
          network: selectedNetwork
        });
        
        if (response.data?.address) {
          setDepositAddress(response.data.address);
        } else {
          setError('Unable to fetch deposit address. Please try again.');
        }
      } catch (err: unknown) {
        const error = err as { message?: string };
        setError(error?.message || 'Failed to fetch deposit address. Please try again.');
        console.error('Error fetching deposit address:', error);
        setDepositAddress(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDepositAddress();
  }, [isOpen, selectedAsset, selectedNetwork, selectedWallet]);

  const handleCopyAddress = () => {
    if (depositAddress) {
      navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Deposit Funds" size="lg">
      <div className="space-y-6">
        {/* Asset Selection */}
        <div>
          <label className="block text-sm font-medium text-light mb-2">Select Asset</label>
          <select
            value={selectedAsset?.id || ''}
            onChange={(e) => {
              const asset = assets.find(a => a.id === e.target.value);
              if (asset) setSelectedAsset(asset);
            }}
            className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-light focus:outline-none focus:border-primary"
          >
            <option value="">Choose an asset...</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.symbol} - {asset.name}
              </option>
            ))}
          </select>
        </div>

        {/* Wallet Selection */}
        {wallets.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-light mb-2">Select Wallet</label>
            <select
              value={selectedWallet || ''}
              onChange={(e) => setSelectedWallet(e.target.value)}
              className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-light focus:outline-none focus:border-primary"
            >
              <option value="">Choose a wallet...</option>
              {wallets.map((wallet) => (
                <option key={wallet._id} value={wallet._id}>
                  {wallet.name} - {wallet.address.substring(0, 10)}...
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Network Selection */}
        <div>
          <label className="block text-sm font-medium text-light mb-3">Select Network</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {NETWORKS.map((network) => (
              <button
                key={network.id}
                onClick={() => setSelectedNetwork(network.id)}
                className={`px-4 py-2 rounded-lg border-2 transition-all font-medium text-sm ${
                  selectedNetwork === network.id
                    ? 'bg-primary border-primary text-white'
                    : 'bg-dark-800 border-dark-700 text-dark-400 hover:border-primary/50'
                }`}
              >
                <div>{network.symbol}</div>
                <div className="text-xs opacity-75">{network.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center gap-2 p-4">
            <Loader size={20} className="text-primary animate-spin" />
            <span className="text-dark-400">Fetching deposit address...</span>
          </div>
        )}

        {/* Deposit Address Display */}
        {depositAddress && !loading && (
          <div className="space-y-4">
            <div className="p-4 bg-dark-800 rounded-lg border border-dark-700">
              <p className="text-xs text-dark-400 mb-2">Deposit Address</p>
              <div className="flex items-center gap-3">
                <code className="flex-1 text-sm break-all font-mono text-light bg-dark-900 p-3 rounded border border-dark-600">
                  {depositAddress}
                </code>
                <button
                  onClick={handleCopyAddress}
                  className="p-2 hover:bg-dark-700 rounded transition-colors flex-shrink-0"
                  title="Copy address"
                >
                  {copied ? (
                    <Check size={18} className="text-secondary" />
                  ) : (
                    <Copy size={18} className="text-light" />
                  )}
                </button>
              </div>
            </div>

            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <div className="flex gap-2">
                <AlertCircle size={20} className="text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm text-primary">
                  <p className="font-medium mb-1">Important:</p>
                  <ul className="text-xs space-y-1 opacity-90">
                    <li>• Only send {selectedAsset?.symbol} to this address</li>
                    <li>• Only use {selectedNetwork} network</li>
                    <li>• Double-check the address before sending</li>
                    <li>• Minimum deposit may apply</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Approximate Time */}
            <div className="text-xs text-dark-400 text-center">
              Deposits typically arrive within 5-30 minutes depending on network congestion
            </div>
          </div>
        )}

        {/* No Wallet Message */}
        {wallets.length === 0 && !loading && (
          <div className="text-center py-6">
            <AlertCircle size={32} className="mx-auto text-dark-400 mb-2" />
            <p className="text-dark-400">No wallets connected</p>
            <p className="text-xs text-dark-500 mt-1">
              Please connect a wallet first from the Wallet section
            </p>
          </div>
        )}

        {/* Close Button */}
        <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-dark-800 text-light hover:bg-dark-700 transition-colors font-medium"
          >
            Close
          </button>
          {depositAddress && (
            <button
              onClick={() => {
                handleCopyAddress();
                setTimeout(onClose, 500);
              }}
              className="px-6 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-medium"
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
