import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import GlassCard from '../common/GlassCard';
import { ChartData } from '../../types';

interface PerformanceChartProps {
  data: ChartData[];
  onTimeframeChange?: (timeframe: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL') => void;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data: initialData, onTimeframeChange }) => {
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'>('1M');
  const [chartData, setChartData] = useState<ChartData[]>(initialData);
  const [loading, setLoading] = useState(false);
  
  const timeframes = [
    { label: '1D', value: '1D' },
    { label: '1W', value: '1W' },
    { label: '1M', value: '1M' },
    { label: '3M', value: '3M' },
    { label: '1Y', value: '1Y' },
    { label: 'ALL', value: 'ALL' },
  ];

  // Filter data based on selected timeframe
  useEffect(() => {
    setLoading(true);
    try {
      // Call parent callback to fetch new data for this timeframe
      if (onTimeframeChange) {
        onTimeframeChange(timeframe);
      }
      console.log(`✓ Portfolio Performance timeframe changed to: ${timeframe}`);
    } catch (error) {
      console.error('Error changing timeframe:', error);
    } finally {
      setLoading(false);
    }
  }, [timeframe, onTimeframeChange]);

  // Update chart data when data prop changes
  useEffect(() => {
    if (initialData && initialData.length > 0) {
      setChartData(initialData);
    }
  }, [initialData]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
          <p className="font-medium">{formatDate(label)}</p>
          <p className="text-primary">{formatValue(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <GlassCard className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold">Portfolio Performance</h3>
        <div className="flex space-x-1 bg-dark-800 rounded-lg p-1">
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              className={`px-3 py-1 text-sm rounded-md transition-all ${
                timeframe === tf.value
                  ? 'bg-primary text-white'
                  : 'text-dark-400 hover:text-light'
              }`}
              onClick={() => setTimeframe(tf.value as any)}
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
            <div className="text-dark-400">Loading...</div>
          </div>
        ) : !chartData || chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <p className="text-sm">No history yet — add assets to your portfolio to see performance.</p>
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
                tickFormatter={formatDate} 
                tick={{ fill: '#7C8B9B' }}
                axisLine={{ stroke: '#323B4E' }}
                tickLine={{ stroke: '#323B4E' }}
              />
              <YAxis 
                tickFormatter={(value) => `$${value}`} 
                tick={{ fill: '#7C8B9B' }}
                axisLine={{ stroke: '#323B4E' }}
                tickLine={{ stroke: '#323B4E' }}
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