// client/src/components/wallet/ConnectWalletModal.tsx
import React, { useState } from 'react';
import { X, Wallet, Lock } from 'lucide-react';

interface ConnectWalletModalProps {
  isOpen:       boolean;
  onClose:      () => void;
  onConnect:    (name: string, type: 'external' | 'exchange' | 'defi') => Promise<void>;
  isConnecting: boolean;
}

const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({
  isOpen, onClose, onConnect, isConnecting,
}) => {
  const [walletName, setWalletName] = useState('');
  const [selectedType, setSelectedType] = useState<'external' | 'exchange' | 'defi'>('external');

  const wallets = [
    {
      type: 'external' as const,
      name: 'MetaMask',
      icon: '🦊',
      description: 'Connect your Ethereum wallet',
      status: 'Available',
    },
    {
      type: 'external' as const,
      name: 'WalletConnect',
      icon: '📱',
      description: 'Use any WalletConnect compatible wallet',
      status: 'Coming Soon',
      disabled: true,
    },
    {
      type: 'exchange' as const,
      name: 'Binance',
      icon: '🔶',
      description: 'Connect your Binance exchange account',
      status: 'Coming Soon',
      disabled: true,
    },
    {
      type: 'exchange' as const,
      name: 'Coinbase',
      icon: '💙',
      description: 'Connect your Coinbase exchange account',
      status: 'Coming Soon',
      disabled: true,
    },
  ];

  const handleConnect = async () => {
    if (!walletName.trim()) {
      alert('Please enter a wallet name');
      return;
    }
    await onConnect(walletName, selectedType);
    setWalletName('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-xl border border-dark-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-dark-900 border-b border-dark-700 p-4 sm:p-6 flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-white">Connect Wallet</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-800 rounded-lg text-dark-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Wallet Selection */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">Select a Wallet</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {wallets.map((w) => (
                <button
                  key={w.name}
                  onClick={() => {
                    if (!w.disabled) setSelectedType(w.type);
                  }}
                  disabled={w.disabled}
                  className={`p-4 rounded-lg border-2 text-left transition ${
                    selectedType === w.type && !w.disabled
                      ? 'border-primary bg-primary/10'
                      : 'border-dark-700 hover:border-dark-600 hover:bg-dark-800/50'
                  } ${w.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-3xl">{w.icon}</span>
                    {w.disabled && (
                      <span className="text-xs bg-dark-800 text-dark-400 px-2 py-1 rounded">
                        {w.status}
                      </span>
                    )}
                    {!w.disabled && selectedType === w.type && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-white">{w.name}</p>
                  <p className="text-sm text-dark-400 mt-1">{w.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Wallet Name Input */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              Wallet Name (optional)
            </label>
            <input
              type="text"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              placeholder="e.g., Main Wallet, Trading Account"
              className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-white placeholder-dark-500 focus:outline-none focus:border-primary"
              disabled={isConnecting}
            />
            <p className="text-xs text-dark-400 mt-1">
              Leave blank to use the default wallet name
            </p>
          </div>

          {/* Security Info */}
          <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-4">
            <div className="flex gap-3">
              <Lock size={20} className="text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white text-sm mb-1">Your keys, your coins</p>
                <p className="text-sm text-dark-400">
                  We never access your private keys. You'll be asked to sign a message to verify wallet ownership.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              disabled={isConnecting}
              className="flex-1 bg-dark-800 hover:bg-dark-700 text-white rounded-lg py-3 font-medium transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex-1 btn-primary py-3 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet size={18} />
                  Connect Wallet
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectWalletModal;
