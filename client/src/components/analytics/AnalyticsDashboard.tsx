import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, Download, Activity, AlertCircle, RefreshCw } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { apiFetch } from '../../services/api';

interface PerformancePoint {
  month: string;
  portfolio: number;
  benchmark: number;
  portfolioReturn?: number;
  benchmarkReturn?: number;
}

interface RiskMetric {
  symbol: string;
  volatility: number;
  var: number;
  beta: number;
}

interface PortfolioAsset {
  symbol: string;
  value: number;
  allocation: number;
}

const COLORS = ['#3D5AF1', '#22DFBF', '#F7931A', '#FF4D4D', '#A855F7', '#F59E0B'];

const AnalyticsDashboard: React.FC = () => {
  const [perfData, setPerfData] = useState<PerformancePoint[]>([]);
  const [riskData, setRiskData] = useState<RiskMetric[]>([]);
  const [pieData, setPieData] = useState<PortfolioAsset[]>([]);
  const [timeframe, setTimeframe] = useState('1m');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting]   = useState(false);
  const [isReporting, setIsReporting]   = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [perfRes, riskRes, assetsRes] = await Promise.allSettled([
        apiFetch<any>(`/api/analytics/performance?timeframe=${timeframe}&metrics=returns,volatility,sharpe_ratio,max_drawdown`),
        apiFetch<any>(`/api/analytics/risk?timeframe=${timeframe}`),
        apiFetch<any>('/api/portfolio/assets'),
      ]);

      // Performance data
      if (perfRes.status === 'fulfilled') {
        const raw = perfRes.value?.data?.metrics;
        if (raw?.returns && Array.isArray(raw.returns)) {
          const formatted: PerformancePoint[] = raw.returns.map((r: any, i: number) => ({
            month: r.label || r.date || `Period ${i + 1}`,
            portfolio: r.value || 0,
            benchmark: (r.value || 0) * 0.9,
          }));
          const withReturns = formatted.map((item, i) => {
            if (i === 0) return { ...item, portfolioReturn: 0, benchmarkReturn: 0 };
            const prev = formatted[i - 1];
            return {
              ...item,
              portfolioReturn: prev.portfolio ? ((item.portfolio - prev.portfolio) / prev.portfolio) * 100 : 0,
              benchmarkReturn: prev.benchmark ? ((item.benchmark - prev.benchmark) / prev.benchmark) * 100 : 0,
            };
          });
          setPerfData(withReturns);
        }
      }

      // Risk data
      if (riskRes.status === 'fulfilled') {
        const assets = riskRes.value?.data?.assets || [];
        setRiskData(assets.slice(0, 6));
      }

      // Asset allocation pie
      if (assetsRes.status === 'fulfilled') {
        const assets = assetsRes.value?.data || [];
        const total = assets.reduce((s: number, a: any) => s + (a.value || 0), 0);
        setPieData(
          assets.slice(0, 6).map((a: any) => ({
            symbol: a.symbol,
            value: a.value || 0,
            allocation: total > 0 ? Math.round(((a.value || 0) / total) * 100) : 0,
          }))
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await apiFetch<any>('/api/analytics/custom', {
        method: 'POST',
        body: {
          title: `Analytics Report — ${new Date().toLocaleDateString()}`,
          sections: [
            { type: 'performance', params: { timeframe, metrics: ['returns', 'volatility', 'sharpe_ratio'] } },
            { type: 'risk', params: { timeframe } },
          ],
        },
      });
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `neofin-analytics-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const fmt = (v: number) => `$${Math.round(v).toLocaleString()}`;
  const fmtPct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-dark-800/60 rounded-xl h-64 col-span-1" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard className="p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-300 mb-4">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-primary rounded-lg text-sm text-white hover:bg-primary/80 transition-colors"
        >
          Retry
        </button>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {['1w', '1m', '3m', '6m', '1y'].map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                timeframe === tf ? 'bg-primary text-white' : 'bg-dark-800 text-gray-400 hover:text-white'
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchAnalytics}
            className="p-2 bg-dark-800 rounded-lg hover:bg-dark-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            className="btn-outline disabled:opacity-60"
            disabled={isExporting || loading}
            onClick={async () => {
              setIsExporting(true);
              try {
                const rows = [
                  ['Date', 'Portfolio Value', 'Return %'],
                  ...perfData.map(p => [p.label, p.value, p.returnPct])
                ];
                const csv = rows.map(r => r.join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `neofin-analytics-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              } finally {
                setIsExporting(false);
              }
            }}
          >
            {isExporting ? 'Exporting…' : 'Export Data'}
          </button>
          <button
            className="btn-primary disabled:opacity-60"
            disabled={isReporting || loading}
            onClick={async () => {
              setIsReporting(true);
              try {
                const res = await apiFetch<any>('/api/analytics/custom', {
                  method: 'POST',
                  body: JSON.stringify({
                    sections: ['performance', 'risk', 'opportunities'],
                    timeframe,
                    format: 'json',
                  }),
                });
                const report = res?.data?.report || res?.data;
                const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `neofin-report-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) {
                console.error('Report generation failed:', e);
              } finally {
                setIsReporting(false);
              }
            }}
          >
            {isReporting ? 'Generating…' : 'Generate Report'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Performance Chart */}
          <GlassCard className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Portfolio Performance</h3>
              <span className="text-xs text-green-400 flex items-center gap-1">
                <Activity className="w-3 h-3" /> Live from backend
              </span>
            </div>
            {perfData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={perfData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#323B4E" />
                    <XAxis dataKey="month" tick={{ fill: '#7C8B9B', fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fill: '#7C8B9B', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ background: '#1A1B23', border: '1px solid #3D5AF1', borderRadius: 8 }}
                      formatter={(v: any) => fmt(v)}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="portfolio" stroke="#3D5AF1" fillOpacity={0.2} fill="#3D5AF1" name="Portfolio" />
                    <Area type="monotone" dataKey="benchmark" stroke="#22DFBF" fillOpacity={0.2} fill="#22DFBF" name="Benchmark" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-500">
                No performance data yet. Add assets to your portfolio to start tracking.
              </div>
            )}
          </GlassCard>

          {/* Monthly Returns */}
          <GlassCard className="p-6">
            <h3 className="text-xl font-semibold mb-6">Monthly Returns</h3>
            {perfData.length > 1 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perfData.slice(1)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#323B4E" />
                    <XAxis dataKey="month" tick={{ fill: '#7C8B9B', fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `${v.toFixed(1)}%`} tick={{ fill: '#7C8B9B', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ background: '#1A1B23', border: '1px solid #3D5AF1', borderRadius: 8 }}
                      formatter={(v: any) => fmtPct(v)}
                    />
                    <Legend />
                    <Bar dataKey="portfolioReturn" fill="#3D5AF1" name="Portfolio" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="benchmarkReturn" fill="#22DFBF" name="Benchmark" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">Not enough data points yet.</div>
            )}
          </GlassCard>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Asset Allocation */}
          <GlassCard className="p-6">
            <h3 className="text-xl font-semibold mb-4">Asset Allocation</h3>
            {pieData.length > 0 ? (
              <>
                <div className="flex justify-center">
                  <PieChart width={200} height={200}>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(v)} />
                  </PieChart>
                </div>
                <div className="space-y-2 mt-2">
                  {pieData.map((asset, i) => (
                    <div key={asset.symbol} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        {asset.symbol}
                      </span>
                      <span className="text-gray-400">{asset.allocation}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                No assets in portfolio
              </div>
            )}
          </GlassCard>

          {/* Risk Metrics */}
          <GlassCard className="p-6">
            <h3 className="text-xl font-semibold mb-4">Risk Metrics</h3>
            {riskData.length > 0 ? (
              <div className="space-y-3">
                {riskData.map(r => (
                  <div key={r.symbol} className="bg-dark-900/50 rounded-lg p-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{r.symbol}</span>
                      <span className={`text-xs ${r.volatility > 0.5 ? 'text-red-400' : 'text-green-400'}`}>
                        {(r.volatility * 100).toFixed(1)}% vol
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-400">
                      <span>VaR: {(r.var * 100).toFixed(2)}%</span>
                      <span>Beta: {(r.beta || 1).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-6">No risk data available</p>
            )}
          </GlassCard>

          {/* Status */}
          <GlassCard className="p-6">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold">Data Source</h3>
              <Activity className="text-green-400 w-4 h-4" />
            </div>
            <p className="text-green-400 mt-3 text-sm">Connected to NeoFin backend analytics API</p>
            <p className="text-gray-500 text-xs mt-1">Last updated: {new Date().toLocaleTimeString()}</p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
