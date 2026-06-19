// FILE: src/components/defi/WalletTxModal.tsx
// REPLACE ENTIRE FILE

import React, { useState } from 'react';
import { BrowserProvider } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import defiService from '../../services/defi.service';

type Step = 'idle' | 'building' | 'awaiting' | 'pending' | 'done' | 'error';

interface WalletTxModalProps {
  isOpen:    boolean;
  action:    string;
  params:    Record<string, any>;
  onClose:   () => void;
  onSuccess: (txHash: string) => void;
}

const STEP_LABELS: Record<Step, string> = {
  idle:     'Ready to proceed',
  building: 'Building transaction…',
  awaiting: 'Waiting for MetaMask confirmation…',
  pending:  'Broadcasting to network…',
  done:     'Transaction confirmed!',
  error:    'Transaction failed'
};

const ETHERSCAN_BASE: Record<string, string> = {
  ethereum: 'https://etherscan.io/tx/',
  polygon:  'https://polygonscan.com/tx/',
  arbitrum: 'https://arbiscan.io/tx/'
};

export const WalletTxModal: React.FC<WalletTxModalProps> = ({
  isOpen, action, params, onClose, onSuccess
}) => {
  const [step,    setStep]    = useState<Step>('idle');
  const [txHash,  setTxHash]  = useState('');
  const [errorMsg,setErrorMsg]= useState('');

  if (!isOpen) return null;

  const network = (params?.metadata?.network || 'ethereum').toLowerCase();
  const etherscanUrl = txHash ? `${ETHERSCAN_BASE[network] || ETHERSCAN_BASE.ethereum}${txHash}` : '';

  const execute = async () => {
    setErrorMsg('');
    try {
      if (!(window as any).ethereum) {
        setErrorMsg('MetaMask is not installed. Please install MetaMask to continue.');
        setStep('error');
        return;
      }

      if (!params.walletAddress || params.walletAddress.trim() === '') {
        setErrorMsg('No wallet address found. Please connect MetaMask and try again.');
        setStep('error');
        return;
      }

      setStep('building');

      // claimRewards does not need an unsigned tx — it's a backend-only operation
      // that records the claim; the actual on-chain claim tx is protocol-specific
      if (action === 'claimRewards') {
        const result = await defiService.claimStakingRewards({
          positionId: params.positionId,
          walletAddress: params.walletAddress
        });
        setStep('done');
        setTxHash(result?.transactionHash || 'off-chain');
        onSuccess(result?.transactionHash || 'claimed');
        return;
      }

      // All other actions go through build-tx → MetaMask → confirm-tx
      const response = await defiService.buildTransaction(params);
      const unsignedTx = response?.data?.unsignedTx;
      if (!unsignedTx) throw new Error('Failed to build transaction — no unsigned tx returned');

      setStep('awaiting');
      const provider = new BrowserProvider((window as any).ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const tx = await signer.sendTransaction(unsignedTx);
      setTxHash(tx.hash);

      setStep('pending');
      await tx.wait(1);

      await defiService.confirmTransaction({
        txHash: tx.hash,
        positionType: params.positionType || 'staking',
        metadata: params.metadata || params
      });

      setStep('done');
      onSuccess(tx.hash);
    } catch (err: any) {
      // User rejected MetaMask prompt
      if (err?.code === 4001) {
        setErrorMsg('Transaction rejected in MetaMask.');
      } else {
        setErrorMsg(err?.message || 'An unexpected error occurred.');
      }
      setStep('error');
    }
  };

  const isProcessing = ['building', 'awaiting', 'pending'].includes(step);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-gray-900 rounded-2xl p-8 max-w-md w-full border border-gray-700 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white capitalize">{action}</h2>
            {!isProcessing && (
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-6">
            {(['building', 'awaiting', 'pending', 'done'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                  step === 'error'                                   ? 'border-red-500 bg-red-900/30 text-red-400'
                  : step === s || (['done'].includes(step) && i < 4) ? 'border-blue-500 bg-blue-600 text-white'
                  : isProcessing && ['building','awaiting','pending'].indexOf(step) > i ? 'border-green-500 bg-green-900/30 text-green-400'
                  : 'border-gray-600 bg-gray-800 text-gray-500'
                }`}>
                  {i + 1}
                </div>
                {i < 3 && <div className="w-6 h-px bg-gray-700" />}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mb-4 -mt-2">Steps complete automatically as the transaction progresses</p>

          {/* Status */}
          <div className="mb-6 p-4 rounded-xl bg-gray-800 border border-gray-700">
            <div className="flex items-center gap-3">
              {isProcessing && (
                <svg className="w-5 h-5 text-blue-400 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
              {step === 'done' && (
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {step === 'error' && (
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {step === 'idle' && <div className="w-5 h-5 rounded-full border-2 border-gray-500" />}
              <span className={`text-sm font-medium ${
                step === 'done'  ? 'text-green-400' :
                step === 'error' ? 'text-red-400'   : 'text-white'
              }`}>
                {STEP_LABELS[step]}
              </span>
            </div>

            {step === 'awaiting' && (
              <p className="text-xs text-gray-400 mt-2 ml-8">
                Check your MetaMask extension and confirm the transaction.
              </p>
            )}

            {step === 'error' && errorMsg && (
              <p className="text-xs text-red-300 mt-2 ml-8">{errorMsg}</p>
            )}
          </div>

          {/* TX hash when pending/done */}
          {txHash && (
            <div className="mb-6 p-3 bg-gray-800 rounded-lg border border-gray-700">
              <p className="text-xs text-gray-400 mb-1">Transaction hash</p>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs text-blue-300 break-all">
                  {txHash.slice(0, 20)}…{txHash.slice(-8)}
                </code>
                <a
                  href={etherscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  View ↗
                </a>
              </div>
            </div>
          )}

          {/* Transaction details summary */}
          {params?.metadata && step === 'idle' && (
            <div className="mb-6 p-3 bg-gray-800/50 rounded-lg border border-gray-700 text-xs text-gray-400 space-y-1">
              {params.metadata.asset    && <p>Asset: <span className="text-white">{params.metadata.asset}</span></p>}
              {params.metadata.amount   && <p>Amount: <span className="text-white">{params.metadata.amount}</span></p>}
              {params.metadata.network  && <p>Network: <span className="text-white capitalize">{params.metadata.network}</span></p>}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {step === 'idle' && (
              <>
                <button
                  onClick={onClose}
                  className="flex-1 border border-gray-600 text-gray-300 px-4 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={execute}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                >
                  Confirm in MetaMask
                </button>
              </>
            )}

            {step === 'done' && (
              <button
                onClick={onClose}
                className="w-full bg-green-600 hover:bg-green-500 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
              >
                Done
              </button>
            )}

            {step === 'error' && (
              <div className="flex gap-3 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 border border-gray-600 text-gray-300 px-4 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => { setStep('idle'); setErrorMsg(''); setTxHash(''); }}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};