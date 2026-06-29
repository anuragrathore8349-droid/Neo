// client/src/components/dashboard/PerformanceChart.tsx
import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import GlassCard from '../common/GlassCard';
import { ChartData } from '../../types';

interface PerformanceChartProps {
  data: ChartData[];
  onTimeframeChange?: (timeframe: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL') => void;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data: propData, onTimeframeChange }) => {
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'>('1M');
  const [chartData, setChartData] = useState<ChartData[]>(propData);
  const [loading, setLoading] = useState(false);

  const timeframes = [
    { label: '1D', value: '1D' },
    { label: '1W', value: '1W' },
    { label: '1M', value: '1M' },
    { label: '3M', value: '3M' },
    { label: '1Y', value: '1Y' },
    { label: 'ALL', value: 'ALL' },
  ];

  const handleTimeframeClick = (tf: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL') => {
    if (tf === timeframe) return;
    setTimeframe(tf);
    setLoading(true);
    if (onTimeframeChange) {
      onTimeframeChange(tf);
    }
  };

  useEffect(() => {
    if (propData && propData.length > 0) {
      setChartData(propData);
      setLoading(false);
    }
  }, [propData]);

  // ✅ FIX: Correct date format per timeframe
  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    switch (timeframe) {
      case '1D':
        // Show hours:minutes for intraday
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      case '1W':
        // Show weekday + time for weekly
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      case '1M':
      case '3M':
        // Show month + day
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case '1Y':
      case 'ALL':
        // Show month + year for long periods
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      default:
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // ✅ FIX: Correct tick interval per timeframe so labels don't pile up
  const getXAxisInterval = () => {
    const count = chartData?.length || 0;
    switch (timeframe) {
      case '1D':   return Math.max(1, Math.floor(count / 6));   // ~6 hourly ticks
      case '1W':   return Math.max(1, Math.floor(count / 7));   // 1 per day
      case '1M':   return Math.max(1, Math.floor(count / 8));   // ~4 per week
      case '3M':   return Math.max(1, Math.floor(count / 6));   // 2 per month
      case '1Y':   return Math.max(1, Math.floor(count / 12));  // 1 per month
      case 'ALL':  return Math.max(1, Math.floor(count / 10));  // spread across range
      default:     return 'preserveStartEnd';
    }
  };

  const formatTooltipLabel = (timestamp: number) => {
    const date = new Date(timestamp);
    if (timeframe === '1D') {
      return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark-800 p-3 rounded-lg border border-dark-700 shadow-lg">
          <p className="font-medium text-sm text-dark-300">{formatTooltipLabel(label)}</p>
          <p className="text-primary font-semibold">{formatValue(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <GlassCard className="p-6">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-xl font-semibold">Portfolio Performance</h3>
        </div>
        <div className="flex space-x-1 bg-dark-800 rounded-lg p-1">
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              className={`px-3 py-1 text-sm rounded-md transition-all ${
                timeframe === tf.value
                  ? 'bg-primary text-white'
                  : 'text-dark-400 hover:text-light'
              }`}
              onClick={() => handleTimeframeClick(tf.value as any)}
              disabled={loading}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !chartData || chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <p className="text-sm">No performance data available for this period.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData.length === 1
                ? [chartData[0], { ...chartData[0], timestamp: chartData[0].timestamp + 1 }]
                : chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3D5AF1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3D5AF1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#323B4E" vertical={false} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatXAxis}
                tick={{ fill: '#7C8B9B', fontSize: 11 }}
                axisLine={{ stroke: '#323B4E' }}
                tickLine={{ stroke: '#323B4E' }}
                interval={getXAxisInterval()}   // ✅ dynamic interval
              />
              <YAxis
                tickFormatter={(value) => `$${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
                tick={{ fill: '#7C8B9B', fontSize: 11 }}
                axisLine={{ stroke: '#323B4E' }}
                tickLine={{ stroke: '#323B4E' }}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3D5AF1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </GlassCard>
  );
};

export default PerformanceChart;
