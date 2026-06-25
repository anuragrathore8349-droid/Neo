import React, { useState, useEffect } from 'react';
import { Star, BarChart2, ArrowRight, ChevronUp, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../common/GlassCard';
import { motion } from 'framer-motion';
import { Asset } from '../../types';
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
  const navigate = useNavigate();
  const [timeframe, setTimeframe] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [category, setCategory] = useState<'all' | 'crypto' | 'stocks' | 'forex' | 'commodities'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'change'>('change');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [localWatchlist, setLocalWatchlist] = useState<Set<string>>(new Set());
  const [assetsForDisplay, setAssetsForDisplay] = useState<Asset[]>(assets);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [marketSummary, setMarketSummary] = useState<marketApi.MarketSummary>({
    totalMarketCap: 0, volume24h: 0, btcDominance: 0, fearGreedIndex: 0,
    topGainer: { name: 'N/A', symbol: 'N/A', change: 0 },
    topLoser: { name: 'N/A', symbol: 'N/A', change: 0 },
  });
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Load watchlist from localStorage on mount
  useEffect(() => {
    const savedWatchlist = localStorage.getItem('marketWatchlist');
    if (savedWatchlist) {
      try {
        const saved = JSON.parse(savedWatchlist);
        const merged = new Set<string>(Array.isArray(saved) ? saved : []);
        if (watchlist.length > 0) {
          watchlist.forEach(symbol => merged.add(symbol));
        }
        setLocalWatchlist(merged);
      } catch (e) {
        console.error('Error loading watchlist:', e);
      }
    } else if (watchlist.length > 0) {
      setLocalWatchlist(new Set(watchlist));
    }
  }, [watchlist]);

  // Save watchlist to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('marketWatchlist', JSON.stringify(Array.from(localWatchlist)));
  }, [localWatchlist]);

  const toggleLocalWatchlist = (assetId: string) => {
    setLocalWatchlist(prev => {
      const newWatchlist = new Set(prev);
      if (newWatchlist.has(assetId)) {
        newWatchlist.delete(assetId);
      } else {
        newWatchlist.add(assetId);
      }
      return newWatchlist;
    });
    onToggleWatchlist(assetId);
  };

  const timeframes = [
    { label: '1H', value: '1h' }, { label: '24H', value: '24h' },
    { label: '7D', value: '7d' }, { label: '30D', value: '30d' },
  ] as const;
  const categories = [
    { label: 'All', value: 'all' }, { label: 'Crypto', value: 'crypto' },
    { label: 'Stocks', value: 'stocks' }, { label: 'Forex', value: 'forex' },
    { label: 'Commodities', value: 'commodities' },
  ] as const;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

  const formatPercentage = (value?: number) => {
    if (value === undefined || value === null || isNaN(value)) return '0.00%';
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatMarketCap = (value?: number) => {
    if (value === undefined || value === null || isNaN(value) || value === 0) return '—';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toFixed(2)}`;
  };

  useEffect(() => {
    const fetchSummary = async () => {
      setLoadingSummary(true);
      try {
        const response = await marketApi.getMarketSummary();
        if (response?.data) setMarketSummary(response.data);
      } catch (error) {
        console.error('Error fetching market summary:', error);
      } finally { setLoadingSummary(false); }
    };
    fetchSummary();
    const interval = setInterval(fetchSummary, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchAssetsForTimeframe = async () => {
      setAssetsLoading(true);
      try {
        const response = await marketApi.getMarketAssetsWithTimeframe(timeframe);
        if (response?.data && Array.isArray(response.data) && response.data.length > 0) {
          setAssetsForDisplay(response.data as Asset[]);
        }
      } catch (error) {
        console.error('Error fetching market assets for timeframe:', error);
        setAssetsForDisplay(assets);
      } finally {
        setAssetsLoading(false);
      }
    };

    fetchAssetsForTimeframe();
  }, [timeframe, assets]);

  // Sync with incoming prop changes (initial load)
  useEffect(() => {
    if (assets && assets.length > 0 && assetsForDisplay.length === 0) {
      setAssetsForDisplay(assets);
    }
  }, [assets, assetsForDisplay.length]);

  const filteredAssets = assetsForDisplay.filter(asset => {
    if (category === 'all') return true;
    if (category === 'crypto') return asset.type === 'crypto';
    if (category === 'stocks') return asset.type === 'stock';
    if (category === 'forex') return asset.type === 'forex';
    if (category === 'commodities') return asset.type === 'commodity';
    return true;
  });

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    if (sortBy === 'name') {
      return sortDirection === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    }
    if (sortBy === 'price') {
      return sortDirection === 'asc' ? a.price - b.price : b.price - a.price;
    }
    const aChange = a.change24h ?? 0;
    const bChange = b.change24h ?? 0;
    return sortDirection === 'asc' ? aChange - bChange : bChange - aChange;
  });

  // Deterministic sparkline based on change
  const generateSparkline = (change: number, symbol: string) => {
    const seed = symbol.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const points: [number, number][] = [];
    let y = 15;
    for (let i = 0; i <= 8; i++) {
      const noise = ((seed * (i + 1) * 13) % 7) - 3;
      y = Math.max(2, Math.min(28, y + noise));
      points.push([i * 10, y]);
    }
    const endY = change >= 0 ? 5 : 25;
    points[points.length - 1][1] = endY;
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  };

  return (
    <GlassCard className="p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        <div className="flex items-center gap-2">
          <BarChart2 size={20} className="text-primary" />
          <h3 className="text-lg sm:text-xl font-semibold text-white">Market Overview</h3>
        </div>
        <div className="flex gap-1 flex-wrap sm:flex-nowrap">
          {timeframes.map(tf => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                timeframe === tf.value 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'text-gray-400 hover:text-white bg-dark-800/40 hover:bg-dark-800'
              }`}
            >
              {tf.label}
            </button>
          ))}
          {(assetsLoading || loadingSummary) && (
            <span className="text-xs text-gray-400 self-center ml-3">
              {assetsLoading ? 'Loading assets…' : 'Refreshing summary…'}
            </span>
          )}
        </div>
      </div>

      {/* Market Summary */}
      {((marketSummary.totalMarketCap ?? 0) > 0 || (marketSummary.btcDominance ?? 0) > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
          {[
            { label: 'Market Cap', val: marketSummary.totalMarketCap >= 1e12 ? `$${(marketSummary.totalMarketCap / 1e12).toFixed(2)}T` : formatMarketCap(marketSummary.totalMarketCap) },
            { label: '24h Volume', val: marketSummary.volume24h >= 1e9 ? `$${(marketSummary.volume24h / 1e9).toFixed(1)}B` : formatMarketCap(marketSummary.volume24h) },
            { label: 'BTC Dom.', val: marketSummary.btcDominance ? `${marketSummary.btcDominance.toFixed(1)}%` : '—' },
            { label: 'Fear & Greed', val: marketSummary.fearGreedIndex ?? '—', color: (marketSummary.fearGreedIndex ?? 50) > 60 ? 'text-red-400' : (marketSummary.fearGreedIndex ?? 50) < 40 ? 'text-green-400' : 'text-yellow-400' },
          ].map(item => (
            <div key={item.label} className="bg-dark-800/50 rounded-lg p-3 border border-dark-700/40 hover:border-dark-700/60 transition-all">
              <p className="text-xs text-gray-500 mb-1 uppercase font-medium">{item.label}</p>
              <p className={`text-sm font-bold ${item.color || 'text-white'}`}>{item.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Category Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value as typeof category)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              category === cat.value 
                ? 'bg-primary/20 text-primary border border-primary/40' 
                : 'text-gray-400 hover:text-gray-200 bg-dark-800/30 hover:bg-dark-800/60 border border-transparent'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-dark-700/50 bg-dark-900/30">
        <table className="w-full min-w-[550px]">
          <thead>
            <tr className="text-xs text-gray-400 uppercase border-b border-dark-700/50 bg-dark-800/30">
              <th className="py-3 px-4 text-left font-semibold">
                <button onClick={() => { setSortBy('name'); setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); }}
                  className="flex items-center gap-1 hover:text-gray-300 transition-colors">
                  Asset
                  {sortBy === 'name' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                </button>
              </th>
              <th className="py-3 px-4 text-right font-semibold">
                <button onClick={() => { setSortBy('price'); setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); }}
                  className="flex items-center gap-1 ml-auto hover:text-gray-300 transition-colors">
                  Price
                  {sortBy === 'price' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                </button>
              </th>
              <th className="py-3 px-4 text-right font-semibold">
                <button onClick={() => { setSortBy('change'); setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); }}
                  className="flex items-center gap-1 ml-auto hover:text-gray-300 transition-colors">
                  {timeframe.toUpperCase()} Change
                  {sortBy === 'change' && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                </button>
              </th>
              <th className="py-3 px-4 text-right font-semibold hidden md:table-cell">Market Cap</th>
              <th className="py-3 px-4 text-center font-semibold">Trend</th>
              <th className="py-3 px-4 text-center font-semibold w-12">Watchlist</th>
            </tr>
          </thead>
          <tbody>
            {sortedAssets.slice(0, 10).map((asset, idx) => {
              const change = asset.change24h ?? 0;
              const positive = change >= 0;
              return (
                <motion.tr
                  key={asset.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  className="border-b border-dark-700/40 hover:bg-dark-800/60 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/markets?symbol=${asset.symbol}`)}
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-dark-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {asset.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm truncate">{asset.name}</p>
                        <p className="text-xs text-gray-500">{asset.symbol}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-white text-sm">
                    {asset.price > 0 ? formatCurrency(asset.price) : <span className="text-gray-500 text-xs">—</span>}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className={`inline-flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded-lg ${positive ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                      {positive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {formatPercentage(change)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right text-gray-400 text-sm hidden md:table-cell">
                    {formatMarketCap(asset.marketCap)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <svg width="70" height="28" viewBox="0 0 80 30" className="mx-auto overflow-visible opacity-70 group-hover:opacity-100 transition-opacity">
                      <path
                        d={generateSparkline(change, asset.symbol)}
                        fill="none"
                        stroke={positive ? '#4ade80' : '#f87171'}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={e => { e.stopPropagation(); toggleLocalWatchlist(asset.id); }}
                      className="p-1.5 rounded-lg hover:bg-dark-700/80 transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                      title={localWatchlist.has(asset.id) ? 'Remove from watchlist' : 'Add to watchlist'}
                    >
                      <Star
                        size={16}
                        fill={localWatchlist.has(asset.id) ? 'currentColor' : 'none'}
                        className={localWatchlist.has(asset.id) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'}
                      />
                    </button>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between items-center px-1">
        <p className="text-xs text-gray-500 font-medium">Showing {Math.min(10, sortedAssets.length)} of {sortedAssets.length} assets</p>
        <button
          onClick={() => navigate('/markets')}
          className="flex items-center gap-2 text-primary text-xs sm:text-sm font-semibold hover:text-primary/80 transition-colors px-2 py-1 rounded-lg hover:bg-dark-800/30"
        >
          View All Markets
          <ArrowRight size={16} />
        </button>
      </div>
    </GlassCard>
  );
};

export default MarketOverview;
