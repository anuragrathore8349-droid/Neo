import React, { useState } from 'react';
import { AlertCircle, TrendingUp, Check, Zap, Shield, Rocket, BarChart2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getRebalancePreview, applyRebalance, RebalanceResult } from '../../services/portfolio.service';

interface PortfolioRebalanceProps {
  portfolioId: string;
  isOpen: boolean;
  onClose: () => void;
  onRebalanced: () => void;
}

const OBJECTIVES = [
  {
    value: 'sharpe',
    label: 'Max Risk-Adjusted Return',
    description: 'Maximises the Sharpe ratio — best return per unit of risk. Ideal for balanced growth with smart diversification.',
    icon: <BarChart2 size={22} className="text-blue-400" />,
    tag: 'Balanced',
    tagColor: 'bg-blue-500/20 text-blue-300',
    highlight: 'Sharpe Ratio'
  },
  {
    value: 'minvar',
    label: 'Minimum Volatility',
    description: 'Uses the analytical minimum-variance solution. Lowest portfolio swings — great for capital preservation.',
    icon: <Shield size={22} className="text-green-400" />,
    tag: 'Conservative',
    tagColor: 'bg-green-500/20 text-green-300',
    highlight: 'Lowest Volatility'
  },
  {
    value: 'maxreturn',
    label: 'Maximum Return',
    description: 'Tilts toward highest-momentum, highest-CAGR assets with a risk-budget approach. Highest potential upside, higher risk.',
    icon: <Rocket size={22} className="text-orange-400" />,
    tag: 'Aggressive',
    tagColor: 'bg-orange-500/20 text-orange-300',
    highlight: 'Highest Expected Return'
  }
];

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

  // ── Metric normalisation ──────────────────────────────────────────────────
  const metrics = (previewData?.expectedMetrics ?? {}) as Record<string, number | string | undefined>;

  const parseMetric = (value: number | string | undefined): number | null => {
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value === 'string') {
      const p = parseFloat(value.replace('%', ''));
      return isFinite(p) ? p : null;
    }
    return null;
  };

  const fmt = (v: number | string | undefined, decimals = 2, suffix = '') => {
    const n = parseMetric(v);
    return n !== null ? `${n.toFixed(decimals)}${suffix}` : 'N/A';
  };

  const sharpeVal   = parseMetric(metrics.sharpe    ?? metrics.sharpeRatio);
  const volVal      = parseMetric(metrics.volatility ?? metrics.volatilityAnnual);
  const drawdownVal = parseMetric(metrics.maxDrawdown ?? metrics.estimatedMaxDrawdown);
  const sortino     = parseMetric((metrics as any).sortinoRatio);
  const divScore    = parseMetric((metrics as any).diversificationScore);

  // ── Trades ────────────────────────────────────────────────────────────────
  const trades = (() => {
    const raw = previewData?.trades ?? [];
    if (raw.length > 0) return raw;
    const rebalancing = (previewData as any)?.rebalancing ?? [];
    return rebalancing.map((item: any) => ({
      symbol: item.symbol,
      name: item.symbol,
      currentAmount: 0,
      currentValue: 0,
      currentAllocation: item.current ?? '0.00',
      recommendedAllocation: item.recommended ?? '0.00',
      differencePercent: '0.00',
      tradeValue: '0.00',
      action: 'HOLD' as const
    }));
  })();

  const activeTrades = trades.filter(t => t.action !== 'HOLD');
  const selectedObjective = OBJECTIVES.find(o => o.value === objective)!;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleGetPreview = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    setPreviewData(null);
    if (!portfolioId) {
      setError('Portfolio not loaded yet. Please refresh and try again.');
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
      setError('Portfolio not loaded yet. Please refresh and try again.');
      setLoading(false);
      return;
    }
    try {
      const res = await applyRebalance(portfolioId, objective);
      if (res.status === 'success') {
        setStatusMessage(res.message || 'Portfolio rebalanced successfully.');
        setStep('complete');
        setTimeout(() => { onRebalanced(); onClose(); }, 2500);
      } else {
        setError(res.message || 'Failed to apply rebalance');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to apply rebalance');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('select');
    setPreviewData(null);
    setError(null);
    setStatusMessage(null);
  };

  if (!isOpen) return null;

  // ── Metric card colours by objective ──────────────────────────────────────
  const objColour = {
    sharpe:    { accent: 'text-blue-400',   bg: 'bg-blue-500/10',    border: 'border-blue-500/30' },
    minvar:    { accent: 'text-green-400',  bg: 'bg-green-500/10',   border: 'border-green-500/30' },
    maxreturn: { accent: 'text-orange-400', bg: 'bg-orange-500/10',  border: 'border-orange-500/30' }
  }[objective] ?? { accent: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-dark-800 rounded-2xl border border-dark-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-dark-700 flex items-center justify-between sticky top-0 bg-dark-800 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Rebalance Portfolio</h2>
              <p className="text-sm text-dark-400">MPT-based asset allocation optimiser</p>
            </div>
          </div>
          <button onClick={onClose} className="text-dark-400 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">

            {/* ── STEP 1: Select Objective ── */}
            {step === 'select' && (
              <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info size={15} className="text-dark-400" />
                  <p className="text-sm text-dark-300">Each strategy uses a different mathematical optimisation — results will differ meaningfully.</p>
                </div>

                <div className="space-y-3">
                  {OBJECTIVES.map(obj => (
                    <button
                      key={obj.value}
                      onClick={() => { setObjective(obj.value); setPreviewData(null); setError(null); setStatusMessage(null); }}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                        objective === obj.value ? 'border-primary bg-primary/10' : 'border-dark-600 bg-dark-700/50 hover:border-dark-500'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{obj.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-white">{obj.label}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${obj.tagColor}`}>{obj.tag}</span>
                          </div>
                          <p className="text-sm text-dark-400 mt-1">{obj.description}</p>
                          <p className="text-xs text-dark-500 mt-1">Optimises for: <span className="text-primary font-medium">{obj.highlight}</span></p>
                        </div>
                        {objective === obj.value && <Check size={18} className="text-primary flex-shrink-0 mt-1" />}
                      </div>
                    </button>
                  ))}
                </div>

                {error && (
                  <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex gap-3">
                    <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-200 text-sm">{error}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── STEP 2: Preview ── */}
            {step === 'preview' && previewData && (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">

                {/* Objective badge */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${objColour.bg} border ${objColour.border}`}>
                  {selectedObjective?.icon}
                  <span className="text-sm font-medium text-white">{selectedObjective?.label}</span>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${selectedObjective?.tagColor}`}>{selectedObjective?.tag}</span>
                </div>

                {/* Metrics grid */}
                <div className={`rounded-xl border p-4 ${objColour.bg} ${objColour.border}`}>
                  <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide">Expected Portfolio Metrics</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-dark-400 text-xs">Sharpe Ratio</p>
                      <p className={`text-lg font-bold ${objColour.accent}`}>{fmt(sharpeVal)}</p>
                    </div>
                    <div>
                      <p className="text-dark-400 text-xs">Ann. Volatility</p>
                      <p className="text-lg font-bold text-yellow-400">{fmt(volVal, 2, '%')}</p>
                    </div>
                    <div>
                      <p className="text-dark-400 text-xs">Est. Max Drawdown</p>
                      <p className="text-lg font-bold text-red-400">{drawdownVal !== null ? `${drawdownVal.toFixed(2)}%` : 'N/A'}</p>
                    </div>
                    {sortino !== null && (
                      <div>
                        <p className="text-dark-400 text-xs">Sortino Ratio</p>
                        <p className={`text-lg font-bold ${objColour.accent}`}>{sortino.toFixed(2)}</p>
                      </div>
                    )}
                    {divScore !== null && (
                      <div>
                        <p className="text-dark-400 text-xs">Diversification</p>
                        <p className="text-lg font-bold text-purple-400">{divScore.toFixed(2)}×</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Trades */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-white">Recommended Trades</h3>
                    <span className="text-xs text-dark-400">{activeTrades.length} trade{activeTrades.length !== 1 ? 's' : ''} required</span>
                  </div>
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {trades.length > 0 ? trades.map(trade => (
                      <div key={trade.symbol} className="bg-dark-700/60 p-3 rounded-lg flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-white text-sm">{trade.symbol}</p>
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                              trade.action === 'BUY'  ? 'bg-green-500/20 text-green-400' :
                              trade.action === 'SELL' ? 'bg-red-500/20 text-red-400'   :
                              'bg-dark-600 text-dark-400'
                            }`}>{trade.action}</span>
                          </div>
                          <p className="text-xs text-dark-400 mt-0.5">
                            {trade.currentAllocation}% → {trade.recommendedAllocation}%
                            {trade.differencePercent !== '0.00' && (
                              <span className={parseFloat(trade.differencePercent) > 0 ? 'text-green-400' : 'text-red-400'}>
                                {' '}({parseFloat(trade.differencePercent) > 0 ? '+' : ''}{trade.differencePercent}%)
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-white whitespace-nowrap">
                          ${Math.abs(parseFloat(trade.tradeValue)).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    )) : (
                      <div className="bg-dark-700/50 p-4 rounded-lg text-sm text-dark-400 text-center">
                        No trade recommendations returned. Your portfolio may already be optimally allocated.
                      </div>
                    )}
                  </div>
                </div>

                {statusMessage && !error && (
                  <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
                    <p className="text-sm text-primary">{statusMessage}</p>
                  </div>
                )}
                {error && (
                  <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex gap-3">
                    <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-200 text-sm">{error}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── STEP 3: Confirm ── */}
            {step === 'confirm' && previewData && (
              <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="bg-yellow-500/15 border border-yellow-500/40 rounded-xl p-4 flex gap-3">
                  <AlertCircle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-200 text-sm font-medium">This action will update your portfolio allocation.</p>
                    <p className="text-yellow-200/70 text-xs mt-1">Historical cost-basis is preserved. Only allocation weights change.</p>
                  </div>
                </div>

                <div className="bg-dark-700/50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">Strategy</span>
                    <span className="text-white font-medium">{selectedObjective?.label}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">Optimises for</span>
                    <span className={`font-medium ${objColour.accent}`}>{selectedObjective?.highlight}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">Active trades</span>
                    <span className="text-white font-medium">{activeTrades.length}</span>
                  </div>
                  {sharpeVal !== null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Expected Sharpe</span>
                      <span className={`font-medium ${objColour.accent}`}>{sharpeVal.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex gap-3">
                    <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-200 text-sm">{error}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── STEP 4: Complete ── */}
            {step === 'complete' && (
              <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center space-y-4 py-8">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
                  className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto"
                >
                  <Check size={32} className="text-green-400" />
                </motion.div>
                <h3 className="text-2xl font-bold text-white">Rebalancing Complete!</h3>
                <p className="text-dark-300">{statusMessage || 'Your portfolio has been successfully rebalanced.'}</p>
                <p className="text-sm text-dark-400">Redirecting to portfolio…</p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer */}
        {step !== 'complete' && (
          <div className="p-6 border-t border-dark-700 flex gap-3 sticky bottom-0 bg-dark-800 z-10">
            <button
              onClick={() => { if (step === 'preview') setStep('select'); else if (step === 'confirm') setStep('preview'); else onClose(); }}
              className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-white font-medium transition-colors"
            >
              {step === 'select' ? 'Cancel' : 'Back'}
            </button>

            {step === 'select' && (
              <button
                onClick={handleGetPreview}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Generating…</> : <><Zap size={16} />Get Preview</>}
              </button>
            )}

            {step === 'preview' && (
              <button
                onClick={() => setStep('confirm')}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <TrendingUp size={16} /> Proceed to Confirm
              </button>
            )}

            {step === 'confirm' && (
              <button
                onClick={handleApplyRebalance}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Applying…</> : <><Check size={16} />Apply Rebalance</>}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default PortfolioRebalance;
