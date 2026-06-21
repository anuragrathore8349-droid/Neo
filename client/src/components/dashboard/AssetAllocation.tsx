import React, { useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import GlassCard from '../common/GlassCard';
import { PortfolioAsset } from '../../types';

interface AssetAllocationProps {
  assets: PortfolioAsset[];
}

const AssetAllocation: React.FC<AssetAllocationProps> = ({ assets }) => {
  const COLORS = ['#3D5AF1', '#22DFBF', '#F7931A', '#627EEA', '#8A2BE2', '#E6007A'];
  
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
    <GlassCard className="p-6 h-full">
      <h3 className="text-xl font-semibold mb-4">Asset Allocation</h3>
      
      <div className="h-64">
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
      
      <div className="mt-4 space-y-2">
        {data.map((entry, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="h-3 w-3 rounded-full mr-2" style={{ backgroundColor: entry.color }}></div>
              <span>{entry.name}</span>
            </div>
            <span className="font-medium">{entry.value.toFixed(2)}%</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

export default AssetAllocation;