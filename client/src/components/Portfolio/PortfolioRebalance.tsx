import React, { useState } from 'react';
import { AlertCircle, TrendingUp, Check, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getRebalancePreview, applyRebalance, RebalanceResult } from '../../services/portfolio.service';

interface PortfolioRebalanceProps {
  portfolioId: string;
  isOpen: boolean;
  onClose: () => void;
  onRebalanced: () => void;
}

const PortfolioRebalance: React.FC<PortfolioRebalanceProps> = ({
  portfolioId,
  isOpen,
  onClose,
  onRebalanced,
}) => {
  const [step, setStep] = useState<'select' | 'preview' | 'confirm' | 'complete'>('select');
  const [objective, setObjective] = useState('sharpe');
  const [previewData, setPreviewData] = useState<RebalanceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const metrics = previewData?.expectedMetrics ?? {};
  const formatMetric = (value: number | undefined, suffix = '') => {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
    return `${value.toFixed(2)}${suffix}`;
  };

  const objectives = [
    {
      value: 'sharpe',
      label: 'Max Risk-Adjusted Returns',
      description: 'Optimize for best risk-adjusted return (Sharpe ratio)',
      icon: '📊'
    },
    {
      value: 'minvar',
      label: 'Minimum Volatility',
      description: 'Reduce portfolio volatility while maintaining returns',
      icon: '🛡️'
    },
    {
      value: 'maxreturn',
      label: 'Maximum Return',
      description: 'Maximize expected returns (higher risk)',
      icon: '🚀'
    }
  ];

  const handleGetPreview = async () => {
    setLoading(true);
    setError(null);
    if (!portfolioId) {
      setError('Portfolio not loaded yet. Please refresh the page and try again.');
      setLoading(false);
      return;
    }
    try {
      const res = await getRebalancePreview(portfolioId, objective);
      if (res.status === 'success' && res.data) {
        setPreviewData(res.data);
        setStatusMessage(res.data.message || 'Preview generated successfully.');
        setStep('preview');
      } else {
        setStatusMessage(res.message || 'Failed to generate preview');
        setError(res.message || 'Failed to generate preview');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyRebalance = async () => {
    setLoading(true);
    setError(null);
    if (!portfolioId) {
      setError('Portfolio not loaded yet. Please refresh the page and try again.');
      setLoading(false);
      return;
    }
    try {
      const res = await applyRebalance(portfolioId, objective);
      if (res.status === 'success') {
        setStatusMessage(res.message || 'Portfolio rebalanced successfully.');
        setStep('complete');
        setTimeout(() => {
          onRebalanced();
          onClose();
        }, 2000);
      } else {
        setError(res.message || 'Failed to apply rebalance');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to apply rebalance');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="p-6 border-b border-dark-700 flex items-center justify-between sticky top-0 bg-dark-800 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <TrendingUp size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Rebalance Portfolio</h2>
              <p className="text-sm text-dark-400">Optimize your asset allocation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-dark-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Select Objective */}
            {step === 'select' && (
              <motion.div
                key="select"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <p className="text-dark-300 mb-6">Choose your optimization objective:</p>

                <div className="space-y-3">
                  {objectives.map((obj) => (
                    <button
                      key={obj.value}
                      onClick={() => setObjective(obj.value)}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        objective === obj.value
                          ? 'border-primary bg-primary/10'
                          : 'border-dark-600 bg-dark-700/50 hover:border-dark-500'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{obj.icon}</span>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">{obj.label}</h3>
                          <p className="text-sm text-dark-400">{obj.description}</p>
                        </div>
                        {objective === obj.value && (
                          <Check size={20} className="text-primary flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {error && (
                  <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex gap-3">
                    <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
                    <p className="text-red-200 text-sm">{error}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Preview */}
            {step === 'preview' && previewData && (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Expected Metrics */}
                <div className="bg-dark-700/50 border border-dark-600 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-3">Expected Metrics</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-dark-400 text-sm">Sharpe Ratio</p>
                      <p className="text-lg font-bold text-primary">
                        {formatMetric(metrics.sharpe)}
                      </p>
                    </div>
                    <div>
                      <p className="text-dark-400 text-sm">Volatility</p>
                      <p className="text-lg font-bold text-yellow-400">
                        {formatMetric(metrics.volatility, '%')}
                      </p>
                    </div>
                    <div>
                      <p className="text-dark-400 text-sm">Max Drawdown</p>
                      <p className="text-lg font-bold text-red-400">
                        {formatMetric(metrics.maxDrawdown, '%')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Rebalancing Trades */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-white">Recommended Trades</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(previewData.trades ?? []).length > 0 ? (
                      (previewData.trades ?? []).map((trade) => (
                        <div
                          key={trade.symbol}
                          className="bg-dark-700/50 p-3 rounded-lg flex items-center justify-between"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-white">{trade.symbol}</p>
                              <span className={`text-xs px-2 py-1 rounded ${
                                trade.action === 'BUY'
                                  ? 'bg-green-500/20 text-green-400'
                                  : trade.action === 'SELL'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-dark-600 text-dark-300'
                              }`}>
                                {trade.action}
                              </span>
                            </div>
                            <p className="text-sm text-dark-400">
                              {trade.currentAllocation}% → {trade.recommendedAllocation}%
                              {trade.differencePercent !== '0.00' && (
                                <span className={trade.differencePercent.startsWith('-') ? 'text-red-400' : 'text-green-400'}>
                                  {' '}({trade.differencePercent}%)
                                </span>
                              )}
                            </p>
                          </div>
                          <p className="font-semibold text-white">${parseFloat(trade.tradeValue).toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
                        </div>
                      ))
                    ) : (
                      <div className="bg-dark-700/50 p-3 rounded-lg text-sm text-dark-400">
                        No trade recommendations were returned for this objective.
                      </div>
                    )}
                  </div>
                </div>

                {statusMessage && !error && (
                  <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
                    <p className="text-sm text-primary">{statusMessage}</p>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex gap-3">
                    <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
                    <p className="text-red-200 text-sm">{error}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Confirmation */}
            {step === 'confirm' && previewData && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 flex gap-3">
                  <AlertCircle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-yellow-200 text-sm">
                    This will immediately rebalance your portfolio according to the recommended allocation. This action cannot be undone.
                  </p>
                </div>

                <p className="text-dark-300">
                  <strong>Optimization Objective:</strong> {objective.replace('-', ' ').toUpperCase()}
                </p>

                <p className="text-dark-300">
                  <strong>Trades to Execute:</strong> {previewData.trades.filter(t => t.action !== 'HOLD').length}
                </p>

                {statusMessage && !error && (
                  <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
                    <p className="text-sm text-primary">{statusMessage}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 4: Complete */}
            {step === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-4 py-8"
              >
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Check size={32} className="text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-white">Rebalancing Complete!</h3>
                <p className="text-dark-300">{statusMessage || 'Your portfolio has been successfully rebalanced.'}</p>
                <p className="text-sm text-dark-400">Redirecting...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {step !== 'complete' && (
          <div className="p-6 border-t border-dark-700 flex gap-3 sticky bottom-0 bg-dark-800 z-10">
            <button
              onClick={() => {
                if (step === 'preview') {
                  setStep('select');
                } else {
                  onClose();
                }
              }}
              className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-white font-medium transition-colors"
            >
              {step === 'preview' ? 'Back' : 'Cancel'}
            </button>

            {step === 'select' && (
              <button
                onClick={handleGetPreview}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    Get Preview
                  </>
                )}
              </button>
            )}

            {step === 'preview' && (
              <button
                onClick={() => setStep('confirm')}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <TrendingUp size={16} />
                Proceed to Confirm
              </button>
            )}

            {step === 'confirm' && (
              <button
                onClick={handleApplyRebalance}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Apply Rebalance
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default PortfolioRebalance;
