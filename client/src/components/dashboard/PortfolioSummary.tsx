import React from 'react';
import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { PortfolioSummary as PortfolioSummaryType } from '../../types';

interface PortfolioSummaryProps {
  data: PortfolioSummaryType | null;
}

const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({ data }) => {
  const formatCurrency = (value?: number | null) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercentage = (value?: number | null) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Handle null/undefined data
  if (!data) {
    return (
      <GlassCard className="p-6" gradient>
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-semibold">Portfolio Value</h3>
              <p className="text-3xl font-bold mt-1 text-gray-500">—</p>
              <div className="flex items-center mt-1">
                <span className="text-gray-500 text-sm">Loading portfolio data...</span>
              </div>
            </div>
            <div className="bg-dark-800/50 p-3 rounded-lg">
              <TrendingUp size={24} className="text-gray-600" />
            </div>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6" gradient>
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-semibold">Portfolio Value</h3>
            <p className="text-3xl font-bold mt-1">{formatCurrency(data.totalValue)}</p>
            <div className="flex items-center mt-1">
              {data.dailyChange >= 0 ? (
                <ArrowUpRight size={16} className="text-secondary mr-1" />
              ) : (
                <ArrowDownRight size={16} className="text-red-500 mr-1" />
              )}
              <span className={data.dailyChange >= 0 ? 'text-secondary' : 'text-red-500'}>
                {formatPercentage(data.dailyChangePercentage)} today
              </span>
            </div>
          </div>
          <div className="bg-dark-800/50 p-3 rounded-lg">
            <TrendingUp size={24} className="text-primary" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-dark-700">
          <div>
            <p className="text-dark-400 text-sm">Daily Change</p>
            <p className={`text-lg font-medium ${data.dailyChange >= 0 ? 'text-secondary' : 'text-red-500'}`}>
              {formatCurrency(data.dailyChange)}
            </p>
          </div>
          <div>
            <p className="text-dark-400 text-sm">Weekly Change</p>
            <p className={`text-lg font-medium ${data.weeklyChange >= 0 ? 'text-secondary' : 'text-red-500'}`}>
              {formatCurrency(data.weeklyChange)}
            </p>
          </div>
          <div>
            <p className="text-dark-400 text-sm">Monthly Change</p>
            <p className={`text-lg font-medium ${data.monthlyChange >= 0 ? 'text-secondary' : 'text-red-500'}`}>
              {formatCurrency(data.monthlyChange)}
            </p>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

export default PortfolioSummary;