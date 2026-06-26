import React from 'react';
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Calendar, BarChart2 } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { PortfolioSummary as PortfolioSummaryType } from '../../types';

interface PortfolioSummaryProps {
  data: PortfolioSummaryType | null;
}

const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({ data }) => {
  const fmt = (value?: number | null) => {
    if (value == null || isNaN(value)) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
  };

  const fmtPct = (value?: number | null) => {
    if (value == null || isNaN(value)) return '—';
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  if (!data) {
    return (
      <GlassCard className="p-5" gradient>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Portfolio Value</p>
            <div className="h-8 w-40 bg-dark-700/50 rounded-lg animate-pulse" />
          </div>
          <div className="w-9 h-9 rounded-xl bg-dark-700/50 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-dark-700/50">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 bg-dark-700/30 rounded-lg animate-pulse" />
          ))}
        </div>
      </GlassCard>
    );
  }

  const dailyPos = data.dailyChange >= 0;
  const allTimePos = (data.allTimeProfit ?? 0) >= 0;

  const stats = [
    { label: 'Daily', value: fmt(data.dailyChange), pct: fmtPct(data.dailyChangePercentage), positive: dailyPos, icon: <Calendar size={13} /> },
    { label: 'Weekly', value: fmt(data.weeklyChange), pct: fmtPct(data.weeklyChangePercentage), positive: data.weeklyChange >= 0, icon: <BarChart2 size={13} /> },
    { label: 'Monthly', value: fmt(data.monthlyChange), pct: fmtPct(data.monthlyChangePercentage), positive: data.monthlyChange >= 0, icon: <TrendingUp size={13} /> },
    { label: 'All Time', value: fmt(data.allTimeProfit), pct: fmtPct(data.allTimeProfitPercentage), positive: allTimePos, icon: <DollarSign size={13} /> },
  ];

  return (
    <GlassCard className="p-5" gradient>
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Portfolio Value</p>
          <p className="text-2xl sm:text-3xl font-bold text-white truncate">{fmt(data.totalValue)}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {dailyPos
              ? <ArrowUpRight size={15} className="text-green-400 flex-shrink-0" />
              : <ArrowDownRight size={15} className="text-red-400 flex-shrink-0" />}
            <span className={`text-sm font-medium ${dailyPos ? 'text-green-400' : 'text-red-400'}`}>
              {fmtPct(data.dailyChangePercentage)} today
            </span>
            <span className="text-gray-500 text-xs sm:text-sm">({fmt(data.dailyChange)})</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <TrendingUp size={20} className="text-primary" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-5 pt-4 border-t border-dark-700/40">
        {stats.map(stat => (
          <div key={stat.label} className="bg-dark-800/30 rounded-xl p-2 sm:p-3">
            <div className="flex items-center gap-1 text-gray-400 mb-1 text-xs">
              {stat.icon}
              <span className="truncate">{stat.label}</span>
            </div>
            <p className={`text-xs sm:text-sm font-semibold truncate ${stat.positive ? 'text-green-400' : 'text-red-400'}`}>{stat.value}</p>
            <p className={`text-xs ${stat.positive ? 'text-green-400/70' : 'text-red-400/70'}`}>{stat.pct}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

export default PortfolioSummary;