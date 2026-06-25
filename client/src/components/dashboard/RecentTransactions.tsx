import React from 'react';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../common/GlassCard';
import { Transaction } from '../../types';

interface RecentTransactionsProps {
  transactions: Transaction[];
  onViewAll?: () => void;
}

const RecentTransactions: React.FC<RecentTransactionsProps> = ({ transactions, onViewAll }) => {
  const navigate = useNavigate();

  const handleViewAll = () => {
    if (onViewAll) {
      onViewAll();
    } else {
      // Navigate to portfolio page and trigger the transactions tab
      navigate('/portfolio?tab=transactions');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'buy':
        return <ArrowDownLeft size={16} className="text-secondary" />;
      case 'sell':
        return <ArrowUpRight size={16} className="text-red-500" />;
      case 'transfer':
        return <RefreshCw size={16} className="text-blue-400" />;
      case 'swap':
        return <RefreshCw size={16} className="text-amber-500" />;
      case 'stake':
      case 'unstake':
        return <Zap size={16} className="text-purple-500" />;
      default:
        return <RefreshCw size={16} className="text-primary" />;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <GlassCard className="p-6">
      <h3 className="text-xl font-semibold mb-4">Recent Transactions</h3>

      {transactions.length === 0 ? (
        <div className="text-center py-6 text-dark-400 text-sm">
          No recent transactions found.
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.slice(0, 5).map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-all cursor-pointer"
            >
              <div className="flex items-center">
                <div className="bg-dark-700 p-2 rounded-lg mr-3">
                  {getIcon(transaction.type)}
                </div>
                <div>
                  <div className="flex items-center">
                    <span className="font-medium capitalize">{transaction.type}</span>
                    <span className="mx-1 text-dark-400">•</span>
                    <span className="text-dark-400">{transaction.asset.symbol}</span>
                  </div>
                  <p className="text-xs text-dark-400">{formatDate(transaction.date)}</p>
                </div>
              </div>

              <div className="text-right">
                <p className="font-medium">
                  {transaction.type === 'buy' ? '-' : transaction.type === 'sell' ? '+' : ''}
                  {formatCurrency(transaction.total)}
                </p>
                <p className="text-xs text-dark-400">
                  {transaction.quantity} {transaction.asset.symbol}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleViewAll}
        className="w-full mt-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-all"
      >
        View All Transactions
      </button>
    </GlassCard>
  );
};

export default RecentTransactions;
