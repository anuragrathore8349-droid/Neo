import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  TrendingUp, TrendingDown, Star, Search, RefreshCw, ArrowUpDown,
  BarChart2, Filter, ChevronUp, ChevronDown
} from 'lucide-react';
import { getMarketAssets, getMarketSummary, MarketAsset } from '../../services/market.service';
import GlassCard from '../../components/common/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';

type SortKey = 'name' | 'price' | 'change24h' | 'marketCap' | 'volume24h';
type CategoryFilter = 'all' | 'crypto' | 'stock' | 'commodity' | 'forex';

const Markets: React.FC = () => {
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [filtered, setFiltered] = useState<MarketAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('marketCap');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('neo_watchlist') || '[]'); } catch { return []; }
  });
  const [marketSummary, setMarketSummary] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const socketRef = useRef<any>(null);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: v >= 1 ? 2 : 6 }).format(v);

  const formatLarge = (v?: number | null) => {
    if (v == null || isNaN(v)) return '—';
    if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6)  return `$${(v / 1e6).toFixed(2)}M`;
    return `$${v.toFixed(2)}`;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [assetsRes, summaryRes] = await Promise.allSettled([
        getMarketAssets(),
        getMarketSummary(),
      ]);
      if (assetsRes.status === 'fulfilled' && assetsRes.value?.data) {
        setAssets(assetsRes.value.data);
      } else {
        setError('Failed to load market data. Please try again.');
      }
      if (summaryRes.status === 'fulfilled' && summaryRes.value?.data) {
        setMarketSummary(summaryRes.value.data);
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Live price updates via WebSocket
  useEffect(() => {
    const stored = localStorage.getItem('neofin_auth');
    const token = stored ? JSON.parse(stored).accessToken : null;
    if (!token) return;

    const WS_URL = (import.meta as any).env?.VITE_WS_URL || window.location.origin;
    const socket = io(`${WS_URL}/market`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('price_update', (data: { symbol: string; price: number; change24h: number }) => {
      setAssets(prev => prev.map(a =>
        a.symbol === data.symbol ? { ...a, price: data.price, change24h: data.change24h } : a
      ));
    });

    socket.on('connect_error', () => {});
    return () => { socket.disconnect(); socketRef.current = null; };
  }, []);

  // Filter & sort
  useEffect(() => {
    let result = [...assets];
    if (category !== 'all') result = result.filter(a => a.type === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a => a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      let av: number, bv: number;
      switch (sortKey) {
        case 'name':    av = a.name.localeCompare(b.name); return sortDir === 'asc' ? av : -av;
        case 'price':   av = a.price; bv = b.price; break;
        case 'change24h': av = a.change24h; bv = b.change24h; break;
        case 'marketCap': av = a.marketCap ?? 0; bv = b.marketCap ?? 0; break;
        case 'volume24h': av = a.volume24h ?? 0; bv = b.volume24h ?? 0; break;
        default: av = 0; bv = 0;
      }
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    setFiltered(result);
  }, [assets, category, search, sortKey, sortDir]);

  const toggleWatchlist = (id: string) => {
    setWatchlist(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('neo_watchlist', JSON.stringify(next));
      return next;
    });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown size={13} className="opacity-40 ml-1" />;
    return sortDir === 'desc' ? <ChevronDown size={13} className="ml-1 text-primary" /> : <ChevronUp size={13} className="ml-1 text-primary" />;
  };

  const categories: { label: string; value: CategoryFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Crypto', value: 'crypto' },
    { label: 'Stocks', value: 'stock' },
    { label: 'Forex', value: 'forex' },
    { label: 'Commodities', value: 'commodity' },
  ];

  return (
    <div className="min-h-screen bg-dark-900 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold">Markets</h1>
          <p className="text-sm text-gray-400 mt-1">
            Live prices for {assets.length} assets
            {lastUpdated && <span className="ml-2 text-gray-500">· Updated {lastUpdated.toLocaleTimeString()}</span>}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:text-white hover:border-primary transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Market Summary Bar */}
      {marketSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Market Cap', value: formatLarge(marketSummary.totalMarketCap) },
            { label: '24h Volume', value: formatLarge(marketSummary.volume24h) },
            { label: 'BTC Dominance', value: marketSummary.btcDominance ? `${marketSummary.btcDominance.toFixed(1)}%` : '—' },
            { label: 'Fear & Greed', value: marketSummary.fearGreedIndex ?? '—', color: marketSummary.fearGreedIndex > 60 ? 'text-red-400' : marketSummary.fearGreedIndex < 40 ? 'text-green-400' : 'text-yellow-400' },
            { label: 'Top Gainer', value: marketSummary.topGainer ? `${marketSummary.topGainer.symbol} +${marketSummary.topGainer.change?.toFixed(2)}%` : '—', color: 'text-green-400' },
            { label: 'Top Loser', value: marketSummary.topLoser ? `${marketSummary.topLoser.symbol} ${marketSummary.topLoser.change?.toFixed(2)}%` : '—', color: 'text-red-400' },
          ].map(item => (
            <GlassCard key={item.label} className="p-3">
              <p className="text-xs text-gray-400 mb-1">{item.label}</p>
              <p className={`font-semibold text-sm ${item.color || 'text-white'}`}>{item.value}</p>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Filters */}
      <GlassCard className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search assets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-dark-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  category === cat.value
                    ? 'bg-primary text-white'
                    : 'bg-dark-800 text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 text-red-200 mb-6 flex items-center justify-between">
          <p className="text-sm">{error}</p>
          <button onClick={fetchData} className="text-xs underline text-red-300 hover:text-red-100 ml-4">Retry</button>
        </div>
      )}

      {/* Table */}
      <GlassCard className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <BarChart2 size={40} className="mb-3 opacity-30" />
            <p>No assets found{search ? ` for "${search}"` : ''}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase">
                  <th className="py-3 px-4 text-left">#</th>
                  <th className="py-3 px-4 text-left">
                    <button onClick={() => toggleSort('name')} className="flex items-center hover:text-white transition-colors">
                      Asset <SortIcon k="name" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button onClick={() => toggleSort('price')} className="flex items-center ml-auto hover:text-white transition-colors">
                      Price <SortIcon k="price" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button onClick={() => toggleSort('change24h')} className="flex items-center ml-auto hover:text-white transition-colors">
                      24h % <SortIcon k="change24h" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right hidden md:table-cell">
                    <button onClick={() => toggleSort('marketCap')} className="flex items-center ml-auto hover:text-white transition-colors">
                      Market Cap <SortIcon k="marketCap" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right hidden lg:table-cell">
                    <button onClick={() => toggleSort('volume24h')} className="flex items-center ml-auto hover:text-white transition-colors">
                      Volume (24h) <SortIcon k="volume24h" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-center w-12">★</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((asset, idx) => {
                    const positive = asset.change24h >= 0;
                    return (
                      <motion.tr
                        key={asset.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-b border-gray-800/50 hover:bg-dark-800/40 transition-colors cursor-pointer"
                      >
                        <td className="py-4 px-4 text-gray-500 text-sm">{idx + 1}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-dark-700 flex items-center justify-center font-bold text-xs text-white">
                              {asset.symbol.slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-medium text-white text-sm">{asset.name}</p>
                              <p className="text-xs text-gray-400">{asset.symbol}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right font-medium text-white text-sm">
                          {asset.price > 0 ? formatCurrency(asset.price) : <span className="text-gray-500 text-xs">—</span>}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className={`inline-flex items-center gap-1 text-sm font-medium ${positive ? 'text-green-400' : 'text-red-400'}`}>
                            {positive ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            {Math.abs(asset.change24h).toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right text-gray-300 text-sm hidden md:table-cell">
                          {formatLarge(asset.marketCap)}
                        </td>
                        <td className="py-4 px-4 text-right text-gray-300 text-sm hidden lg:table-cell">
                          {formatLarge(asset.volume24h)}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <button
                            onClick={() => toggleWatchlist(asset.id)}
                            className="p-1.5 rounded-full hover:bg-dark-700 transition-colors"
                          >
                            <Star
                              size={15}
                              className={watchlist.includes(asset.id) ? 'text-amber-400 fill-amber-400' : 'text-gray-500 hover:text-gray-300'}
                            />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
            <div className="px-4 py-3 text-xs text-gray-500 border-t border-gray-800/50">
              Showing {filtered.length} of {assets.length} assets · Prices update live via WebSocket
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
};

export default Markets;