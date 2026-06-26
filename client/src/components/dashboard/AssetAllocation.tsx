import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Star } from 'lucide-react';
import { motion } from 'framer-motion';
import GlassCard from '../common/GlassCard';
import { PortfolioAsset } from '../../types';

interface AssetAllocationProps {
  assets: PortfolioAsset[];
}

const AssetAllocation: React.FC<AssetAllocationProps> = ({ assets }) => {
  const COLORS = ['#3D5AF1', '#22DFBF', '#F7931A', '#627EEA', '#8A2BE2', '#E6007A'];
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  
  // Load favorites from localStorage on mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem('favoriteAssets');
    if (savedFavorites) {
      try {
        setFavorites(new Set(JSON.parse(savedFavorites)));
      } catch (e) {
        console.error('Error loading favorites:', e);
      }
    }
  }, []);
  
  // Save favorites to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('favoriteAssets', JSON.stringify(Array.from(favorites)));
  }, [favorites]);
  
  const toggleFavorite = (symbol: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(symbol)) {
        newFavorites.delete(symbol);
      } else {
        newFavorites.add(symbol);
      }
      return newFavorites;
    });
  };
  
  // Filter assets with non-zero allocation and log for debugging
  const validAssets = assets.filter(asset => (asset.allocation || 0) > 0);
  
  useEffect(() => {
    console.log('✓ AssetAllocation component received assets:', {
      totalAssets: assets.length,
      validAssets: validAssets.length,
      data: assets.map(a => ({ symbol: a.symbol, allocation: a.allocation, value: a.value }))
    });
  }, [assets, validAssets.length]);
  
  const data = validAssets.map((asset, index) => ({
    name: asset.symbol,
    value: asset.allocation || 0,
    color: COLORS[index % COLORS.length]
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark-800 p-3 rounded-lg border border-dark-700 shadow-lg">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-primary">{`${payload[0].value.toFixed(2)}%`}</p>
        </div>
      );
    }
    return null;
  };

  // Show placeholder if no valid allocation data
  if (data.length === 0) {
    return (
      <GlassCard className="p-6 h-full">
        <h3 className="text-xl font-semibold mb-4">Asset Allocation</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          <p>No assets with allocation data. Add assets to your portfolio.</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4 sm:p-6 h-full">
      <h3 className="text-lg sm:text-xl font-semibold mb-4">Asset Allocation</h3>
      
      <div className="h-48 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-3 sm:mt-4 space-y-2">
        {data.map((entry, index) => {
          const asset = validAssets[index];
          const isFavorite = favorites.has(entry.name);
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between hover:bg-dark-800/50 p-2.5 sm:p-3 rounded-lg transition-all border border-transparent hover:border-dark-700 group cursor-pointer"
            >
              <div className="flex items-center gap-2 sm:gap-3 flex-grow min-w-0">
                <div
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-semibold text-xs sm:text-sm"
                  style={{ backgroundColor: entry.color + '20', borderLeft: `3px solid ${entry.color}` }}
                >
                  {entry.name.substring(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{entry.name}</p>
                  <div className="h-1.5 w-16 sm:w-20 bg-dark-700 rounded-full overflow-hidden mt-1">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ backgroundColor: entry.color, width: `${Math.min(entry.value, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-2">
                <div className="text-right">
                  <p className="font-semibold text-xs sm:text-sm text-white">{entry.value.toFixed(2)}%</p>
                  {asset && (
                    <p className="text-xs text-gray-400">${(asset.value / 1000).toFixed(1)}k</p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(entry.name); }}
                  className="p-1.5 sm:p-2 rounded-lg hover:bg-dark-700/80 transition-all flex-shrink-0 opacity-0 group-hover:opacity-100 sm:opacity-100"
                  title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star
                    size={16}
                    fill={isFavorite ? 'currentColor' : 'none'}
                    className={isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'}
                  />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </GlassCard>
  );
};

export default AssetAllocation;