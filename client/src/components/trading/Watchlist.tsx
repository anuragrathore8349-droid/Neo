import React, { useState } from 'react';
import { 
  Star, 
  TrendingUp, 
  TrendingDown, 
  BarChart2, 
  Search, 
  Filter, 
  ArrowUpDown,
  ArrowRight
} from 'lucide-react';
import GlassCard from '../common/GlassCard';
import BrowseMarket from './BrowseMarket';
import { Asset } from '../../types';
import { motion } from 'framer-motion';

interface WatchlistProps {
  assets: Asset[];
  watchlist: string[];
  onToggleWatchlist: (assetId: string) => void;
  onSelectAsset: (asset: Asset) => void;
}

const Watchlist: React.FC<WatchlistProps> = ({ 
  assets, 
  watchlist, 
  onToggleWatchlist, 
  onSelectAsset 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'change'>('change');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isBrowseMarketOpen, setIsBrowseMarketOpen] = useState(false);
  
  // Filter assets based on search term and asset type
  const filteredAssets = assets.filter(asset => {
    if (!watchlist.includes(asset.id)) return false;
    
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
  
  // Toggle sort
  const toggleSort = (field: 'name' | 'price' | 'change') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };
  
  // Format market cap
  const formatMarketCap = (value: number | undefined) => {
    if (!value) return 'N/A';
    
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
  
  return (
    <GlassCard className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold">Watchlist</h3>
        <div className="flex space-x-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400" />
            <input
              type="text"
              placeholder="Search assets..."
              className="input-field pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button className="p-2 rounded-lg bg-dark-800 text-dark-400 hover:text-light">
            <Filter size={18} />
          </button>
          
          <button className="p-2 rounded-lg bg-dark-800 text-dark-400 hover:text-light">
            <ArrowUpDown size={18} />
          </button>
        </div>
      </div>
      
      <div className="flex space-x-2 mb-4 overflow-x-auto pb-2">
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
      
      {watchlist.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl font-medium mb-2">Your watchlist is empty</p>
          <p className="text-dark-400 mb-6">Add assets to your watchlist to track them here</p>
          <button 
            onClick={() => setIsBrowseMarketOpen(true)}
            className="btn-primary"
          >
            Browse Market
          </button>
        </div>
      ) : sortedAssets.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-dark-400">No assets found matching your filters.</p>
        </div>
      ) : (
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
                    24h Change
                    {sortBy === 'change' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">Market Cap</th>
                <th className="text-center py-3 px-4 text-dark-400 text-sm font-medium">Chart</th>
                <th className="text-center py-3 px-4 text-dark-400 text-sm font-medium">Actions</th>
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
                  onClick={() => onSelectAsset(asset)}
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
                  <td className="py-4 px-4 text-right font-medium">
                    {formatCurrency(asset.price)}
                  </td>
                  <td className={`py-4 px-4 text-right font-medium ${
                    asset.change24h >= 0 ? 'text-secondary' : 'text-red-500'
                  }`}>
                    <div className="flex items-center justify-end">
                      {asset.change24h >= 0 ? (
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
                  <td className="py-4 px-4">
                    <div className="h-8 w-20 mx-auto">
                      <svg width="80" height="30" viewBox="0 0 80 30" className="overflow-visible">
                        <path
                          d={(() => {
                            const change = asset.change24h ?? 0;
                            const seed = asset.symbol;
                            const pseudoRand = (i: number) => {
                              const x = Math.sin(i * 9301 + (seed.charCodeAt(0) || 1) * 49297) * 100;
                              return x - Math.floor(x);
                            };
                            let v = 100;
                            const data: number[] = [];
                            for (let i = 0; i < 20; i++) {
                              v += (change / 20) + (pseudoRand(i) - 0.5) * Math.abs(change) * 0.3;
                              data.push(Math.max(v, 10));
                            }
                            const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
                            return `M${data.map((val, i) => `${(i / 19) * 80},${30 - ((val - min) / range) * 30}`).join(' L')}`;
                          })()}
                          fill="none"
                          stroke={asset.change24h >= 0 ? "#22DFBF" : "#FF4D4D"}
                          strokeWidth="1.5"
                        />
                      </svg>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex justify-center space-x-2">
                      <button 
                        className="px-3 py-1 text-xs rounded-lg bg-primary text-white hover:bg-primary-600 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAsset(asset);
                        }}
                      >
                        Trade
                      </button>
                      <button 
                        className="p-2 rounded-lg hover:bg-dark-700 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleWatchlist(asset.id);
                        }}
                      >
                        <Star size={16} className="text-amber-400 fill-amber-400" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="mt-6 flex justify-between items-center">
        <p className="text-dark-400 text-sm">Showing {sortedAssets.length} assets</p>
        <button 
          onClick={() => setIsBrowseMarketOpen(true)}
          className="flex items-center text-primary text-sm font-medium hover:underline"
        >
          View All Markets
          <ArrowRight size={16} className="ml-1" />
        </button>
      </div>

      {/* Browse Market Modal */}
      <BrowseMarket 
        isOpen={isBrowseMarketOpen}
        onClose={() => setIsBrowseMarketOpen(false)}
        watchlist={watchlist}
        onToggleWatchlist={onToggleWatchlist}
        onSelectAsset={onSelectAsset}
      />
    </GlassCard>
  );
};

export default Watchlist;