import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ArrowUpRight, ArrowDownRight,
  BarChart2, LineChart as LineChartIcon, TrendingUp,
  Download, Maximize2, Minimize2,
} from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { Asset } from '../../types';

interface MarketChartProps {
  asset: Asset;
  data: any[];
  onIntervalChange?: (label: string) => void;
  /** Pass live WebSocket price to animate the current-price line */
  livePrice?: number;
}

const TIMEFRAMES = ['1H','4H','1D','1W','1M'] as const;
type TF = typeof TIMEFRAMES[number];

const MarketChart: React.FC<MarketChartProps> = ({ asset, data, onIntervalChange, livePrice }) => {
  const [timeframe, setTimeframe]   = useState<TF>('1D');
  const [chartType, setChartType]   = useState<'candles'|'line'|'area'>('candles');
  const [fullscreen, setFullscreen] = useState(false);
  const [displayPrice, setDisplayPrice] = useState(asset.price ?? 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<any>(null);
  const priceLineRef = useRef<any>(null);

  // Animate live price changes
  useEffect(() => {
    const p = livePrice ?? asset.price ?? 0;
    if (p !== displayPrice) setDisplayPrice(p);
  }, [livePrice, asset.price]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);

  const tfSlice: Record<TF, number> = {
    '1H': 12, '4H': 24, '1D': 30, '1W': 52, '1M': data.length,
  };
  const displayed = data.slice(-Math.min(data.length, tfSlice[timeframe]));

  const CHART_HEIGHT = fullscreen ? window.innerHeight - 240 : 520;

  // Update price line in real-time without full chart re-render
  useEffect(() => {
    if (!priceLineRef.current || !displayPrice) return;
    try {
      priceLineRef.current.applyOptions({ price: displayPrice });
    } catch { /* series may not support applyOptions */ }
  }, [displayPrice]);

  // Build/rebuild the lightweight-charts candle chart
  useEffect(() => {
    if (chartType !== 'candles' || !containerRef.current || displayed.length === 0) return;

    let cleanupFn: (() => void) | undefined;
    let isMounted = true;

    (async () => {
      try {
        const lwc = await import('lightweight-charts');
        if (!isMounted || !containerRef.current) return;

        if (chartRef.current) {
          try { chartRef.current.remove(); } catch { /* already disposed */ }
          chartRef.current = null;
          priceLineRef.current = null;
        }

        const el    = containerRef.current;
        const chart = (lwc as any).createChart(el, {
          layout:    { background: { color: '#0A0E1A' }, textColor: '#7C8B9B', fontSize: 12 },
          width:     el.clientWidth,
          height:    CHART_HEIGHT,
          grid:      { vertLines: { color: '#131C2E' }, horzLines: { color: '#131C2E' } },
          timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 8 },
          crosshair: { mode: 1 },
          rightPriceScale: { borderColor: '#1E2A38' },
        });
        chartRef.current = chart;

        const seriesOpts = {
          upColor: '#22DFBF', downColor: '#FF4D4D',
          borderUpColor: '#22DFBF', borderDownColor: '#FF4D4D',
          wickUpColor: '#22DFBF', wickDownColor: '#FF4D4D',
        };

        let series: any;
        if ((lwc as any).CandlestickSeries) {
          series = chart.addSeries((lwc as any).CandlestickSeries, seriesOpts);
        } else if (typeof chart.addCandlestickSeries === 'function') {
          series = chart.addCandlestickSeries(seriesOpts);
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

        // Live price dashed line
        if (displayPrice && typeof series.createPriceLine === 'function') {
          priceLineRef.current = series.createPriceLine({
            price: displayPrice, color: '#3D5AF1', lineWidth: 1,
            lineStyle: 2, axisLabelVisible: true, title: '● Live',
          });
        }

        const onResize = () => el && chart && chart.applyOptions({ width: el.clientWidth, height: CHART_HEIGHT });
        window.addEventListener('resize', onResize);

        cleanupFn = () => {
          window.removeEventListener('resize', onResize);
          try { chartRef.current?.remove(); } catch { /* disposed */ }
          chartRef.current    = null;
          priceLineRef.current = null;
        };
      } catch (err) {
        console.warn('lightweight-charts init error:', err);
      }
    })();

    return () => {
      isMounted = false;
      if (cleanupFn) cleanupFn();
      else {
        try { chartRef.current?.remove(); } catch { /* disposed */ }
        chartRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, displayed, CHART_HEIGHT]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-dark-800/95 backdrop-blur p-3 rounded-xl border border-dark-600 shadow-xl text-sm">
        <p className="font-medium mb-2 text-dark-300">{label}</p>
        {payload.map((e: any, i: number) => (
          <p key={i} style={{ color: e.color }} className="flex justify-between gap-4">
            <span>{e.name}</span><span className="font-semibold">{formatCurrency(e.value)}</span>
          </p>
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
      <div ref={containerRef} style={{ height: CHART_HEIGHT, background: '#0A0E1A', borderRadius: 8 }} />
    );

    if (chartType === 'line') return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={displayed} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#131C2E" vertical={false} />
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
              <stop offset="5%"  stopColor="#3D5AF1" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3D5AF1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#131C2E" vertical={false} />
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
  const isUp = (asset.change24h ?? 0) >= 0;

  const chartTypeButtons = [
    { v: 'candles', icon: <BarChart2 size={15}/>,    label: 'Candles' },
    { v: 'line',    icon: <LineChartIcon size={15}/>, label: 'Line'    },
    { v: 'area',    icon: <TrendingUp size={15}/>,    label: 'Area'    },
  ];

  const wrapperClass = fullscreen
    ? 'fixed inset-0 z-50 bg-dark-900 p-4 overflow-auto'
    : '';

  return (
    <div className={wrapperClass}>
      <GlassCard className="p-5">
        {/* ── Header ── */}
        <div className="flex flex-wrap justify-between items-start mb-4 gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-bold">{asset.symbol}/USD</h3>
                <span className={`flex items-center text-sm font-medium px-2 py-0.5 rounded-full ${
                  isUp ? 'bg-secondary/15 text-secondary' : 'bg-red-500/15 text-red-400'
                }`}>
                  {isUp ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>}
                  {(asset.change24h ?? 0) > 0 ? '+' : ''}{(asset.change24h ?? 0).toFixed(2)}%
                </span>
              </div>
              {/* Live price with smooth color transition */}
              <p className={`text-3xl font-bold mt-1 transition-colors duration-300 ${isUp ? 'text-secondary' : 'text-red-400'}`}>
                {formatCurrency(displayPrice)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary/10 border border-secondary/20">
              <span className="inline-block w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span className="text-xs text-secondary font-medium">LIVE</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Chart type */}
            <div className="flex space-x-1 bg-dark-800 rounded-lg p-1">
              {chartTypeButtons.map(b => (
                <button key={b.v}
                  className={`p-2 rounded-md transition-all ${chartType === b.v ? 'bg-primary text-white' : 'text-dark-400 hover:text-light'}`}
                  onClick={() => setChartType(b.v as any)} title={b.label}>{b.icon}
                </button>
              ))}
            </div>
            {/* Timeframes */}
            <div className="flex space-x-1 bg-dark-800 rounded-lg p-1">
              {TIMEFRAMES.map(tf => (
                <button key={tf}
                  className={`px-3 py-1 text-sm rounded-md transition-all ${timeframe === tf ? 'bg-primary text-white' : 'text-dark-400 hover:text-light'}`}
                  onClick={() => { setTimeframe(tf); onIntervalChange?.(tf); }}
                >{tf}</button>
              ))}
            </div>
            <button className="p-2 rounded-lg bg-dark-800 text-dark-400 hover:text-light" title="Download CSV" onClick={handleDownload}>
              <Download size={16}/>
            </button>
            <button
              className="p-2 rounded-lg bg-dark-800 text-dark-400 hover:text-light"
              title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              onClick={() => setFullscreen(f => !f)}
            >
              {fullscreen ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
            </button>
          </div>
        </div>

        {/* ── Chart ── */}
        <div style={{ height: CHART_HEIGHT }}>{renderChart()}</div>

        {/* ── OHLCV Stats ── */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { l: 'Open',   v: safe[0]?.open  || 0, c: '' },
            { l: 'High',   v: hi,                  c: 'text-secondary' },
            { l: 'Low',    v: lo,                  c: 'text-red-400' },
            { l: 'Close',  v: safe[safe.length-1]?.close || 0, c: '' },
            { l: 'Volume', v: safe.reduce((s:number,d:any)=>s+(d.volume||0),0), c: 'text-blue-400' },
          ].map(({ l, v, c }) => (
            <div key={l} className="bg-dark-800/60 rounded-xl p-3 border border-dark-700/50">
              <p className="text-dark-400 text-xs mb-1 uppercase tracking-wider">{l}</p>
              <p className={`text-sm font-bold ${c}`}>{formatCurrency(v)}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};

export default MarketChart;