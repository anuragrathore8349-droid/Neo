import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';

interface StakingOpportunity {
  id: string;
  asset: string;
  apy: string;
  protocol: string;
  description: string;
  minAmount: string;
  tvl: string;
  icon?: string;
}

interface StakingModalProps {
  isOpen: boolean;
  opportunities: StakingOpportunity[];
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (protocolId: string, assetSymbol: string, amount: string) => void;
}

export const StakingModal: React.FC<StakingModalProps> = ({
  isOpen,
  opportunities,
  isLoading = false,
  onClose,
  onConfirm
}) => {
  const [selectedOpportunity, setSelectedOpportunity] = useState<string | null>(
    opportunities[0]?.id || null
  );
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const selected = opportunities.find(op => op.id === selectedOpportunity);

  const handleConfirm = () => {
    setError('');

    // Validate amount
    if (!amount.trim()) {
      setError('Please enter an amount');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Amount must be a positive number');
      return;
    }

    if (selected) {
      const minAmount = parseFloat(selected.minAmount);
      if (amountNum < minAmount) {
        setError(`Minimum staking amount is ${minAmount} ${selected.asset}`);
        return;
      }
    }

    // Map opportunity IDs to correct protocol/asset pairs
    const OPPORTUNITY_MAP: Record<string, { protocolId: string; assetSymbol: string }> = {
      'lido-eth':        { protocolId: 'lido',  assetSymbol: 'ETH'  },
      'aave-governance': { protocolId: 'aave',  assetSymbol: 'AAVE' },
      'curve-crv':       { protocolId: 'curve', assetSymbol: 'CRV'  }
    };

    const mapped = OPPORTUNITY_MAP[selected!.id] || {
      protocolId:  selected!.id.split('-')[0],
      assetSymbol: selected!.asset // use the opportunity's asset field directly
    };

    // DO NOT call onClose() here — parent opens WalletTxModal and closes this modal
    // only after onSuccess fires
    onConfirm(mapped.protocolId, mapped.assetSymbol, amount);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-dark-900 rounded-2xl w-full max-w-4xl border border-primary/20 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 border-b border-primary/20 px-6 py-5 sm:px-8 sm:py-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">Select Staking Opportunity</h2>
          <p className="text-gray-400 text-sm">Choose an asset and protocol to earn rewards</p>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[85vh] overflow-y-auto">
          {/* Opportunities Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {opportunities.map((opportunity) => (
              <motion.button
                key={opportunity.id}
                onClick={() => setSelectedOpportunity(opportunity.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selectedOpportunity === opportunity.id
                    ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                    : 'border-dark-700 bg-dark-800/50 hover:border-dark-600 hover:bg-dark-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-white text-base sm:text-lg">{opportunity.asset}</h3>
                  <span className="text-secondary font-bold text-sm sm:text-base">{opportunity.apy}</span>
                </div>
                <p className="text-gray-400 text-xs sm:text-sm mb-2">{opportunity.protocol}</p>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Min: {opportunity.minAmount} {opportunity.asset}</p>
                  <p className="truncate">TVL: {opportunity.tvl}</p>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Selected Opportunity Details */}
          {selected && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl p-4 sm:p-5 border border-primary/20 backdrop-blur-sm"
            >
              <h4 className="text-white font-semibold text-sm sm:text-base mb-2">
                {selected.protocol} - {selected.asset}
              </h4>
              <p className="text-gray-300 text-xs sm:text-sm mb-4 leading-relaxed">{selected.description}</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-primary/5 rounded-lg p-2 sm:p-3 border border-primary/10">
                  <p className="text-gray-400 text-xs truncate">Annual APY</p>
                  <p className="text-secondary font-bold text-sm sm:text-base mt-1">{selected.apy}</p>
                </div>
                <div className="bg-primary/5 rounded-lg p-2 sm:p-3 border border-primary/10">
                  <p className="text-gray-400 text-xs truncate">Min Amount</p>
                  <p className="text-primary font-bold text-sm sm:text-base mt-1">{selected.minAmount}</p>
                </div>
                <div className="bg-primary/5 rounded-lg p-2 sm:p-3 border border-primary/10">
                  <p className="text-gray-400 text-xs truncate">TVL</p>
                  <p className="text-secondary font-bold text-sm sm:text-base mt-1">{selected.tvl}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Amount Input */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2.5">
              Amount to Stake ({selected?.asset || 'Token'})
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Enter amount (min: ${selected?.minAmount || '0.01'})`}
              className="w-full bg-dark-800/50 border border-primary/20 rounded-lg px-4 py-3 sm:py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all text-sm sm:text-base"
            />
            {selected && (
              <p className="text-xs text-gray-400 mt-1.5">
                Minimum: {selected.minAmount} {selected.asset}
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 sm:p-4 bg-red-900/20 border border-red-700/30 rounded-lg text-red-200 text-xs sm:text-sm"
            >
              ⚠️ {error}
            </motion.div>
          )}

          {/* Estimated Earnings */}
          {amount && selected && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 sm:p-5 bg-secondary/10 border border-secondary/30 rounded-lg backdrop-blur-sm"
            >
              <p className="text-xs text-gray-400 mb-1">Estimated Annual Earnings:</p>
              <p className="text-lg sm:text-xl font-bold text-secondary">
                {((parseFloat(amount) * parseFloat(selected.apy.replace('%', ''))) / 100).toFixed(4)} {selected.asset}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                At {selected.apy} APY on {amount} {selected.asset}
              </p>
            </motion.div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="bg-dark-800/50 border-t border-primary/20 px-6 py-4 sm:px-8 sm:py-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-primary/20 text-gray-300 px-4 py-2.5 sm:py-3 rounded-lg font-medium hover:bg-dark-800 hover:border-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!amount}
            className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-white px-4 py-2.5 sm:py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            Stake {selected?.asset || 'Now'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
