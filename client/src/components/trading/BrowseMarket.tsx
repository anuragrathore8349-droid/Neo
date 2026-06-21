import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Filter, ArrowUpDown, Loader, TrendingUp, TrendingDown, Star } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { Asset } from '../../types';
import * as marketApi from '../../services/market.service';
import { motion, AnimatePresence } from 'framer-motion';

interface BrowseMarketProps {
  isOpen: boolean;
  onClose: () => void;
  watchlist: string[];
  onToggleWatchlist: (assetId: string) => void;
  onSelectAsset: (asset: Asset) => void;
}

interface MarketAsset {
  id: string;
  name: string;
  symbol: string;
  type: 'crypto' | 'stock' | 'commodity' | 'forex';
  price: number;
  change24h: number;
  marketCap?: number;
  volume24h?: number;
  logo?: string;
}

const BrowseMarket: React.FC<BrowseMarketProps> = ({
  isOpen,
  onClose,
  watchlist,
  onToggleWatchlist,
  onSelectAsset
}) => {
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'change'>('change');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch market assets
  useEffect(() => {
    if (!isOpen) return;

    fetchMarketAssets();

    const refreshInterval = window.setInterval(() => {
      fetchMarketAssets();
    }, 30000); // 30-second refresh

    return () => window.clearInterval(refreshInterval);
  }, [isOpen]);

  const fetchMarketAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await marketApi.getMarketAssets();
      const marketAssets = (response.data || []) as MarketAsset[];
      setAssets(marketAssets);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error fetching market assets:', err);
      setError('Failed to load market assets. Please try again.');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort assets
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = searchTerm === '' || 
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      asset.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = assetTypeFilter === null || asset.type === assetTypeFilter;
    
    return matchesSearch && matchesType;
  });

  // Sort assets
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
      return sortDirection === 'asc' 
        ? a.change24h - b.change24h 
        : b.change24h - a.change24h;
    }
  });

  const toggleSort = (field: 'name' | 'price' | 'change') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) {
      return '$0.00';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercentage = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) {
      return '0.00%';
    }
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatMarketCap = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value) || value === 0) {
      return 'N/A';
    }
    
    if (value >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(2)}B`;
    } else if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    } else if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(2)}K`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  const handleSelectAsset = (asset: MarketAsset) => {
    const selectedAsset: Asset = {
      id: asset.id,
      name: asset.name,
      symbol: asset.symbol,
      type: asset.type,
      price: asset.price ?? 0,
      change24h: asset.change24h ?? 0,
      marketCap: asset.marketCap,
      volume24h: asset.volume24h,
      logo: asset.logo
    };
    onSelectAsset(selectedAsset);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="bg-dark-900 rounded-xl border border-dark-700 max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-dark-700">
            <div className="flex flex-col">
              <h2 className="text-2xl font-bold">Browse Market</h2>
              {lastUpdated && (
                <span className="text-xs text-dark-500">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-dark-800 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Search and Filters */}
            <div className="mb-6 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400" />
                  <input
                    type="text"
                    placeholder="Search assets by name or symbol..."
                    className="input-field pl-10 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Type Filters */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  className={`px-3 py-1 text-sm rounded-lg transition-all whitespace-nowrap ${
                    assetTypeFilter === null ? 'bg-primary text-white' : 'bg-dark-800 text-dark-400 hover:text-light'
                  }`}
                  onClick={() => setAssetTypeFilter(null)}
                >
                  All
                </button>
                <button
                  className={`px-3 py-1 text-sm rounded-lg transition-all whitespace-nowrap ${
                    assetTypeFilter === 'crypto' ? 'bg-primary text-white' : 'bg-dark-800 text-dark-400 hover:text-light'
                  }`}
                  onClick={() => setAssetTypeFilter('crypto')}
                >
                  Crypto
                </button>
                <button
                  className={`px-3 py-1 text-sm rounded-lg transition-all whitespace-nowrap ${
                    assetTypeFilter === 'stock' ? 'bg-primary text-white' : 'bg-dark-800 text-dark-400 hover:text-light'
                  }`}
                  onClick={() => setAssetTypeFilter('stock')}
                >
                  Stocks
                </button>
                <button
                  className={`px-3 py-1 text-sm rounded-lg transition-all whitespace-nowrap ${
                    assetTypeFilter === 'forex' ? 'bg-primary text-white' : 'bg-dark-800 text-dark-400 hover:text-light'
                  }`}
                  onClick={() => setAssetTypeFilter('forex')}
                >
                  Forex
                </button>
                <button
                  className={`px-3 py-1 text-sm rounded-lg transition-all whitespace-nowrap ${
                    assetTypeFilter === 'commodity' ? 'bg-primary text-white' : 'bg-dark-800 text-dark-400 hover:text-light'
                  }`}
                  onClick={() => setAssetTypeFilter('commodity')}
                >
                  Commodities
                </button>
              </div>
            </div>

            {/* Loading State */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader size={32} className="animate-spin text-primary" />
              </div>
            ) : error ? (
              <GlassCard className="p-6 bg-red-500/10 border-red-500/50">
                <p className="text-red-500">{error}</p>
                <button
                  onClick={fetchMarketAssets}
                  className="mt-4 btn-primary"
                >
                  Retry
                </button>
              </GlassCard>
            ) : sortedAssets.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-dark-400 text-lg">No assets found matching your search.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b border-dark-700">
                      <th className="text-left py-3 px-4 text-dark-400 text-sm font-medium">
                        <button 
                          className="flex items-center hover:text-light transition-colors"
                          onClick={() => toggleSort('name')}
                        >
                          Asset
                          {sortBy === 'name' && (
                            <span className="ml-2">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </button>
                      </th>
                      <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">
                        <button 
                          className="flex items-center ml-auto hover:text-light transition-colors"
                          onClick={() => toggleSort('price')}
                        >
                          Price
                          {sortBy === 'price' && (
                            <span className="ml-2">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </button>
                      </th>
                      <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">
                        <button 
                          className="flex items-center ml-auto hover:text-light transition-colors"
                          onClick={() => toggleSort('change')}
                        >
                          24h Change
                          {sortBy === 'change' && (
                            <span className="ml-2">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </button>
                      </th>
                      <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">Market Cap</th>
                      <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">24h Volume</th>
                      <th className="text-center py-3 px-4 text-dark-400 text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAssets.map((asset) => (
                      <motion.tr 
                        key={asset.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-dark-700 hover:bg-dark-800/50 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-dark-700 flex items-center justify-center mr-3">
                              <span className="text-xs font-medium">{asset.symbol.substring(0, 2).toUpperCase()}</span>
                            </div>
                            <div>
                              <p className="font-medium">{asset.name}</p>
                              <p className="text-dark-400 text-sm">{asset.symbol.toUpperCase()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right font-medium">
                          {formatCurrency(asset.price ?? 0)}
                        </td>
                        <td className={`py-4 px-4 text-right font-medium ${
                          (asset.change24h ?? 0) >= 0 ? 'text-secondary' : 'text-red-500'
                        }`}>
                          <div className="flex items-center justify-end">
                            {(asset.change24h ?? 0) >= 0 ? (
                              <TrendingUp size={16} className="mr-1" />
                            ) : (
                              <TrendingDown size={16} className="mr-1" />
                            )}
                            {formatPercentage(asset.change24h)}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          {formatMarketCap(asset.marketCap)}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {formatMarketCap(asset.volume24h)}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex justify-center gap-2">
                            <button 
                              className="px-3 py-1 text-xs rounded-lg bg-primary text-white hover:bg-primary-600 transition-all"
                              onClick={() => handleSelectAsset(asset)}
                            >
                              Trade
                            </button>
                            <button 
                              className="p-2 rounded-lg hover:bg-dark-700 transition-all"
                              onClick={() => onToggleWatchlist(asset.id)}
                              title={watchlist.includes(asset.id) ? 'Remove from watchlist' : 'Add to watchlist'}
                            >
                              <Star 
                                size={16} 
                                className={watchlist.includes(asset.id) ? 'text-amber-400 fill-amber-400' : 'text-dark-400'} 
                              />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Results Count */}
            {!loading && !error && (
              <div className="mt-6 text-dark-400 text-sm">
                Showing {sortedAssets.length} of {assets.length} assets
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BrowseMarket;
