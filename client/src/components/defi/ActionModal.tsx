import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface ActionModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  actionLabel?: string;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (amount?: string) => Promise<void>;
}

export const ActionModal: React.FC<ActionModalProps> = ({
  isOpen,
  title,
  description,
  inputLabel,
  inputPlaceholder,
  actionLabel = 'Confirm',
  isLoading = false,
  onClose,
  onConfirm
}) => {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setError('');
    if (inputLabel && !amount.trim()) {
      setError('Please enter an amount');
      return;
    }
    try {
      await onConfirm(amount);
      setAmount('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-gray-700"
      >
        <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
        {description && <p className="text-gray-400 text-sm mb-4">{description}</p>}

        {inputLabel && (
          <div className="mb-4">
            <label className="block text-gray-400 text-sm mb-2">{inputLabel}</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={inputPlaceholder}
              disabled={isLoading}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
        )}

        {error && <div className="mb-4 text-red-400 text-sm">{error}</div>}

        <div className="flex space-x-3">
          {inputLabel && (
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`${inputLabel ? 'flex-1' : 'w-full'} bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:bg-gray-600`}
          >
            {isLoading ? 'Processing...' : actionLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
