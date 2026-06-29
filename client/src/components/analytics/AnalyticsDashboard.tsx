// client/src/components/analytics/AnalyticsDashboard.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter
} from 'recharts';
import { TrendingUp, Download, Activity, AlertCircle, RefreshCw, TrendingDown, Zap, Target } from 'lucide-react';
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
  riskLevel?: string;
}

interface PortfolioAsset {
  symbol: string;
  value: number;
  allocation: number;
}

interface Opportunity {
  asset: string;
  type: string;
  change24h: number;
  potentialReturn: number;
  risk: string;
  confidence: number;
  signal: string;
}

interface Props {
  data?: {
    performance?: any;
    risk?: any;
    allocation?: any;
    benchmark?: any;
    correlation?: any;
  } | null;
  timeframe: string;
  onRefresh?: () => void;
}

const COLORS = ['#3D5AF1', '#22DFBF', '#F7931A', '#FF4D4D', '#A855F7', '#F59E0B'];

// ── Correlation Heat-map Cell ─────────────────────────────────────────────────
const CorrelationCell: React.FC<{ value: number | null }> = ({ value }) => {
  if (value === null) return <td className="w-10 h-10 text-center text-xs text-gray-600">–</td>;
  const abs = Math.abs(value);
  const bg = value >= 0
    ? `rgba(61,90,241,${abs.toFixed(2)})`
    : `rgba(255,77,77,${abs.toFixed(2)})`;
  return (
    <td
      className="w-10 h-10 text-center text-xs font-mono cursor-default"
      style={{ background: bg, color: abs > 0.5 ? '#fff' : '#7C8B9B' }}
      title={value.toFixed(3)}
    >
      {value.toFixed(2)}
    </td>
  );
};

const AnalyticsDashboard: React.FC<Props> = ({ data: propData, timeframe, onRefresh }) => {
  const [perfData,        setPerfData]        = useState<PerformancePoint[]>([]);
  const [riskData,        setRiskData]        = useState<RiskMetric[]>([]);
  const [pieData,         setPieData]         = useState<PortfolioAsset[]>([]);
  const [corrData,        setCorrData]        = useState<{ symbols: string[]; matrix: (number | null)[][] } | null>(null);
  const [opportunities,   setOpportunities]   = useState<Opportunity[]>([]);
  const [kpis,            setKpis]            = useState<Record<string, number | null>>({});
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [isExporting,     setIsExporting]     = useState(false);
  const [isReporting,     setIsReporting]     = useState(false);

  // ── Helper: map raw performance API data → chart points ───────────────────
  // ✅ FIX: Format date labels based on selected timeframe
  const getDateLabel = useCallback((dateInput: string | number | undefined, index: number): string => {
    if (!dateInput) return `Period ${index + 1}`;
    const date = new Date(dateInput);
    switch (timeframe) {
      case '1w':
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      case '1m':
      case '3m':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case '6m':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case '1y':
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      default:
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }, [timeframe]);

  const mapPerformance = useCallback((perf: any, bench: any): PerformancePoint[] => {
    if (!perf?.metrics?.returns || !Array.isArray(perf.metrics.returns)) return [];

    // Build lookup for real benchmark data by date label
    const benchMap: Record<string, number> = {};
    if (bench?.benchmark && Array.isArray(bench.benchmark)) {
      bench.benchmark.forEach((b: any) => {
        const label = b.date ? getDateLabel(b.date, 0) : '';
        if (label) benchMap[label] = b.value || 0;
      });
    }

    const formatted: PerformancePoint[] = perf.metrics.returns.map((r: any, i: number) => {
      // ✅ FIX: use timeframe-aware label
      const label = r.label
        ? (r.date ? getDateLabel(r.date, i) : r.label)
        : getDateLabel(r.date, i);
      return {
        month: label,
        portfolio: r.value || 0,
        benchmark: benchMap[label] ?? 0,
      };
    });

    return formatted.map((item, i) => {
      if (i === 0) return { ...item, portfolioReturn: 0, benchmarkReturn: 0 };
      const prev = formatted[i - 1];
      return {
        ...item,
        portfolioReturn:  prev.portfolio  ? ((item.portfolio  - prev.portfolio)  / prev.portfolio)  * 100 : 0,
        benchmarkReturn:  prev.benchmark  ? ((item.benchmark  - prev.benchmark)  / prev.benchmark)  * 100 : 0,
      };
    });
  }, [getDateLabel]);

  // ── Map incoming prop data ─────────────────────────────────────────────────
  useEffect(() => {
    if (!propData) return;
    try {
      // Performance + Benchmark (merged)
      const pts = mapPerformance(propData.performance, propData.benchmark);
      setPerfData(pts);

      // KPIs from performance metrics
      const m = propData.performance?.metrics || {};
      setKpis({
        volatility:   m.volatility   ?? null,
        sharpeRatio:  m.sharpeRatio  ?? null,
        sortinoRatio: m.sortinoRatio ?? null,
        maxDrawdown:  m.maxDrawdown  ?? null,
      });

      // Risk
      const riskAssets = propData.risk?.assets || [];
      setRiskData(riskAssets.slice(0, 6));

      // Allocation
      const allocAssets = propData.allocation?.assets || [];
      const total = allocAssets.reduce((s: number, a: any) => s + (a.value || 0), 0);
      setPieData(
        allocAssets.slice(0, 6).map((a: any) => ({
          symbol: a.symbol,
          value: a.value || 0,
          allocation: total > 0 ? Math.round(((a.value || 0) / total) * 100) : a.allocation || 0,
        }))
      );

      // Correlation
      if (propData.correlation?.symbols) {
        setCorrData(propData.correlation);
      }
    } catch (err) {
      console.error('Failed to map analytics prop data:', err);
    }
  }, [propData, mapPerformance, getDateLabel]);

  // ── Fetch opportunities independently (not in parent because it's not timeframe-dependent) ──
  useEffect(() => {
    apiFetch<any>('/api/analytics/opportunities?type=all')
      .then(res => setOpportunities(res?.data?.opportunities?.slice(0, 5) || []))
      .catch(() => setOpportunities([]));
  }, []);

  // ── Formatters ─────────────────────────────────────────────────────────────
  const fmt    = (v: number) => `$${Math.round(v).toLocaleString()}`;
  const fmtPct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const rows = [
        ['Date', 'Portfolio Value', 'Portfolio Return %', 'Benchmark Value', 'Benchmark Return %'],
        ...perfData.map(p => [
          p.month,
          p.portfolio,
          (p.portfolioReturn || 0).toFixed(2),
          p.benchmark,
          (p.benchmarkReturn || 0).toFixed(2),
        ])
      ];
      const csv  = rows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `neofin-analytics-${timeframe}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  // ── Generate Report — calls the CORRECT /api/analytics/report endpoint ─────
  const handleGenerateReport = async () => {
    setIsReporting(true);
    try {
      const res = await apiFetch<any>('/api/analytics/report', {   // ← FIXED (was /custom)
        method: 'POST',
        body: {
          title:    `Analytics Report — ${timeframe.toUpperCase()} — ${new Date().toLocaleDateString()}`,
          sections: [
            { type: 'performance', params: { timeframe, metrics: ['returns', 'volatility', 'sharpe_ratio'] } },
            { type: 'risk',        params: { timeframe } },
            { type: 'opportunities', params: { type: 'all' } },
          ],
          format: 'json',
        },
      });
      const report = res?.data?.report || res?.data;
      const blob   = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url    = URL.createObjectURL(blob);
      const a      = document.createElement('a');
      a.href       = url;
      a.download   = `neofin-report-${timeframe}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Report generation failed:', e);
    } finally {
      setIsReporting(false);
    }
  };

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
          onClick={onRefresh}
          className="px-4 py-2 bg-primary rounded-lg text-sm text-white hover:bg-primary/80 transition-colors"
        >
          Retry
        </button>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Top action bar ────────────────────────────────────────────────── */}
      <div className="flex justify-end items-center gap-2">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 bg-dark-800 rounded-lg hover:bg-dark-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
        <button
          className="btn-outline disabled:opacity-60 flex items-center gap-1.5 text-sm px-3 py-2"
          disabled={isExporting || perfData.length === 0}
          onClick={handleExportCSV}
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Exporting…' : 'Export CSV'}
        </button>
        <button
          className="btn-primary disabled:opacity-60 flex items-center gap-1.5 text-sm px-3 py-2"
          disabled={isReporting}
          onClick={handleGenerateReport}
        >
          <TrendingUp className="w-4 h-4" />
          {isReporting ? 'Generating…' : 'Generate Report'}
        </button>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Volatility',    key: 'volatility',   fmt: (v: number) => `${(v * 100).toFixed(2)}%`,  icon: <Activity className="w-5 h-5 text-yellow-400" /> },
          { label: 'Sharpe Ratio',  key: 'sharpeRatio',  fmt: (v: number) => v.toFixed(3),                 icon: <Target className="w-5 h-5 text-green-400" /> },
          { label: 'Sortino Ratio', key: 'sortinoRatio', fmt: (v: number) => v.toFixed(3),                 icon: <TrendingUp className="w-5 h-5 text-blue-400" /> },
          { label: 'Max Drawdown',  key: 'maxDrawdown',  fmt: (v: number) => `-${v.toFixed(2)}%`,          icon: <TrendingDown className="w-5 h-5 text-red-400" /> },
        ].map(({ label, key, fmt: f, icon }) => (
          <GlassCard key={key} className="p-4 flex items-center gap-3">
            {icon}
            <div>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-lg font-bold">
                {kpis[key] != null ? f(kpis[key] as number) : '—'}
              </p>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* ── Performance Area Chart ─────────────────────────────────────── */}
          <GlassCard className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Portfolio vs Benchmark ({timeframe.toUpperCase()})</h3>
              <span className="text-xs text-green-400 flex items-center gap-1">
                <Activity className="w-3 h-3" /> Live data
              </span>
            </div>
            {perfData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={perfData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#323B4E" />
                    <XAxis dataKey="month" tick={{ fill: '#7C8B9B', fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                      tick={{ fill: '#7C8B9B', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{ background: '#1A1B23', border: '1px solid #3D5AF1', borderRadius: 8 }}
                      formatter={(v: any, name: string) => [fmt(v), name]}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="portfolio" stroke="#3D5AF1" fillOpacity={0.2} fill="#3D5AF1" name="Portfolio" />
                    <Area type="monotone" dataKey="benchmark" stroke="#22DFBF" fillOpacity={0.2} fill="#22DFBF" name="BTC Benchmark" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-500 text-sm">
                No performance history yet. Add assets to your portfolio and wait for the daily snapshot.
              </div>
            )}
          </GlassCard>

          {/* ── Returns Bar Chart ──────────────────────────────────────────── */}
          <GlassCard className="p-6">
            <h3 className="text-xl font-semibold mb-6">Period Returns ({timeframe.toUpperCase()})</h3>
            {perfData.length > 1 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perfData.slice(1)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#323B4E" />
                    <XAxis dataKey="month" tick={{ fill: '#7C8B9B', fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${v.toFixed(1)}%`} tick={{ fill: '#7C8B9B', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#1A1B23', border: '1px solid #3D5AF1', borderRadius: 8 }}
                      formatter={(v: any, name: string) => [fmtPct(v), name]}
                    />
                    <Legend />
                    <Bar dataKey="portfolioReturn" fill="#3D5AF1" name="Portfolio" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="benchmarkReturn" fill="#22DFBF" name="BTC Benchmark" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
                Not enough data points yet.
              </div>
            )}
          </GlassCard>

          {/* ── Correlation Matrix ─────────────────────────────────────────── */}
          {corrData && corrData.symbols.length > 1 && (
            <GlassCard className="p-6">
              <h3 className="text-xl font-semibold mb-4">Asset Correlation Matrix</h3>
              <p className="text-xs text-gray-400 mb-4">
                Blue = positive correlation · Red = negative correlation · Based on 90-day price history
              </p>
              <div className="overflow-x-auto">
                <table className="border-separate border-spacing-0.5">
                  <thead>
                    <tr>
                      <th className="w-16" />
                      {corrData.symbols.map(s => (
                        <th key={s} className="text-xs text-gray-400 font-normal px-1 text-center w-10">{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {corrData.symbols.map((row, ri) => (
                      <tr key={row}>
                        <td className="text-xs text-gray-400 font-medium pr-2 text-right">{row}</td>
                        {corrData.matrix[ri].map((val, ci) => (
                          <CorrelationCell key={ci} value={val} />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {/* ── Investment Opportunities ───────────────────────────────────── */}
          {opportunities.length > 0 && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Market Opportunities</h3>
                <Zap className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="space-y-3">
                {opportunities.map((opp, i) => (
                  <div key={i} className="flex items-center justify-between bg-dark-900/50 rounded-lg p-3">
                    <div>
                      <span className="font-semibold text-sm">{opp.asset}</span>
                      <span className={`ml-2 text-xs ${opp.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmtPct(opp.change24h)} 24h
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5 capitalize">{opp.signal}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Confidence</p>
                      <p className="text-sm font-bold">{opp.confidence.toFixed(0)}%</p>
                      <span className={`text-xs ${
                        opp.risk === 'High' ? 'text-red-400' : opp.risk === 'Medium' ? 'text-yellow-400' : 'text-green-400'
                      }`}>{opp.risk} risk</span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>

        {/* ── Right Column ──────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Asset Allocation Pie */}
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
            <h3 className="text-xl font-semibold mb-4">Risk Metrics ({timeframe.toUpperCase()})</h3>
            {riskData.length > 0 ? (
              <div className="space-y-3">
                {riskData.map(r => (
                  <div key={r.symbol} className="bg-dark-900/50 rounded-lg p-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{r.symbol}</span>
                      <span className={`text-xs ${
                        r.riskLevel === 'High' ? 'text-red-400' :
                        r.riskLevel === 'Medium' ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {r.riskLevel || (r.volatility > 0.05 ? 'High' : r.volatility > 0.02 ? 'Medium' : 'Low')}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-400">
                      <span>Vol: {(r.volatility * 100).toFixed(2)}%</span>
                      <span>VaR: {(r.var * 100).toFixed(2)}%</span>
                      <span>β: {(r.beta || 1).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-6">No risk data available</p>
            )}
          </GlassCard>

          {/* Data Source Status */}
          <GlassCard className="p-6">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold">Data Source</h3>
              <Activity className="text-green-400 w-4 h-4" />
            </div>
            <p className="text-green-400 mt-3 text-sm">Live — NeoFin backend + Kraken market data</p>
            <p className="text-gray-500 text-xs mt-1">Updated: {new Date().toLocaleTimeString()}</p>
            <p className="text-gray-600 text-xs mt-1">Timeframe: {timeframe.toUpperCase()}</p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
