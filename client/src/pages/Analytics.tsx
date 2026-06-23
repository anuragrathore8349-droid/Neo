// client/src/pages/Analytics.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../services/api';
import AnalyticsDashboard from '../components/analytics/AnalyticsDashboard';
import { Loader } from 'lucide-react';

const TIMEFRAMES = ['1w', '1m', '3m', '6m', '1y'] as const;
type Timeframe = typeof TIMEFRAMES[number];

const Analytics: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [perf, risk, alloc, bench, corr] = await Promise.allSettled([
        apiFetch(`/api/analytics/performance?timeframe=${timeframe}&metrics=returns,volatility,sharpe_ratio,max_drawdown`),
        apiFetch(`/api/analytics/risk?timeframe=${timeframe}`),
        apiFetch('/api/analytics/allocation'),
        apiFetch(`/api/analytics/benchmark?timeframe=${timeframe}&benchmark=BTC`),
        apiFetch('/api/analytics/correlation'),
      ]);

      setData({
        performance:   perf.status  === 'fulfilled' ? (perf.value  as any)?.data  : null,
        risk:          risk.status  === 'fulfilled' ? (risk.value  as any)?.data  : null,
        allocation:    alloc.status === 'fulfilled' ? (alloc.value as any)?.data  : null,
        benchmark:     bench.status === 'fulfilled' ? (bench.value as any)?.data  : null,
        correlation:   corr.status  === 'fulfilled' ? (corr.value  as any)?.data  : null,
      });
    } catch (e: any) {
      setError(e?.message || 'Analytics load failed');
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        {/* Timeframe selector — single source of truth */}
        <div className="flex gap-2">
          {TIMEFRAMES.map(t => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                timeframe === t
                  ? 'bg-primary text-white'
                  : 'bg-dark-800 text-gray-400 hover:text-white'
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-16 text-red-400">
          <p className="mb-4">{error}</p>
          <button
            onClick={load}
            className="px-4 py-2 bg-primary rounded-lg text-sm text-white hover:bg-primary/80 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <AnalyticsDashboard
          data={data}
          timeframe={timeframe}
          onRefresh={load}
        />
      )}
    </div>
  );
};

export default Analytics;
