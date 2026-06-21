import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import AnalyticsDashboard from '../components/analytics/AnalyticsDashboard';
import { Loader } from 'lucide-react';

const Analytics: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('1m');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [perf, risk, alloc, bench] = await Promise.allSettled([
          apiFetch(`/api/analytics/performance?timeframe=${timeframe}`),
          apiFetch('/api/analytics/risk'),
          apiFetch('/api/analytics/allocation'),
          apiFetch('/api/analytics/benchmark'),
        ]);

        if (!cancelled) {
          setData({
            performance: (perf as any).value?.data || null,
            risk:        (risk as any).value?.data || null,
            allocation:  (alloc as any).value?.data || null,
            benchmark:   (bench as any).value?.data || null,
          });
        }
      } catch (e) {
        console.error('Analytics load failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [timeframe]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <select
          value={timeframe}
          onChange={e => setTimeframe(e.target.value)}
          className="bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
        >
          {['1w','1m','3m','6m','1y'].map(t => (
            <option key={t} value={t}>{t.toUpperCase()}</option>
          ))}
        </select>
      </div>
      <AnalyticsDashboard data={data} timeframe={timeframe} />
    </div>
  );
};

export default Analytics;