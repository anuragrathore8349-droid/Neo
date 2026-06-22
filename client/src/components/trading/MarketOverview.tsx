import React, { useState, useEffect } from 'react';
import {  TrendingUp,   TrendingDown,  Star,   BarChart2,   ArrowRight } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { motion } from 'framer-motion';
import { Asset } from '../../types';
import { getMarketSummary, MarketSummary } from '../../services/market.service';
import * as marketApi from '../../services/market.service';

interface MarketOverviewProps {
  assets: Asset[];
  watchlist?: string[];
  onToggleWatchlist?: (symbol: string) => void;
}

const MarketOverview: React.FC<MarketOverviewProps> = ({ 
  assets,
  watchlist = [],
  onToggleWatchlist = () => {},
}) => {
  const [timeframe, setTimeframe] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [category, setCategory] = useState<'all' | 'crypto' | 'stocks' | 'forex' | 'commodities'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'change'>('change');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [marketSummary, setMarketSummary] = useState<MarketSummary>({
    totalMarketCap: 0,
    volume24h: 0,
    btcDominance: 0,
    fearGreedIndex: 0,
    topGainer: { name: 'N/A', symbol: 'N/A', change: 0 },
    topLoser: { name: 'N/A', symbol: 'N/A', change: 0 }
  });
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const timeframes = [
    { label: '1H', value: '1h' },
    { label: '24H', value: '24h' },
    { label: '7D', value: '7d' },
    { label: '30D', value: '30d' },
  ];

  const categories = [
    { label: 'All', value: 'all' },
    { label: 'Crypto', value: 'crypto' },
    { label: 'Stocks', value: 'stocks' },
    { label: 'Forex', value: 'forex' },
    { label: 'Commodities', value: 'commodities' },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercentage = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) return '0.00%';
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatMarketCap = (value: number | undefined) => {
    // Check for undefined, null, or NaN - NOT for 0 (0 is a valid number)
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    
    // Only show N/A if value is truly missing, not if it's 0
    if (value === 0) return '$0';
    
    if (value >= 1) {
      return `$${value.toFixed(2)}T`;
    } else if (value >= 0.001) {
      return `$${(value * 1000).toFixed(2)}B`;
    } else if (value >= 0.000001) {
      return `$${(value * 1_000_000).toFixed(2)}M`;
    } else {
      return `$${(value * 1_000_000_000).toFixed(2)}K`;
    }
  };

  const formatVolume = (value: number | undefined) => {
    // Check for undefined, null, or NaN - NOT for 0 (0 is a valid number)
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    
    // Only show N/A if value is truly missing, not if it's 0
    if (value === 0) return '$0';
    
    if (value >= 1) {
      return `$${value.toFixed(2)}B`;
    } else if (value >= 0.001) {
      return `$${(value * 1000).toFixed(2)}M`;
    } else if (value >= 0.000001) {
      return `$${(value * 1_000_000).toFixed(2)}K`;
    } else {
      return `$${(value * 1_000_000_000).toFixed(2)}`;
    }
  };



  const toggleSort = (field: 'name' | 'price' | 'change') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  // Fetch market summary when component mounts or timeframe changes
  useEffect(() => {
    const fetchMarketSummary = async () => {
      setLoadingSummary(true);
      setSummaryError(null);
      try {
        const response = await getMarketSummary(timeframe);
        if (response?.data) {
          // Silently handle zero values - they may be structurally valid
          const hasMarketCapData = response.data.totalMarketCap && response.data.totalMarketCap > 0;
          setMarketSummary(response.data);
          console.log(`✓ Market Summary loaded for ${timeframe}:`, response.data);
        } else {
          console.warn('⚠️ Market summary response missing data field');
          setSummaryError('Market summary unavailable');
        }
      } catch (error) {
        console.error(`Error fetching market summary for ${timeframe}:`, error);
        setSummaryError('Market summary unavailable');
        // Set fallback values to indicate error state
        setMarketSummary({
          totalMarketCap: 0,
          volume24h: 0,
          btcDominance: 0,
          fearGreedIndex: 0,
          topGainer: { name: 'N/A', symbol: 'N/A', change: 0 },
          topLoser: { name: 'N/A', symbol: 'N/A', change: 0 }
        });
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchMarketSummary();
  }, [timeframe]);

  // Calculate estimated change for different timeframes based on 24h change
  // This is an approximation - ideally would fetch actual data from API
  const getChangeForTimeframe = (change24h: number | undefined): number => {
    if (change24h === undefined || change24h === null || isNaN(change24h)) return 0;
    
    switch (timeframe) {
      case '1h':
        // Estimate 1h change as roughly 1/24 of daily change
        return change24h / 24;
      case '24h':
        // Use actual 24h change
        return change24h;
      case '7d':
        // Estimate 7d change as roughly 3-4x the daily change (assuming linear trend)
        return change24h * 3.5;
      case '30d':
        // Estimate 30d change as roughly 10-15x the daily change
        return change24h * 12;
      default:
        return change24h;
    }
  };

  const filteredAssets = assets.filter(asset => {
    if (category === 'all') return true;
    return asset.type === category;
  });

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    if (sortBy === 'name') {
      return sortDirection === 'asc' 
        ? a.name.localeCompare(b.name) 
        : b.name.localeCompare(a.name);
    } else if (sortBy === 'price') {
      return sortDirection === 'asc' 
        ? a.price - b.price 
        : b.price - a.price;
    } else {
      // Use timeframe-adjusted change for sorting
      return sortDirection === 'asc' 
        ? getChangeForTimeframe(a.change24h) - getChangeForTimeframe(b.change24h)
        : getChangeForTimeframe(b.change24h) - getChangeForTimeframe(a.change24h);
    }
  });

  // Market summary data is now fetched from API via useEffect above
  // No longer hardcoded - using marketSummary state variable

  // Generate deterministic sparkline based on price change
  const generateDeterministicSparkline = (change24h: number, seed: string): string => {
    const width = 80;
    const height = 30;
    const points = 20;
    // Use change24h and symbol as deterministic seed to avoid re-randomizing
    let value = 100;
    const pseudoRand = (i: number) => {
      const x = Math.sin(i * 9301 + (seed.charCodeAt(0) || 1) * 49297) * 100;
      return x - Math.floor(x);
    };

    const data: number[] = [];
    for (let i = 0; i < points; i++) {
      const trend = change24h / points;
      value += trend + (pseudoRand(i) - 0.5) * Math.abs(change24h) * 0.3;
      data.push(Math.max(value, 10));
    }

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    const pathPoints = data.map((v, index) => {
      const x = (index / (points - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    });

    return `M${pathPoints.join(' L')}`;
  };

  return (
    <GlassCard className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold">Market Overview</h3>
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
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Market Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-dark-800/50 rounded-lg p-4">
          <p className="text-dark-400 text-xs mb-1">
            {marketSummary.totalMarketCap ? 'Total Market Cap' : '24h Volume'}
          </p>
          <p className="text-2xl font-bold">
            {loadingSummary ? 'Loading...' : (
              marketSummary.totalMarketCap
                ? `$${(marketSummary.totalMarketCap / 1e12).toFixed(2)}T`
                : marketSummary.volume24h
                  ? `$${marketSummary.volume24h >= 1e9
                      ? (marketSummary.volume24h / 1e9).toFixed(2) + 'B'
                      : (marketSummary.volume24h / 1e6).toFixed(2) + 'M'}`
                  : '—'
            )}
          </p>
          {(marketSummary.marketCapChange !== undefined && marketSummary.marketCapChange !== null) && (
            <p className={`text-sm mt-1 ${marketSummary.marketCapChange >= 0 ? 'text-secondary' : 'text-red-500'}`}>
              {marketSummary.marketCapChange >= 0 ? '+' : ''}{marketSummary.marketCapChange?.toFixed(2)}%
            </p>
          )}
        </div>

        <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-700">
          <div className="flex justify-between">
            <div>
              <p className="text-dark-400 text-sm">24h Volume</p>
              <p className="text-xl font-medium">
                {loadingSummary ? 'Loading...' : formatVolume(marketSummary.volume24h)}
              </p>
            </div>
            <div className="bg-dark-700 p-2 rounded-lg">
              <BarChart2 size={18} className="text-blue-400" />
            </div>
          </div>
          <div className="mt-2 flex items-center">
            {(marketSummary.volumeChange || 0) >= 0 ? (
              <>
                <TrendingUp size={14} className="text-secondary mr-1" />
                <span className="text-secondary text-sm">{formatPercentage(marketSummary.volumeChange || 0)}</span>
              </>
            ) : (
              <>
                <TrendingDown size={14} className="text-red-500 mr-1" />
                <span className="text-red-500 text-sm">{formatPercentage(marketSummary.volumeChange || 0)}</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-700">
          <div className="flex justify-between">
            <div>
              <p className="text-dark-400 text-sm">Fear & Greed Index</p>
              <p className="text-xl font-medium">
                {loadingSummary ? 'Loading...' : marketSummary.fearGreedIndex}
              </p>
            </div>
            <div className="bg-dark-700 p-2 rounded-lg">
              <div className="h-4 w-16 bg-dark-600 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full"
                  style={{ 
                    width: `${loadingSummary ? 0 : marketSummary.fearGreedIndex || 50}%`,
                    background: 'linear-gradient(90deg, #FF4D4D 0%, #FFCC4D 50%, #4DFF77 100%)'
                  }}
                ></div>
              </div>
            </div>
          </div>
          <div className="mt-2 text-sm">
            {loadingSummary ? (
              <span className="text-dark-400">Loading...</span>
            ) : (() => {
              const index = marketSummary.fearGreedIndex || 50;
              if (index <= 24) return <span className="text-red-600 font-medium">Extreme Fear</span>;
              if (index <= 44) return <span className="text-red-500 font-medium">Fear</span>;
              if (index <= 54) return <span className="text-amber-500 font-medium">Neutral</span>;
              if (index <= 74) return <span className="text-green-500 font-medium">Greed</span>;
              return <span className="text-green-600 font-medium">Extreme Greed</span>;
            })()}
          </div>
        </div>
      </div>

      {/* Top Movers */}
      <div className="mb-6">
        <h4 className="text-lg font-medium mb-3">Top Movers</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-700 hover:border-secondary/30 transition-all cursor-pointer">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <div className="bg-secondary/20 p-2 rounded-lg mr-3">
                  <TrendingUp size={18} className="text-secondary" />
                </div>
                <div>
                  <div className="flex items-center">
                    <span className="font-medium">{marketSummary.topGainer?.symbol || 'N/A'}</span>
                    <span className="mx-1 text-dark-400">•</span>
                    <span className="text-dark-400">{marketSummary.topGainer?.name || 'N/A'}</span>
                  </div>
                  <p className="text-secondary font-medium">+{marketSummary.topGainer?.change || 0}%</p>
                </div>
              </div>
              <div className="h-8 w-20">
                <svg width="80" height="30" viewBox="0 0 80 30" className="overflow-visible">
                  <path
                    d={generateDeterministicSparkline(marketSummary.topGainer?.change ?? 5, 'topgainer')}
                    fill="none"
                    stroke="#22DFBF"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-700 hover:border-red-500/30 transition-all cursor-pointer">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <div className="bg-red-500/20 p-2 rounded-lg mr-3">
                  <TrendingDown size={18} className="text-red-500" />
                </div>
                <div>
                  <div className="flex items-center">
                    <span className="font-medium">{marketSummary.topLoser?.symbol || 'N/A'}</span>
                    <span className="mx-1 text-dark-400">•</span>
                    <span className="text-dark-400">{marketSummary.topLoser?.name || 'N/A'}</span>
                  </div>
                  <p className="text-red-500 font-medium">{marketSummary.topLoser?.change || 0}%</p>
                </div>
              </div>
              <div className="h-8 w-20">
                <svg width="80" height="30" viewBox="0 0 80 30" className="overflow-visible">
                  <path
                    d={generateDeterministicSparkline(marketSummary.topLoser?.change ?? -5, 'topLoser')}
                    fill="none"
                    stroke="#FF4D4D"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Categories */}
      <div className="flex space-x-2 mb-4 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat.value}
            className={`px-4 py-2 text-sm rounded-lg transition-all whitespace-nowrap ${
              category === cat.value
                ? 'bg-primary text-white'
                : 'bg-dark-800 text-dark-400 hover:text-light'
            }`}
            onClick={() => setCategory(cat.value as any)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Assets Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-dark-700">
              <th className="text-left py-3 px-4 text-dark-400 text-sm font-medium">
                <button 
                  className="flex items-center"
                  onClick={() => toggleSort('name')}
                >
                  Asset
                  {sortBy === 'name' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
              <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">
                <button 
                  className="flex items-center ml-auto"
                  onClick={() => toggleSort('price')}
                >
                  Price
                  {sortBy === 'price' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
              <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">
                <button 
                  className="flex items-center ml-auto"
                  onClick={() => toggleSort('change')}
                >
                  {timeframe.toUpperCase()} Change
                  {sortBy === 'change' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
              <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">Market Cap</th>
              <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">Volume (24h)</th>
              <th className="text-center py-3 px-4 text-dark-400 text-sm font-medium">Chart</th>
              <th className="text-center py-3 px-4 text-dark-400 text-sm font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {sortedAssets.map((asset) => (
              <motion.tr 
                key={asset.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="border-b border-dark-700 hover:bg-dark-800/50 cursor-pointer"
              >
                <td className="py-4 px-4">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-dark-700 flex items-center justify-center mr-3">
                      <span className="text-xs font-medium">{asset.symbol.substring(0, 2)}</span>
                    </div>
                    <div>
                      <p className="font-medium">{asset.name}</p>
                      <p className="text-dark-400 text-sm">{asset.symbol}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-right font-medium">
                  {asset.priceUnavailable
                    ? <span className="text-dark-500">—</span>
                    : formatCurrency(asset.price)}
                </td>
                <td className={`py-4 px-4 text-right font-medium ${
                  getChangeForTimeframe(asset.change24h) >= 0 ? 'text-secondary' : 'text-red-500'
                }`}>
                  <div className="flex items-center justify-end">
                    {getChangeForTimeframe(asset.change24h) >= 0 ? (
                      <TrendingUp size={16} className="mr-1" />
                    ) : (
                      <TrendingDown size={16} className="mr-1" />
                    )}
                    {formatPercentage(getChangeForTimeframe(asset.change24h))}
                  </div>
                </td>
<td className="py-3 px-4 text-right text-dark-400">
  {asset.marketCap && asset.marketCap > 0
    ? formatMarketCap(asset.marketCap)
    : asset.price && asset.price > 0
      ? <span className="text-dark-500 text-xs italic">Est. calc.</span>
      : <span className="text-dark-600 text-xs">—</span>
  }
</td>                <td className="py-3 px-4 text-right text-dark-400">
                  {asset.volume24h
                    ? asset.volume24h >= 1e9
                      ? `$${(asset.volume24h / 1e9).toFixed(2)}B`
                      : `$${(asset.volume24h / 1e6).toFixed(2)}M`
                    : <span className="text-dark-600 text-xs">No data</span>}
                </td>
                <td className="py-4 px-4">
                  <div className="h-8 w-20 mx-auto">
                    <svg width="80" height="30" viewBox="0 0 80 30" className="overflow-visible">
                      <path
                        d={generateDeterministicSparkline(asset.change24h ?? 0, asset.symbol)}
                        fill="none"
                        stroke={asset.change24h >= 0 ? "#22DFBF" : "#FF4D4D"}
                        strokeWidth="1.5"
                      />
                    </svg>
                  </div>
                </td>
                <td className="py-4 px-4 text-center">
                  <button 
                    className="p-2 rounded-full hover:bg-dark-700 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWatchlist(asset.id);
                    }}
                  >
                    <Star 
                      size={18} 
                      className={watchlist.includes(asset.id) ? 'text-amber-400 fill-amber-400' : 'text-dark-400'} 
                    />
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-between items-center">
        <p className="text-dark-400 text-sm">Showing {sortedAssets.length} assets</p>
        <button className="flex items-center text-primary text-sm font-medium hover:underline">
          View All Markets
          <ArrowRight size={16} className="ml-1" />
        </button>
      </div>
    </GlassCard>
  );
};

export default MarketOverview;
