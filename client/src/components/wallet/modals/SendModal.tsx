// client/src/components/wallet/modals/SendModal.tsx
import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { ethers } from 'ethers';
import { getTransactionStatus } from '../../../services/wallet.service';

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: {
    _id: string;
    name: string;
    address: string;
    network: string;
    balances?: Array<{ symbol: string; amount: number }>;
  };
  assetPrices?: Record<string, number>;
  onSuccess?: () => void;
}

const SendModal: React.FC<SendModalProps> = ({ isOpen, onClose, wallet, assetPrices = {}, onSuccess }) => {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('');
  const [gasPrice, setGasPrice] = useState('medium');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'submitted' | 'confirmed'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleSend = async () => {
    setError(null);
    if (!recipientAddress.trim() || !amount) {
      setError('Please fill in recipient address and amount');
      return;
    }

    if (!ethers.isAddress(recipientAddress)) {
      setError('Invalid Ethereum address');
      return;
    }

    if (Number(amount) <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    setStatus('pending');
    setTxHash(null);

    try {
      if (!window.ethereum) throw new Error('MetaMask not detected');

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();

      if (signerAddress.toLowerCase() !== wallet.address.toLowerCase()) {
        throw new Error('Connected wallet does not match this wallet');
      }

      // Get fee data for gas pricing
      const feeData = await provider.getFeeData();
      let maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('50', 'gwei');
      let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei');

      if (gasPrice === 'slow') {
        maxFeePerGas = (maxFeePerGas * 50n) / 100n;
        maxPriorityFeePerGas = (maxPriorityFeePerGas * 50n) / 100n;
      } else if (gasPrice === 'fast') {
        maxFeePerGas = (maxFeePerGas * 150n) / 100n;
        maxPriorityFeePerGas = (maxPriorityFeePerGas * 150n) / 100n;
      }

      const txData = {
        to: recipientAddress,
        value: ethers.parseEther(amount),
        maxFeePerGas,
        maxPriorityFeePerGas,
      };

      const gasEstimate = await provider.estimateGas(txData);
      txData.gasLimit = gasEstimate;

      const tx = await signer.sendTransaction(txData);
      setTxHash(tx.hash);
      setStatus('submitted');
      toast.info(`Transaction submitted! Hash: ${tx.hash}`);

      // Save to wallet service
      const response = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: wallet._id,
          asset: selectedAsset || 'ETH',
          amount: Number(amount),
          destinationAddress: recipientAddress,
          network: wallet.network,
          signedTx: tx.hash,
        }),
      });

      if (!response.ok) throw new Error('Failed to save transaction record');

      // Poll Etherscan for confirmation (max 60s)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const receipt = await getTransactionStatus(tx.hash, wallet.network);
          if (receipt?.confirmed) {
            setStatus('confirmed');
            clearInterval(poll);
            toast.success('Transaction confirmed!');
            setRecipientAddress('');
            setAmount('');
            setGasPrice('medium');
            setTimeout(() => onClose(), 2000);
            onSuccess?.();
          }
        } catch {
          // Keep polling
        }
        if (attempts >= 12) {
          // 60s timeout (12 * 5s)
          setStatus('submitted');
          clearInterval(poll);
          toast.warning('Transaction submitted. Check explorer for confirmation.');
        }
      }, 5000);
    } catch (err: any) {
      const msg = err?.message || err?.reason || 'Failed to send transaction';
      setError(msg);
      setStatus('idle');
      toast.error(msg);
    }
  };

  if (!isOpen) return null;

  const selectedBalance = wallet.balances?.find(b => b.symbol === selectedAsset);
  const estimatedUsd = selectedBalance ? (Number(amount) || 0) * (assetPrices[selectedAsset] || 0) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-xl border border-dark-700 max-w-md w-full">
        {/* Header */}
        <div className="border-b border-dark-700 p-4 sm:p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Send Crypto</h2>
          <button
            onClick={onClose}
            disabled={status !== 'idle'}
            className="p-2 hover:bg-dark-800 rounded-lg text-dark-400 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex gap-3">
              <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Asset Selection */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Asset</label>
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
              disabled={status !== 'idle'}
            >
              <option value="">Select asset</option>
              {wallet.balances?.map(b => (
                <option key={b.symbol} value={b.symbol}>
                  {b.symbol} - {b.amount.toFixed(6)}
                </option>
              ))}
            </select>
            {selectedBalance && (
              <p className="text-xs text-dark-400 mt-1">
                Available: {selectedBalance.amount.toFixed(6)} {selectedAsset}
              </p>
            )}
          </div>

          {/* Recipient Address */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Recipient Address</label>
            <input
              type="text"
              placeholder="0x..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-white placeholder-dark-500 focus:outline-none focus:border-primary"
              disabled={status !== 'idle'}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Amount</label>
            <input
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.0001"
              className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-white placeholder-dark-500 focus:outline-none focus:border-primary"
              disabled={status !== 'idle' || !selectedAsset}
            />
            {estimatedUsd > 0 && (
              <p className="text-xs text-dark-400 mt-1">
                ≈ ${estimatedUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
            )}
          </div>

          {/* Gas Price Selection */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Gas Price</label>
            <select
              value={gasPrice}
              onChange={(e) => setGasPrice(e.target.value)}
              className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
              disabled={status !== 'idle'}
            >
              <option value="slow">Slow (~5 min)</option>
              <option value="medium">Medium (~3 min)</option>
              <option value="fast">Fast (~1 min)</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              disabled={status !== 'idle'}
              className="flex-1 bg-dark-800 hover:bg-dark-700 text-white rounded-lg py-2.5 font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={status !== 'idle' || !selectedAsset || !recipientAddress || !amount}
              className="flex-1 btn-primary py-2.5 font-medium disabled:opacity-50"
            >
              {status === 'pending' && 'Preparing...'}
              {status === 'submitted' && 'Confirming...'}
              {status === 'confirmed' && 'Confirmed!'}
              {status === 'idle' && 'Send'}
            </button>
          </div>

          {/* Transaction Status */}
          {txHash && (
            <div className="text-xs text-center text-dark-400 p-2 bg-dark-800/50 rounded">
              <p className="mb-1">TX Hash: {txHash.slice(0, 12)}...{txHash.slice(-10)}</p>
              <p>Status: {status === 'confirmed' ? '✓ Confirmed' : status === 'submitted' ? 'Polling for confirmation...' : 'Pending'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SendModal;
