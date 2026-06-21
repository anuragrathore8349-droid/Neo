import React, { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ArrowUpRight, ArrowDownRight,
  BarChart2, LineChart as LineChartIcon, TrendingUp,
  Download,
} from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { Asset } from '../../types';

interface MarketChartProps {
  asset: Asset;
  data: any[];
  onIntervalChange?: (label: string) => void;
}

const TIMEFRAMES = ['1H','4H','1D','1W','1M'] as const;
type TF = typeof TIMEFRAMES[number];

const MarketChart: React.FC<MarketChartProps> = ({ asset, data, onIntervalChange }) => {
  const [timeframe, setTimeframe] = useState<TF>('1D');
  const [chartType, setChartType]  = useState<'candles'|'line'|'area'>('candles');
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<any>(null);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);

  const tfSlice: Record<TF, number> = {
    '1H': 12, '4H': 24, '1D': 30, '1W': 52, '1M': data.length,
  };
  const displayed = data.slice(-Math.min(data.length, tfSlice[timeframe]));

  // ── Lightweight-charts: safe for v3, v4, v5 ───────────────────────────────
  useEffect(() => {
    if (chartType !== 'candles' || !containerRef.current || displayed.length === 0) return;

    let cleanupFn: (() => void) | undefined;
    let isMounted = true;

    (async () => {
      try {
        const lwc = await import('lightweight-charts');
        
        // Check if component is still mounted after async import
        if (!isMounted || !containerRef.current) return;

        // Safely cleanup previous chart
        if (chartRef.current) {
          try {
            chartRef.current.remove();
          } catch (e) {
            // Chart may already be disposed, that's ok
            console.debug('Chart already disposed:', e);
          }
          chartRef.current = null;
        }

        const el = containerRef.current;
        const chart = (lwc as any).createChart(el, {
          layout:    { background: { color: '#0F1419' }, textColor: '#7C8B9B', fontSize: 12 },
          width:     el.clientWidth,
          height:    384,
          grid:      { vertLines: { color: '#1E2A38' }, horzLines: { color: '#1E2A38' } },
          timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 5 },
          crosshair: { mode: 1 },
        });
        chartRef.current = chart;

        const seriesOpts = {
          upColor: '#22DFBF', downColor: '#FF4D4D',
          borderUpColor: '#22DFBF', borderDownColor: '#FF4D4D',
          wickUpColor: '#22DFBF', wickDownColor: '#FF4D4D',
        };

        let series: any;
        // v5: addSeries(CandlestickSeries, opts)
        if ((lwc as any).CandlestickSeries) {
          series = chart.addSeries((lwc as any).CandlestickSeries, seriesOpts);
        // v3/v4: addCandlestickSeries(opts)
        } else if (typeof chart.addCandlestickSeries === 'function') {
          series = chart.addCandlestickSeries(seriesOpts);
        // ultimate fallback: line series
        } else {
          series = chart.addLineSeries({ color: '#3D5AF1', lineWidth: 2 });
        }

        const candleData = displayed
          .filter((d: any) => d.close > 0)
          .map((d: any) => ({
            time:  Math.floor(new Date(d.date).getTime() / 1000) as any,
            open:  d.open  || d.close,
            high:  d.high  || d.close,
            low:   d.low   || d.close,
            close: d.close,
          }))
          .sort((a: any, b: any) => a.time - b.time)
          .filter((d: any, i: number, arr: any[]) => i === 0 || d.time !== arr[i - 1].time);

        if (candleData.length > 0) {
          series.setData(candleData);
          chart.timeScale().fitContent();
        }

        // Current price dashed line
        if (asset.price && typeof series.createPriceLine === 'function') {
          series.createPriceLine({ price: asset.price, color: '#3D5AF1', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Now' });
        }

        const onResize = () => el && chart && chart.applyOptions({ width: el.clientWidth });
        window.addEventListener('resize', onResize);
        cleanupFn = () => {
          window.removeEventListener('resize', onResize);
          if (chartRef.current) {
            try {
              chartRef.current.remove();
            } catch (e) {
              console.debug('Error removing chart:', e);
            }
            chartRef.current = null;
          }
        };
      } catch (err) {
        console.warn('lightweight-charts init error:', err);
      }
    })();

    return () => {
      isMounted = false;
      if (cleanupFn) {
        cleanupFn();
      } else if (chartRef.current) {
        // Fallback cleanup in case cleanupFn wasn't set
        try {
          chartRef.current.remove();
        } catch (e) {
          console.debug('Error removing chart in fallback cleanup:', e);
        }
        chartRef.current = null;
      }
    };
  }, [chartType, displayed, asset.price]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-dark-800 p-3 rounded-lg border border-dark-700 shadow-lg text-sm">
        <p className="font-medium mb-1">{label}</p>
        {payload.map((e: any, i: number) => (
          <p key={i} style={{ color: e.color }}>{e.name}: {formatCurrency(e.value)}</p>
        ))}
      </div>
    );
  };

  const handleDownload = () => {
    const rows = ['Date,Open,High,Low,Close,Volume',
      ...displayed.map((d: any) => `${d.date},${d.open},${d.high},${d.low},${d.close},${d.volume}`)
    ].join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([rows], { type: 'text/csv' })),
      download: `${asset.symbol}-${timeframe}.csv`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const axisProps = {
    tick: { fill: '#7C8B9B', fontSize: 11 },
    axisLine: false as any,
    tickLine: false as any,
  };

  const renderChart = () => {
    if (displayed.length === 0) return (
      <div className="flex items-center justify-center h-full text-dark-400 text-sm">
        No data available for this timeframe
      </div>
    );

    if (chartType === 'candles') return (
      <div ref={containerRef} style={{ height: 384, background: '#0F1419', borderRadius: 8 }} />
    );

    if (chartType === 'line') return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={displayed} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E2A38" vertical={false} />
          <XAxis dataKey="date" {...axisProps} />
          <YAxis domain={['auto','auto']} {...axisProps} tickFormatter={v => `$${Number(v).toLocaleString()}`} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="close" stroke="#3D5AF1" strokeWidth={2} dot={false} name="Price" />
        </LineChart>
      </ResponsiveContainer>
    );

    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={displayed} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#3D5AF1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3D5AF1" stopOpacity={0}   />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E2A38" vertical={false} />
          <XAxis dataKey="date" {...axisProps} />
          <YAxis domain={['auto','auto']} {...axisProps} tickFormatter={v => `$${Number(v).toLocaleString()}`} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="close" stroke="#3D5AF1" strokeWidth={2} fill="url(#grad)" name="Price" />
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  const safe = data.length > 0 ? data : [];
  const hi   = safe.length ? Math.max(...safe.map((d:any) => d.high || 0)) : 0;
  const lo   = safe.length ? Math.min(...safe.filter((d:any) => d.low > 0).map((d:any) => d.low)) : 0;

  const chartTypeButtons = [
    { v: 'candles', icon: <BarChart2 size={15}/>,   label: 'Candles' },
    { v: 'line',    icon: <LineChartIcon size={15}/>, label: 'Line'   },
    { v: 'area',    icon: <TrendingUp size={15}/>,   label: 'Area'   },
  ];

  return (
    <GlassCard className="p-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-5 gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-semibold">{asset.symbol}/USD</h3>
          <span className={(asset.change24h ?? 0) >= 0 ? 'flex items-center text-secondary text-sm' : 'flex items-center text-red-500 text-sm'}>
            {(asset.change24h ?? 0) >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
            {(asset.change24h ?? 0) > 0 ? '+' : ''}{(asset.change24h ?? 0).toFixed(2)}%
          </span>
          <span className="text-xl font-medium">{formatCurrency(asset.price ?? 0)}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex space-x-1 bg-dark-800 rounded-lg p-1">
            {chartTypeButtons.map(b => (
              <button key={b.v}
                className={`p-2 rounded-md transition-all ${chartType === b.v ? 'bg-primary text-white' : 'text-dark-400 hover:text-light'}`}
                onClick={() => setChartType(b.v as any)} title={b.label}>{b.icon}
              </button>
            ))}
          </div>
          <div className="flex space-x-1 bg-dark-800 rounded-lg p-1">
            {TIMEFRAMES.map(tf => (
              <button key={tf}
                className={`px-3 py-1 text-sm rounded-md transition-all ${timeframe === tf ? 'bg-primary text-white' : 'text-dark-400 hover:text-light'}`}
                onClick={() => { setTimeframe(tf); onIntervalChange?.(tf); }}
              >{tf}</button>
            ))}
          </div>
          <button className="p-2 rounded-lg bg-dark-800 text-dark-400 hover:text-light" title="Download CSV" onClick={handleDownload}>
            <Download size={17}/>
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="h-96">{renderChart()}</div>

      {/* OHLCV */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { l: 'Open',   v: safe[0]?.open  || 0, c: '' },
          { l: 'High',   v: hi,                  c: 'text-secondary' },
          { l: 'Low',    v: lo,                  c: 'text-red-500' },
          { l: 'Close',  v: safe[safe.length-1]?.close || 0, c: '' },
          { l: 'Volume', v: safe.reduce((s:number,d:any)=>s+(d.volume||0),0), c: '' },
        ].map(({ l, v, c }) => (
          <div key={l} className="bg-dark-800/50 rounded-lg p-3">
            <p className="text-dark-400 text-xs mb-1">{l}</p>
            <p className={`text-sm font-semibold ${c}`}>{formatCurrency(v)}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

export default MarketChart;