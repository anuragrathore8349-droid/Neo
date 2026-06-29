import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, TrendingUp, X, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { portfolioService } from '../../../services/portfolio.service';

interface RebalanceAlertProps {
  portfolioId: string;
  className?: string;
}

interface DriftDetail {
  symbol: string;
  actualWeight: number;
  targetWeight: number;
  drift: number;
  flagged: boolean;
}

interface RebalanceAlertData {
  urgency: 'none' | 'low' | 'medium' | 'high';
  shouldRebalance: boolean;
  reasons: string[];
  driftDetails?: DriftDetail[];
  volatilityRegime: string;
  score: number;
  lastChecked: string;
}

const urgencyConfig = {
  high:   { color: 'red',    bg: 'bg-red-900/20',    border: 'border-red-500/40',    text: 'text-red-400',    label: 'High Priority' },
  medium: { color: 'yellow', bg: 'bg-yellow-900/20', border: 'border-yellow-500/40', text: 'text-yellow-400', label: 'Recommended'   },
  low:    { color: 'blue',   bg: 'bg-blue-900/10',   border: 'border-blue-500/30',   text: 'text-blue-400',   label: 'Optional'      },
  none:   { color: 'green',  bg: 'bg-green-900/10',  border: 'border-green-500/30',  text: 'text-green-400',  label: 'Balanced'      },
};

const RebalanceAlert: React.FC<RebalanceAlertProps> = ({ portfolioId, className = '' }) => {
  const [data, setData] = useState<RebalanceAlertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchCheck = useCallback(async () => {
    if (!portfolioId) return;
    setLoading(true);
    try {
      const result = await portfolioService.checkRebalanceTrigger(portfolioId);
      setData(result);
    } catch (e) {
      console.warn('RebalanceAlert fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    fetchCheck();
  }, [fetchCheck]);

  if (loading) return (
    <div className={`flex items-center gap-2 px-4 py-3 bg-[#1A1B23]/60 border border-[#3D5AF1]/10 rounded-xl animate-pulse ${className}`}>
      <div className="h-4 w-4 bg-gray-700 rounded" />
      <div className="h-4 w-48 bg-gray-700 rounded" />
    </div>
  );

  if (!data || dismissed) return null;

  const cfg = urgencyConfig[data.urgency as keyof typeof urgencyConfig] || urgencyConfig.none;

  // Hide the banner if portfolio is balanced and not forced
  if (!data.shouldRebalance) return (
    <div className={`flex items-center gap-2 px-4 py-2.5 ${cfg.bg} border ${cfg.border} rounded-xl text-sm ${className}`}>
      <TrendingUp size={15} className={cfg.text} />
      <span className={`${cfg.text} font-medium`}>Portfolio is balanced</span>
      <span className="text-gray-500 text-xs ml-1">— {data.reasons[0]}</span>
    </div>
  );

  return (
    <div className={`${cfg.bg} border ${cfg.border} rounded-xl ${className}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <AlertTriangle size={17} className={`${cfg.text} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${cfg.text}`}>Rebalance Suggested</span>
            <span className={`text-xs px-2 py-0.5 rounded-full bg-current/10 ${cfg.text}`}>{cfg.label}</span>
            <span className="text-xs text-gray-500">Score: {data.score}/100</span>
            <span className="text-xs text-gray-500">Volatility: {data.volatilityRegime}</span>
          </div>
          <p className="text-gray-300 text-sm mt-1">{data.reasons[0]}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setExpanded(v => !v)} className="p-1.5 text-gray-400 hover:text-white rounded transition-colors">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <button onClick={fetchCheck} className="p-1.5 text-gray-400 hover:text-white rounded transition-colors" title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button onClick={() => setDismissed(true)} className="p-1.5 text-gray-400 hover:text-white rounded transition-colors">
            <X size={15} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-current/10 pt-3 space-y-3">
          {/* All reasons */}
          {data.reasons.length > 1 && (
            <ul className="space-y-1">
              {data.reasons.map((r: string, i: number) => (
                <li key={i} className="text-xs text-gray-400 flex gap-1.5">
                  <span className={cfg.text}>•</span> {r}
                </li>
              ))}
            </ul>
          )}

          {/* Drift table */}
          <div>
            <p className="text-xs font-medium text-gray-400 mb-2">Asset Drift</p>
            <div className="space-y-1.5">
              {data.driftDetails?.map((d: DriftDetail) => (
                <div key={d.symbol} className="flex items-center gap-2 text-xs">
                  <span className="w-12 font-mono text-gray-300">{d.symbol}</span>
                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${d.flagged ? 'bg-red-500' : 'bg-[#3D5AF1]'}`}
                      style={{ width: `${Math.min(100, d.actualWeight)}%` }}
                    />
                  </div>
                  <span className={`w-16 text-right ${d.flagged ? 'text-red-400' : 'text-gray-400'}`}>
                    {d.actualWeight.toFixed(1)}% {d.drift > 0 ? '▲' : '▼'}
                  </span>
                  <span className="w-16 text-right text-gray-500">target {d.targetWeight.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <a
              href="/portfolio"
              className={`text-xs px-3 py-1.5 rounded-lg bg-current/10 ${cfg.text} border border-current/20 hover:bg-current/20 transition-colors`}
            >
              View Portfolio
            </a>
            <span className="text-xs text-gray-600 self-center">
              Last checked: {new Date(data.lastChecked).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RebalanceAlert;