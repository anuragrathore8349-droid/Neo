import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  ChevronDown, 
  Download,
  Clock,
  DollarSign,
  Percent,
  BarChart2,
  RefreshCw
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import GlassCard from '../../components/common/GlassCard';
import { PortfolioAsset, Transaction, PriceHistory } from '../../types';
import { motion } from 'framer-motion';
import { getAssetHistory, getTransactionsByAsset } from '../../services/portfolio.service';

interface AssetDetailsProps {
  asset: PortfolioAsset;
  transactions: Transaction[];
  onBack: () => void;
  onTrade?: (asset: PortfolioAsset) => void;
  onAddPosition?: (asset: PortfolioAsset) => void;
  onViewMarketData?: (symbol: string) => void;
  onRefresh?: () => void;
}

const AssetDetails: React.FC<AssetDetailsProps> = ({ asset, transactions, onBack, onRefresh }) => {
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'>('1M');
  const [priceHistoryData, setPriceHistoryData] = useState<PriceHistory[]>([]);
  const [assetTransactions, setAssetTransactions] = useState<Transaction[]>(transactions);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editQuantity, setEditQuantity] = useState(asset.quantity.toString());
  const [editCostBasis, setEditCostBasis] = useState(asset.averageBuyPrice.toString());
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    const fetchAssetData = async () => {
      try {
        setIsLoading(true);
        
        // Map UI timeframe to server timeframe format
        const timeframeMap: Record<string, string> = {
          '1D': '1d',
          '1W': '7d',
          '1M': '30d',
          '3M': '90d',
          '1Y': '365d',
          'ALL': 'all'
        };

        const [historyResult, transactionsResult] = await Promise.allSettled([
          getAssetHistory(asset.symbol, timeframeMap[timeframe]),
          getTransactionsByAsset(asset.symbol)
        ]);

        if (historyResult.status === 'fulfilled' && historyResult.value?.data) {
          setPriceHistoryData(historyResult.value.data);
        }

        if (transactionsResult.status === 'fulfilled' && transactionsResult.value?.data) {
          setAssetTransactions(transactionsResult.value.data);
        }
      } catch (error) {
        console.error('Error fetching asset data:', error);
        // Fallback to provided transactions
        setAssetTransactions(transactions);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssetData();
  }, [timeframe, asset.symbol, transactions]);
  
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
  
  // Format percentage (safely handle null/undefined)
  const formatPercentage = (value?: number | null) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };
  
  // Format date
const formatDate = (dateString: string | Date | number | null | undefined): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark-800 p-3 rounded-lg border border-dark-700 shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-primary">Price: {formatCurrency(payload[0].payload.price)}</p>
          <p className="text-secondary">Value: {formatCurrency(payload[0].payload.value)}</p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <div>
      <button 
        className="flex items-center text-primary hover:text-primary-400 mb-6"
        onClick={onBack}
      >
        <ArrowLeft size={16} className="mr-1" />
        Back to Portfolio
      </button>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <GlassCard className="p-6 lg:col-span-2">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-dark-700 flex items-center justify-center mr-3">
                  <span className="text-sm font-medium">{asset.symbol.substring(0, 2)}</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{asset.name}</h2>
                  <p className="text-dark-400">{asset.symbol} • {asset.type ? asset.type.charAt(0).toUpperCase() + asset.type.slice(1) : 'Unknown'}</p>
                </div>
              </div>
            </div>
<div className="flex space-x-2">
  <button
    className="btn-outline"
    onClick={() => onTrade && onTrade(asset)}
  >
    Trade
  </button>
  <button
    className="btn-primary"
    onClick={() => onAddPosition && onAddPosition(asset)}
  >
    Add Position
  </button>
</div>          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-dark-800/50 rounded-lg p-4">
              <p className="text-dark-400 text-sm">Current Price</p>
              <p className="text-2xl font-bold">{formatCurrency(asset.price)}</p>
              <div className="flex items-center mt-1">
                {asset.change24h >= 0 ? (
                  <TrendingUp size={16} className="text-secondary mr-1" />
                ) : (
                  <TrendingDown size={16} className="text-red-500 mr-1" />
                )}
                <span className={asset.change24h >= 0 ? 'text-secondary' : 'text-red-500'}>
                  {formatPercentage(asset.change24h)} (24h)
                </span>
              </div>
            </div>
            
            <div className="bg-dark-800/50 rounded-lg p-4">
              <p className="text-dark-400 text-sm">Holdings</p>
              <p className="text-2xl font-bold">{asset.quantity} {asset.symbol}</p>
              <p className="text-dark-400 mt-1">
                {formatCurrency(asset.value)} ({asset.allocation.toFixed(2)}%)
              </p>
            </div>
            
            <div className="bg-dark-800/50 rounded-lg p-4">
              <p className="text-dark-400 text-sm">Profit/Loss</p>
              <p className={`text-2xl font-bold ${asset.profitLoss >= 0 ? 'text-secondary' : 'text-red-500'}`}>
                {formatCurrency(asset.profitLoss)}
              </p>
              <div className="flex items-center mt-1">
                {asset.profitLossPercentage >= 0 ? (
                  <TrendingUp size={16} className="text-secondary mr-1" />
                ) : (
                  <TrendingDown size={16} className="text-red-500 mr-1" />
                )}
                <span className={asset.profitLossPercentage >= 0 ? 'text-secondary' : 'text-red-500'}>
                  {formatPercentage(asset.profitLossPercentage)}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>
        
        <GlassCard className="p-6">
          <h3 className="text-xl font-semibold mb-4">Position Details</h3>
          
          <div className="space-y-4">
            {/* Average Buy Price row — editable */}
            <div className="flex justify-between items-center">
              <p className="text-dark-400">Average Buy Price</p>
              {isEditing ? (
                <input
                  type="number"
                  step="0.01"
                  value={editCostBasis}
                  onChange={e => setEditCostBasis(e.target.value)}
                  className="w-32 text-right bg-dark-700 border border-primary rounded px-2 py-1 text-sm"
                />
              ) : (
                <p className="font-medium">{formatCurrency(asset.averageBuyPrice)}</p>
              )}
            </div>
            
            <div className="flex justify-between">
              <p className="text-dark-400">Current Price</p>
              <p className="font-medium">{formatCurrency(asset.price)}</p>
            </div>
            
            {/* Quantity row — editable */}
            <div className="flex justify-between items-center">
              <p className="text-dark-400">Quantity</p>
              {isEditing ? (
                <input
                  type="number"
                  step="0.00000001"
                  value={editQuantity}
                  onChange={e => setEditQuantity(e.target.value)}
                  className="w-32 text-right bg-dark-700 border border-primary rounded px-2 py-1 text-sm"
                />
              ) : (
                <p className="font-medium">{asset.quantity} {asset.symbol}</p>
              )}
            </div>
            
            <div className="flex justify-between">
              <p className="text-dark-400">Total Value</p>
              <p className="font-medium">{formatCurrency(asset.value)}</p>
            </div>
            
            <div className="flex justify-between">
              <p className="text-dark-400">Portfolio Allocation</p>
              <p className="font-medium">{asset.allocation.toFixed(2)}%</p>
            </div>
            
            <div className="flex justify-between">
              <p className="text-dark-400">Profit/Loss</p>
              <p className={`font-medium ${asset.profitLoss >= 0 ? 'text-secondary' : 'text-red-500'}`}>
                {formatCurrency(asset.profitLoss)} ({formatPercentage(asset.profitLossPercentage)})
              </p>
            </div>
            
            <div className="flex justify-between">
              <p className="text-dark-400">First Purchase</p>
              <p className="font-medium">
                {assetTransactions.length > 0 
                  ? formatDate(assetTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0].date)
                  : 'N/A'
                }
              </p>
            </div>
            
            <div className="flex justify-between">
              <p className="text-dark-400">Last Transaction</p>
              <p className="font-medium">
                {assetTransactions.length > 0 
                  ? formatDate(assetTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date)
                  : 'N/A'
                }
              </p>
            </div>
          </div>
          
<div className="mt-6 flex gap-2">
  {isEditing ? (
    <>
      <button
        className="flex-1 btn-primary text-sm"
        disabled={isSavingEdit}
        onClick={async () => {
          setIsSavingEdit(true);
          try {
            await fetch(`/api/portfolio/assets/${asset.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                amount: parseFloat(editQuantity),
                costBasis: parseFloat(editCostBasis)
              })
            });
            setIsEditing(false);
            // Trigger a refresh in parent — pass onRefresh prop
            onRefresh && onRefresh();
          } catch (err) {
            console.error('Failed to save edit:', err);
          } finally {
            setIsSavingEdit(false);
          }
        }}
      >
        {isSavingEdit ? 'Saving...' : 'Save changes'}
      </button>
      <button className="btn-outline text-sm" onClick={() => setIsEditing(false)}>
        Cancel
      </button>
    </>
  ) : (
    <>
      <button className="flex-1 btn-outline text-sm" onClick={() => setIsEditing(true)}>
        Edit Position
      </button>
      <button
        className="flex-1 btn-outline text-sm"
        onClick={() => onViewMarketData && onViewMarketData(asset.symbol)}
      >
        View Market Data
      </button>
    </>
  )}
</div>        </GlassCard>
      </div>
      
      <div className="grid grid-cols-1 gap-6 mb-6">
        <GlassCard className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold">Price History</h3>
            <div className="flex space-x-2">
              <div className="flex space-x-1 bg-dark-800 rounded-lg p-1">
                {['1D', '1W', '1M', '3M', '1Y', 'ALL'].map((tf) => (
                  <button
                    key={tf}
                    className={`px-3 py-1 text-sm rounded-md transition-all ${
                      timeframe === tf
                        ? 'bg-primary text-white'
                        : 'text-dark-400 hover:text-light'
                    }`}
                    onClick={() => setTimeframe(tf as any)}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              
<button
  className="p-2 rounded-lg bg-dark-800 text-dark-400 hover:text-light"
  title="Download price history as CSV"
  onClick={() => {
    if (!priceHistoryData.length) return;
    const header = 'Date,Price,Value\n';
    const rows = priceHistoryData
      .map(d => `${d.date},${d.price},${d.value}`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${asset.symbol}-price-history-${timeframe}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }}
>
  <Download size={18} />
</button>            </div>
          </div>
          
          <div className="h-80">
            {priceHistoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={priceHistoryData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3D5AF1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3D5AF1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#323B4E" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#7C8B9B' }}
                    axisLine={{ stroke: '#323B4E' }}
                    tickLine={{ stroke: '#323B4E' }}
                  />
                  <YAxis 
                    tick={{ fill: '#7C8B9B' }}
                    axisLine={{ stroke: '#323B4E' }}
                    tickLine={{ stroke: '#323B4E' }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#3D5AF1" 
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorPrice)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-dark-400">{isLoading ? 'Loading price history...' : 'No price history data available'}</p>
              </div>
            )}
          </div>
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-dark-800/50 rounded-lg p-3">
              <p className="text-dark-400 text-xs">Open</p>
              <p className="text-lg font-medium">{priceHistoryData.length > 0 ? formatCurrency(priceHistoryData[0].price) : '—'}</p>
            </div>
            
            <div className="bg-dark-800/50 rounded-lg p-3">
              <p className="text-dark-400 text-xs">Close</p>
              <p className="text-lg font-medium">{priceHistoryData.length > 0 ? formatCurrency(priceHistoryData[priceHistoryData.length - 1].price) : '—'}</p>
            </div>
            
            <div className="bg-dark-800/50 rounded-lg p-3">
              <p className="text-dark-400 text-xs">High</p>
              <p className="text-lg font-medium">{priceHistoryData.length > 0 ? formatCurrency(Math.max(...priceHistoryData.map(d => d.price))) : '—'}</p>
            </div>
            
            <div className="bg-dark-800/50 rounded-lg p-3">
              <p className="text-dark-400 text-xs">Low</p>
              <p className="text-lg font-medium">{priceHistoryData.length > 0 ? formatCurrency(Math.min(...priceHistoryData.map(d => d.price))) : '—'}</p>
            </div>
          </div>
        </GlassCard>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <GlassCard className="p-6">
          <h3 className="text-xl font-semibold mb-4">Transaction History</h3>
          
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-dark-400">No transactions found for this asset.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left py-3 px-4 text-dark-400 text-sm font-medium">Type</th>
                    <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">Date</th>
                    <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">Quantity</th>
                    <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">Price</th>
                    <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">Total</th>
                    <th className="text-right py-3 px-4 text-dark-400 text-sm font-medium">Fee</th>
                    <th className="text-center py-3 px-4 text-dark-400 text-sm font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((transaction) => (
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
                              {transaction.type === 'buy' ? (
                                <TrendingDown size={16} className="text-secondary" />
                              ) : transaction.type === 'sell' ? (
                                <TrendingUp size={16} className="text-red-500" />
                              ) : transaction.type === 'transfer' ? (
                                <RefreshCw size={16} className="text-blue-400" />
                              ) : (
                                <DollarSign size={16} className="text-purple-500" />
                              )}
                            </div>
                            <span className="font-medium capitalize">{transaction.type}</span>
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
          )}
          
<div className="mt-6 flex justify-between items-center">
  <p className="text-dark-400 text-sm">Showing {transactions.length} transactions</p>
  <button
    className="btn-outline"
    onClick={onBack}
  >
    View All Transactions
  </button>
</div>        </GlassCard>
      </div>
    </div>
  );
};

export default AssetDetails;