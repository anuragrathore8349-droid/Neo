import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Search, Filter, ArrowUpDown, Eye, Star, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import GlassCard from '../../components/common/GlassCard';
import { PortfolioAsset } from '../../types';
import { motion } from 'framer-motion';
const COLORS = ['#3D5AF1', '#22DFBF', '#F7931A', '#627EEA', '#8A2BE2', '#E6007A', '#FF4D4D', '#FFCC4D'];

interface PortfolioOverviewProps {
  assets: PortfolioAsset[];
  portfolioTotalValue: number;
  onAssetSelect: (asset: PortfolioAsset) => void;
  onDeleteAsset?: (assetId: string) => void;   // ← ADD
}

const PortfolioOverview: React.FC<PortfolioOverviewProps> = ({ 
  assets, 
  portfolioTotalValue,
  onAssetSelect,
  onDeleteAsset
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'value' | 'allocation' | 'profitLoss'>('allocation');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [favoriteAssets, setFavoriteAssets] = useState<string[]>([]);

  // Colors for the pie chart
  
  // Filter assets based on search term and asset type
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
    } else if (sortBy === 'value') {
      return sortDirection === 'asc' 
        ? a.value - b.value 
        : b.value - a.value;
    } else if (sortBy === 'allocation') {
      return sortDirection === 'asc' 
        ? a.allocation - b.allocation 
        : b.allocation - a.allocation;
    } else {
      return sortDirection === 'asc' 
        ? a.profitLossPercentage - b.profitLossPercentage 
        : b.profitLossPercentage - a.profitLossPercentage;
    }
  });

  // Toggle sort
  const toggleSort = (field: 'name' | 'value' | 'allocation' | 'profitLoss') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  // Toggle favorite
  const toggleFavorite = (assetId: string) => {
    if (favoriteAssets.includes(assetId)) {
      setFavoriteAssets(favoriteAssets.filter(id => id !== assetId));
    } else {
      setFavoriteAssets([...favoriteAssets, assetId]);
    }
  };

  // Format currency
  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

const pieChartData = assets.map((asset, index) => ({
  name: asset.symbol,
  value: asset.allocation,
  color: COLORS[index % COLORS.length]  // ✅ deterministic by position
}));
  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const asset = assets.find(a => a.symbol === payload[0].name);
      return (
        <div className="bg-dark-800 p-3 rounded-lg border border-dark-700 shadow-lg">
          <p className="font-medium">{asset?.name} ({payload[0].name})</p>
          <p className="text-primary">{`${payload[0].value.toFixed(2)}%`}</p>
          <p className="text-dark-400">{formatCurrency(asset?.value || 0)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <GlassCard className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold">Assets</h3>
            <div className="flex space-x-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400" />
                <input
                  type="text"
                  placeholder="Search assets..."
                  className="input-field pl-10 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {/* Filter button — cycles asset type filter */}
              <button
                className={`p-2 rounded-lg transition-all ${
                  assetTypeFilter !== null
                    ? 'bg-primary/20 text-primary'
                    : 'bg-dark-800 text-dark-400 hover:text-light'
                }`}
                title={assetTypeFilter ? `Filter: ${assetTypeFilter}` : 'Filter by type'}
                onClick={() => {
                  const types = [null, 'crypto', 'stock', 'forex', 'commodity'];
                  const currentIndex = types.indexOf(assetTypeFilter as any);
                  const next = types[(currentIndex + 1) % types.length];
                  setAssetTypeFilter(next);
                }}
              >
                <Filter size={18} />
              </button>

              {/* Sort button — cycles sort field */}
              <button
                className="p-2 rounded-lg bg-dark-800 text-dark-400 hover:text-light"
                title={`Sort by: ${sortBy} (${sortDirection})`}
                onClick={() => {
                  const fields: Array<'name' | 'value' | 'allocation' | 'profitLoss'> =
                    ['allocation', 'value', 'profitLoss', 'name'];
                  const currentIndex = fields.indexOf(sortBy);
                  const next = fields[(currentIndex + 1) % fields.length];
                  setSortBy(next);
                  setSortDirection('desc');
                }}
              >
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
                      onClick={() => toggleSort('value')}
                    >
                      Value
                      {sortBy === 'value' && (
                        <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">
                    <button 
                      className="flex items-center ml-auto"
                      onClick={() => toggleSort('allocation')}
                    >
                      Allocation
                      {sortBy === 'allocation' && (
                        <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">
                    <button 
                      className="flex items-center ml-auto"
                      onClick={() => toggleSort('profitLoss')}
                    >
                      Profit/Loss
                      {sortBy === 'profitLoss' && (
                        <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
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
                    onClick={() => onAssetSelect(asset)}
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
                    <td className="py-4 px-4 text-right">
                      <p className="font-medium">{formatCurrency(asset.value)}</p>
                      <p className="text-dark-400 text-sm">{asset.quantity} {asset.symbol}</p>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <p className="font-medium">{asset.allocation.toFixed(2)}%</p>
                      <div className="h-1.5 w-24 ml-auto bg-dark-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full" 
                          style={{ width: `${asset.allocation}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className={`py-4 px-4 text-right font-medium ${
                      asset.profitLoss >= 0 ? 'text-secondary' : 'text-red-500'
                    }`}>
                      <div className="flex items-center justify-end">
                        {asset.profitLoss >= 0 ? (
                          <TrendingUp size={16} className="mr-1" />
                        ) : (
                          <TrendingDown size={16} className="mr-1" />
                        )}
                        {formatCurrency(asset.profitLoss)}
                      </div>
                      <p className={`text-sm ${
                        asset.profitLossPercentage >= 0 ? 'text-secondary' : 'text-red-500'
                      }`}>
                        {formatPercentage(asset.profitLossPercentage)}
                      </p>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex justify-center space-x-2">
                        <button 
                          className="p-2 rounded-full hover:bg-dark-700 transition-all"
                          onClick={(e) => { e.stopPropagation(); onAssetSelect(asset); }}
                        >
                          <Eye size={18} className="text-primary" />
                        </button>
                        <button 
                          className="p-2 rounded-full hover:bg-dark-700 transition-all"
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(asset.id); }}
                        >
                          <Star 
                            size={18} 
                            className={favoriteAssets.includes(asset.id) ? 'text-amber-400 fill-amber-400' : 'text-dark-400'} 
                          />
                        </button>
                        <button
                          className="p-2 rounded-full hover:bg-red-500/20 transition-all group"
                          title="Remove asset"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Remove ${asset.name} from your portfolio?`)) {
                              onDeleteAsset && onDeleteAsset(asset.id);
                            }
                          }}
                        >
                          <Trash2 size={18} className="text-dark-400 group-hover:text-red-400" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredAssets.length === 0 && (
            <div className="text-center py-8">
              <p className="text-dark-400">No assets found matching your filters.</p>
            </div>
          )}
        </GlassCard>
      </div>
      
      <div className="lg:col-span-1">
        <div className="grid grid-cols-1 gap-6">
          <GlassCard className="p-6">
            <h3 className="text-xl font-semibold mb-4">Asset Allocation</h3>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-4 space-y-2">
              {pieChartData.slice(0, 5).map((entry, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-3 w-3 rounded-full mr-2" style={{ backgroundColor: entry.color }}></div>
                    <span>{entry.name}</span>
                  </div>
                  <span className="font-medium">{entry.value.toFixed(2)}%</span>
                </div>
              ))}
              
              {pieChartData.length > 5 && (
                <div className="flex items-center justify-between text-dark-400">
                  <span>Others</span>
                  <span>
                    {pieChartData.slice(5).reduce((sum, entry) => sum + entry.value, 0).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </GlassCard>
          
          <GlassCard className="p-6">
            <h3 className="text-xl font-semibold mb-4">Asset Type Distribution</h3>
            
            <div className="space-y-4">
              {['crypto', 'stock', 'forex', 'commodity'].map((type) => {
                const typeAssets = assets.filter(asset => asset.type === type);
                const typeAllocation = typeAssets.reduce((sum, asset) => sum + asset.allocation, 0);
                const typeValue = typeAssets.reduce((sum, asset) => sum + asset.value, 0);
                
                return (
                  <div key={type} className="bg-dark-800/50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-medium capitalize">{type}</p>
                      <p className="text-primary">{typeAllocation.toFixed(2)}%</p>
                    </div>
                    <div className="h-1.5 w-full bg-dark-700 rounded-full overflow-hidden mb-2">
                      <div 
                        className="h-full bg-primary rounded-full" 
                        style={{ width: `${typeAllocation}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">{typeAssets.length} assets</span>
                      <span>{formatCurrency(typeValue)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
          
          <GlassCard className="p-6">
            <h3 className="text-xl font-semibold mb-4">Top Performers</h3>
            
            <div className="space-y-3">
              {assets
                .sort((a, b) => b.profitLossPercentage - a.profitLossPercentage)
                .slice(0, 3)
                .map((asset) => (
                  <div 
                    key={asset.id}
                    className="bg-dark-800/50 rounded-lg p-3 cursor-pointer hover:bg-dark-800 transition-all"
                    onClick={() => onAssetSelect(asset)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-dark-700 flex items-center justify-center mr-3">
                          <span className="text-xs font-medium">{asset.symbol.substring(0, 2)}</span>
                        </div>
                        <div>
                          <p className="font-medium">{asset.symbol}</p>
                          <p className="text-dark-400 text-xs">{asset.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${asset.profitLossPercentage >= 0 ? 'text-secondary' : 'text-red-500'}`}>
                          {formatPercentage(asset.profitLossPercentage)}
                        </p>
                        <p className="text-dark-400 text-xs">{formatCurrency(asset.profitLoss)}</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            
            <h3 className="text-xl font-semibold mt-6 mb-4">Worst Performers</h3>
            
            <div className="space-y-3">
              {assets
                .sort((a, b) => a.profitLossPercentage - b.profitLossPercentage)
                .slice(0, 3)
                .map((asset) => (
                  <div 
                    key={asset.id}
                    className="bg-dark-800/50 rounded-lg p-3 cursor-pointer hover:bg-dark-800 transition-all"
                    onClick={() => onAssetSelect(asset)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-dark-700 flex items-center justify-center mr-3">
                          <span className="text-xs font-medium">{asset.symbol.substring(0, 2)}</span>
                        </div>
                        <div>
                          <p className="font-medium">{asset.symbol}</p>
                          <p className="text-dark-400 text-xs">{asset.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${asset.profitLossPercentage >= 0 ? 'text-secondary' : 'text-red-500'}`}>
                          {formatPercentage(asset.profitLossPercentage)}
                        </p>
                        <p className="text-dark-400 text-xs">{formatCurrency(asset.profitLoss)}</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default PortfolioOverview;