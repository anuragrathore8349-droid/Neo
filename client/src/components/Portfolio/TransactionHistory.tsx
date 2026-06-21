import React, { useState } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Zap, 
  Filter, 
  Calendar, 
  Download, 
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import GlassCard from '../../components/common/GlassCard';
import { Transaction } from '../../types';
import { motion } from 'framer-motion';

interface TransactionHistoryProps {
  transactions: Transaction[];
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ transactions }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d' | 'custom'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsPerPage = 10;
  
  // Get transaction types
  const transactionTypes = Array.from(new Set(transactions.map(t => t.type)));
  
  // Filter transactions
  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = searchTerm === '' || 
      transaction.asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      transaction.asset.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === null || transaction.type === typeFilter;
    
    let matchesDate = true;
    if (dateRange !== 'all' && dateRange !== 'custom') {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      matchesDate = new Date(transaction.date) >= cutoffDate;
    }
    
    return matchesSearch && matchesType && matchesDate;
  });
  
  // Sort transactions by date (newest first)
  const sortedTransactions = [...filteredTransactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  // Pagination
  const indexOfLastTransaction = currentPage * transactionsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
  const currentTransactions = sortedTransactions.slice(indexOfFirstTransaction, indexOfLastTransaction);
  const totalPages = Math.ceil(sortedTransactions.length / transactionsPerPage);
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Get icon for transaction type
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
  
  // Calculate total values
  const totalBought = transactions
    .filter(t => t.type === 'buy')
    .reduce((sum, t) => sum + t.total, 0);
    
  const totalSold = transactions
    .filter(t => t.type === 'sell')
    .reduce((sum, t) => sum + t.total, 0);
    
  const totalFees = transactions
    .reduce((sum, t) => sum + t.fee, 0);
  
  return (
    <div>
      {transactions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <GlassCard className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-dark-400 text-sm">Total Bought</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(totalBought)}</p>
                <p className="text-dark-400 text-sm mt-1">
                  {transactions.filter(t => t.type === 'buy').length} transactions
                </p>
              </div>
              <div className="bg-secondary/20 p-3 rounded-lg">
                <ArrowDownLeft size={24} className="text-secondary" />
              </div>
            </div>
          </GlassCard>
          
          <GlassCard className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-dark-400 text-sm">Total Sold</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(totalSold)}</p>
                <p className="text-dark-400 text-sm mt-1">
                  {transactions.filter(t => t.type === 'sell').length} transactions
                </p>
              </div>
              <div className="bg-red-500/20 p-3 rounded-lg">
                <ArrowUpRight size={24} className="text-red-500" />
              </div>
            </div>
          </GlassCard>
          
          <GlassCard className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-dark-400 text-sm">Total Fees</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(totalFees)}</p>
                <p className="text-dark-400 text-sm mt-1">
                  {transactions.length} transactions
                </p>
              </div>
              <div className="bg-primary/20 p-3 rounded-lg">
                <RefreshCw size={24} className="text-primary" />
              </div>
            </div>
          </GlassCard>
        </div>
      )}
      
      <GlassCard className="p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h3 className="text-xl font-semibold">Transaction History</h3>
          
          {transactions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  className="input-field pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="relative">
                <select
                  className="input-field appearance-none pr-10"
                  value={typeFilter || ''}
                  onChange={(e) => setTypeFilter(e.target.value === '' ? null : e.target.value)}
                >
                  <option value="">All Types</option>
                  {transactionTypes.map(type => (
                    <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-dark-400 pointer-events-none" />
              </div>
              
              <div className="relative">
                <select
                  className="input-field appearance-none pr-10"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as any)}
                >
                  <option value="all">All Time</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-dark-400 pointer-events-none" />
              </div>
              
              <button
                className="p-2 rounded-lg bg-dark-800 text-dark-400 hover:text-light"
                title="Export filtered transactions as CSV"
                onClick={() => {
                  const header = 'Date,Type,Asset,Symbol,Quantity,Price,Total,Fee,Status\n';
                  const rows = sortedTransactions
                    .map(t =>
                      [
                        new Date(t.date).toISOString(),
                        t.type,
                        t.asset.name,
                        t.asset.symbol,
                        t.quantity,
                        t.price,
                        t.total,
                        t.fee,
                        t.status
                      ].join(',')
                    )
                    .join('\n');
                  const blob = new Blob([header + rows], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `transactions-export-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download size={18} />
              </button>
            </div>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="text-left py-3 px-4 text-dark-400 text-sm font-medium">Type</th>
                <th className="text-left py-3 px-4 text-dark-400 text-sm font-medium">Asset</th>
                <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">Date</th>
                <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">Quantity</th>
                <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">Price</th>
                <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">Total</th>
                <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">Fee</th>
                <th className="text-center py-3 px-4 text-dark-400 text-sm font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {currentTransactions.map((transaction) => (
                <motion.tr 
                  key={transaction.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="border-b border-dark-700 hover:bg-dark-800/50"
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg mr-3 ${
                        transaction.type === 'buy' ? 'bg-secondary/20' : 
                        transaction.type === 'sell' ? 'bg-red-500/20' : 
                        transaction.type === 'transfer' ? 'bg-blue-400/20' : 
                        'bg-purple-500/20'
                      }`}>
                        {getIcon(transaction.type)}
                      </div>
                      <span className="font-medium capitalize">{transaction.type}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-dark-700 flex items-center justify-center mr-3">
                        <span className="text-xs font-medium">{transaction.asset.symbol.substring(0, 2)}</span>
                      </div>
                      <div>
                        <p className="font-medium">{transaction.asset.symbol}</p>
                        <p className="text-dark-400 text-xs">{transaction.asset.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    {formatDate(transaction.date)}
                  </td>
                  <td className="py-4 px-4 text-right">
                    {transaction.quantity} {transaction.asset.symbol}
                  </td>
                  <td className="py-4 px-4 text-right">
                    {formatCurrency(transaction.price)}
                  </td>
                  <td className="py-4 px-4 text-right font-medium">
                    {formatCurrency(transaction.total)}
                  </td>
                  <td className="py-4 px-4 text-right text-dark-400">
                    {formatCurrency(transaction.fee)}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      transaction.status === 'completed' ? 'bg-secondary/20 text-secondary' : 
                      transaction.status === 'pending' ? 'bg-amber-500/20 text-amber-500' : 
                      'bg-red-500/20 text-red-500'
                    }`}>
                      {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {sortedTransactions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-dark-400 mb-2">
              {transactions.length === 0 
                ? "No transactions yet. Start by adding an asset to your portfolio."
                : "No transactions found matching your filters."
              }
            </p>
            {transactions.length === 0 && (
              <p className="text-dark-500 text-sm">Use the "Add Asset" button to record your first transaction.</p>
            )}
          </div>
        )}
        
        {sortedTransactions.length > 0 && (
          <div className="mt-6 flex justify-between items-center">
            <p className="text-dark-400 text-sm">
              Showing {indexOfFirstTransaction + 1}-{Math.min(indexOfLastTransaction, sortedTransactions.length)} of {sortedTransactions.length} transactions
            </p>
            
            <div className="flex items-center space-x-2">
              <button 
                className="p-2 rounded-lg bg-dark-800 text-dark-400 hover:text-light disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
              </button>
              
              <div className="px-4 py-2 bg-dark-800 rounded-lg">
                {currentPage} / {totalPages}
              </div>
              
              <button 
                className="p-2 rounded-lg bg-dark-800 text-dark-400 hover:text-light disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
};

export default TransactionHistory;