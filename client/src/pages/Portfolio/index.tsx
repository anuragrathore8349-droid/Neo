import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/common/Tabs';
import GlassCard from '../../components/common/GlassCard';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { 
  PieChart, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight, 
  Download, 
  Filter, 
  Calendar, 
  Search,
  Plus,
  RefreshCw,
  Eye,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  ChevronDown,
  Upload
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { PortfolioAsset, Transaction, PortfolioSummary, PerformanceMetrics } from '../../types';
import { apiFetch } from '../../services/api';
import { getPortfolioSummary, getPortfolioAssets, getRecentTransactions, getPerformanceMetrics, getPortfolioHistory } from '../../services/portfolio.service';
import PortfolioOverview from '../../components/Portfolio/Overview';
import AssetDetails from '../../components/Portfolio/AssetDetails';
import TransactionHistory from '../../components/Portfolio/TransactionHistory';
import AddAssetModal from '../../components/Portfolio/AddAssetModal';
import CSVImportModal from '../../components/Portfolio/CSVImportModal';
import PortfolioRebalance from '../../components/portfolio/PortfolioRebalance';

interface PortfolioProps {
  assets?: PortfolioAsset[];
  transactions?: Transaction[];
}

const Portfolio: React.FC<PortfolioProps> = ({ assets = [], transactions = [] }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedAsset, setSelectedAsset] = useState<PortfolioAsset | null>(null);
  const [preselectedAsset, setPreselectedAsset] = useState<PortfolioAsset | null>(null);
  const [timeframe, setTimeframe] = useState<'1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'>('1M');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState<string | null>(null);
  const [portfolioAssets, setPortfolioAssets] = useState<PortfolioAsset[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary>({
    totalValue: 0,
    dailyChange: 0,
    dailyChangePercentage: 0,
    weeklyChange: 0,
    weeklyChangePercentage: 0,
    monthlyChange: 0,
    monthlyChangePercentage: 0,
    allTimeProfit: 0,
    allTimeProfitPercentage: 0
  });
  const [portfolioTransactions, setPortfolioTransactions] = useState<Transaction[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  const [isCSVImportModalOpen, setIsCSVImportModalOpen] = useState(false);
  const [isRebalanceModalOpen, setIsRebalanceModalOpen] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const socketRef = React.useRef<Socket | null>(null);
  const portfolioIdRef = React.useRef<string | null>(null);
const [exporting, setExporting] = useState(false);
const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('pdf');
const [isOptimizing, setIsOptimizing] = useState(false);
const [optimizerResult, setOptimizerResult] = useState<any>(null);
const [optimizerObjective, setOptimizerObjective] = useState<'sharpe' | 'minvar' | 'maxreturn'>('sharpe');
 const [showAssetLines, setShowAssetLines] = useState(false);

const fetchPortfolioData = async () => {
    try {
      setIsLoading(true);

      const [summaryResult, assetsResult, transactionsResult, metricsResult] = await Promise.allSettled([
        getPortfolioSummary(),
        getPortfolioAssets(),
        getRecentTransactions(),
        getPerformanceMetrics()
      ]);

      if (summaryResult.status === 'fulfilled' && summaryResult.value?.data) {
        setPortfolioSummary(summaryResult.value.data);
        // Capture portfolio ID for WebSocket subscription
        if (summaryResult.value.data.portfolioId && !portfolioIdRef.current) {
          portfolioIdRef.current = summaryResult.value.data.portfolioId;
          // Subscribe if socket is already connected
          if (socketRef.current?.connected) {
            socketRef.current.emit('subscribe', summaryResult.value.data.portfolioId);
          }
        }
      }

      if (assetsResult.status === 'fulfilled' && assetsResult.value?.data) {
        setPortfolioAssets(assetsResult.value.data);
      }

      if (transactionsResult.status === 'fulfilled' && transactionsResult.value?.data) {
        setPortfolioTransactions(transactionsResult.value.data);
      }

      if (metricsResult.status === 'fulfilled' && metricsResult.value?.data) {
        setPerformanceMetrics(metricsResult.value.data);
      }

      setLastUpdateTime(new Date());
    } catch (error) {
      console.error('Error fetching portfolio data:', error);
    } finally {
      setIsLoading(false);
    }
  };

useEffect(() => {
  fetchPortfolioData();

  // Connect to portfolio WebSocket namespace
  const socket = io('/portfolio', {
    withCredentials: true,
    transports: ['websocket'],
  });
  socketRef.current = socket;

  socket.on('connect', () => {
    // Subscribe once we have the portfolio ID (fetched in fetchPortfolioData)
    if (portfolioIdRef.current) {
      socket.emit('subscribe', portfolioIdRef.current);
    }
  });

  // Live price update from server
  socket.on('portfolioUpdate', (payload: any) => {
    const { data } = payload;
    if (!data) return;

    // Patch summary
    setPortfolioSummary(prev => ({
      ...prev,
      totalValue: data.totalValue ?? prev.totalValue,
      allTimeProfit: data.totalProfit ?? prev.allTimeProfit,
      allTimeProfitPercentage: data.totalProfitPercentage ?? prev.allTimeProfitPercentage,
    }));

    // Patch asset prices inline without a full refetch
    if (data.assets) {
      setPortfolioAssets(prev =>
        prev.map(asset => {
          const updated = data.assets.find((a: any) => a.symbol === asset.symbol);
          if (!updated) return asset;
          return {
            ...asset,
            price: updated.currentPrice ?? asset.price,
            value: updated.value ?? asset.value,
            profitLoss: updated.profit ?? asset.profitLoss,
            profitLossPercentage: updated.profitPercentage ?? asset.profitLossPercentage,
          };
        })
      );
    }

    setLastUpdateTime(new Date());
  });

  socket.on('disconnect', () => {
    // Fallback: poll every 60s if WebSocket drops
    const fallback = setInterval(() => fetchPortfolioData(), 60_000);
    socket.on('connect', () => clearInterval(fallback));
  });

  return () => {
    socket.disconnect();
  };
}, []);
  // Fetch chart data when timeframe changes
  useEffect(() => {
    const fetchChartData = async () => {
      setChartLoading(true);
      try {
        const timeframeMap: { [key: string]: string } = {
          '1W': '1w',
          '1M': '1m',
          '3M': '3m',
          '6M': '6m',
          '1Y': '1y',
          'ALL': 'all'
        };

        const result = await getPortfolioHistory(timeframeMap[timeframe]);

        if (result?.data && Array.isArray(result.data)) {
          // Format data for recharts — preserve nulls so charts can show gaps instead of zeros
          const formattedData = result.data.map((point: any) => ({
            date: new Date(point.timestamp || point.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              ...(timeframe === '1Y' || timeframe === 'ALL' ? { year: '2-digit' } : {})
            }),
            value: point.value ?? null,
            timestamp: point.timestamp || point.date,
            // Include per-asset breakdown for overlay (when toggled on)
            assets: point.assets || {}
          }));

          setChartData(formattedData);
        } else {
          setChartData([]);
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
        setChartData([]);
      } finally {
        setChartLoading(false);
      }
    };

    fetchChartData();
  }, [timeframe]);

  useEffect(() => {
    if (!selectedAsset && portfolioAssets.length > 0) {
      setSelectedAsset(portfolioAssets[0]);
    }
  }, [portfolioAssets, selectedAsset]);

  // Deep-link support: /portfolio?tab=transactions comes from Dashboard "View All"
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'asset-details', 'transactions', 'performance'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const portfolioTotalValue = portfolioSummary.totalValue;

  const portfolioPerformance = {
    totalValue: portfolioSummary.totalValue,
    totalProfitLoss: portfolioSummary.allTimeProfit,
    totalProfitLossPercentage: portfolioSummary.allTimeProfitPercentage,
    dailyChange: portfolioSummary.dailyChange,
    dailyChangePercentage: portfolioSummary.dailyChangePercentage,
    weeklyChange: portfolioSummary.weeklyChange,
    weeklyChangePercentage: portfolioSummary.weeklyChangePercentage,
    monthlyChange: portfolioSummary.monthlyChange,
    monthlyChangePercentage: portfolioSummary.monthlyChangePercentage
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-900 p-6 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Filter assets based on search term and asset type
  const filteredAssets = portfolioAssets.filter(asset => {
    const matchesSearch = searchTerm === '' || 
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      asset.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = assetTypeFilter === null || asset.type === assetTypeFilter;
    
    return matchesSearch && matchesType;
  });

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

  // Format percentage (null/undefined-safe)
  const formatPercentage = (value?: number | null) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Get time ago
  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getChartDateRange = () => {
    if (!chartData || chartData.length === 0) return '';
    const first = new Date(chartData[0].timestamp);
    const last = new Date(chartData[chartData.length - 1].timestamp);
    const formatDate = (date: Date) =>
      date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(timeframe === '1Y' || timeframe === 'ALL' ? { year: '2-digit' } : {}),
      });
    return `${formatDate(first)} — ${formatDate(last)}`;
  };

  // Handle asset selection
  const handleAssetSelect = (asset: PortfolioAsset) => {
    setSelectedAsset(asset);
    setActiveTab('asset-details');
  };

  // Handle back to overview
  const handleBackToOverview = () => {
    setSelectedAsset(null);
    setActiveTab('overview');
  };

  // Handle export data
  const downloadExportFile = (format: 'pdf' | 'excel') => {
    const fileName = `neofin-portfolio-export-${new Date().toISOString().slice(0, 10)}`;
    
    // Safe value getter with fallback to 0
    const safeValue = (val: any) => (val === undefined || val === null ? 0 : val);
    
    if (format === 'pdf') {
      const doc = new jsPDF();
      let y = 20;
      doc.setFontSize(16);
      doc.text('NeoFin Portfolio Export', 20, y);
      y += 20;
      
      doc.setFontSize(12);
      doc.text('Portfolio Summary', 20, y);
      y += 10;
      doc.text(`Total Value: $${safeValue(portfolioSummary.totalValue).toFixed(2)}`, 20, y);
      y += 10;
      doc.text(`Daily Change: $${safeValue(portfolioSummary.dailyChange).toFixed(2)} (${safeValue(portfolioSummary.dailyChangePercentage).toFixed(2)}%)`, 20, y);
      y += 10;
      doc.text(`All Time Profit: $${safeValue(portfolioSummary.allTimeProfit).toFixed(2)} (${safeValue(portfolioSummary.allTimeProfitPercentage).toFixed(2)}%)`, 20, y);
      y += 20;
      
      doc.text('Assets', 20, y);
      y += 10;
      if (portfolioAssets && portfolioAssets.length > 0) {
        portfolioAssets.forEach((asset) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(`${asset.name} (${asset.symbol}): $${safeValue(asset.value).toFixed(2)} (${safeValue(asset.allocation).toFixed(2)}%)`, 20, y);
          y += 10;
        });
      } else {
        doc.text('No assets in portfolio', 20, y);
        y += 10;
      }
      
      y += 10;
      doc.text('Recent Transactions', 20, y);
      y += 10;
      if (portfolioTransactions && portfolioTransactions.length > 0) {
        portfolioTransactions.slice(0, 10).forEach((txn) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(`${txn.type} ${txn.quantity} ${txn.asset.symbol} @ $${safeValue(txn.price).toFixed(2)}`, 20, y);
          y += 10;
        });
      } else {
        doc.text('No transactions', 20, y);
        y += 10;
      }
      
      doc.save(`${fileName}.pdf`);
    } else if (format === 'excel') {
      const workbook = XLSX.utils.book_new();
      
      // Summary sheet
      const summaryData = [
        ['Portfolio Summary'],
        ['Total Value', safeValue(portfolioSummary.totalValue)],
        ['Daily Change', safeValue(portfolioSummary.dailyChange)],
        ['Daily Change %', safeValue(portfolioSummary.dailyChangePercentage)],
        ['Weekly Change', safeValue(portfolioSummary.weeklyChange)],
        ['Weekly Change %', safeValue(portfolioSummary.weeklyChangePercentage)],
        ['Monthly Change', safeValue(portfolioSummary.monthlyChange)],
        ['Monthly Change %', safeValue(portfolioSummary.monthlyChangePercentage)],
        ['All Time Profit', safeValue(portfolioSummary.allTimeProfit)],
        ['All Time Profit %', safeValue(portfolioSummary.allTimeProfitPercentage)]
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      
      // Assets sheet
      const assetsData = [
        ['Asset', 'Symbol', 'Type', 'Price', 'Change 24h', 'Quantity', 'Value', 'Allocation', 'P&L', 'P&L %', 'Avg Buy Price']
      ].concat((portfolioAssets || []).map((asset) => [
        asset.name,
        asset.symbol,
        asset.type,
        safeValue(asset.price),
        safeValue(asset.change24h),
        safeValue(asset.quantity),
        safeValue(asset.value),
        safeValue(asset.allocation),
        safeValue(asset.profitLoss),
        safeValue(asset.profitLossPercentage),
        safeValue(asset.averageBuyPrice)
      ]));
      const assetsSheet = XLSX.utils.aoa_to_sheet(assetsData);
      XLSX.utils.book_append_sheet(workbook, assetsSheet, 'Assets');
      
      // Transactions sheet
      const transactionsData = [
        ['Type', 'Asset', 'Quantity', 'Price', 'Total', 'Fee', 'Date', 'Status']
      ].concat((portfolioTransactions || []).map((txn) => [
        txn.type,
        txn.asset.symbol,
        safeValue(txn.quantity),
        safeValue(txn.price),
        safeValue(txn.total),
        safeValue(txn.fee),
        txn.date,
        txn.status
      ]));
      const transactionsSheet = XLSX.utils.aoa_to_sheet(transactionsData);
      XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transactions');
      
      XLSX.writeFile(workbook, `${fileName}.xlsx`);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      downloadExportFile(exportFormat);
    } catch (error) {
      console.error('Error exporting portfolio data:', error);
    } finally {
      setExporting(false);
    }
  };
 const handleOptimize = async () => {
  setIsOptimizing(true);
  setOptimizerResult(null);
  try {
    const data = await apiFetch('/api/portfolio/optimize', {
      method: 'POST',
      body: {
        objective: optimizerObjective,
        constraints: { minWeight: 0.02, maxWeight: 0.60 }
      }
    });
    if (data?.status === 'success') {
      setOptimizerResult(data.data);
    }
  } catch (error) {
    console.error('Optimizer error:', error);
  } finally {
    setIsOptimizing(false);
  }
};
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Portfolio Management</h2>
        <div className="flex space-x-2">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'excel')}
            className="px-3 py-2 bg-dark-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="pdf">PDF</option>
            <option value="excel">Excel</option>
          </select>
          <button
            className="btn-outline flex items-center"
            onClick={handleExportData}
            disabled={exporting}
          >
            <Download size={16} className="mr-2" />
            {exporting ? 'Exporting…' : 'Export'}
          </button>
          <button 
            className="btn-primary flex items-center"
            onClick={() => setIsAddAssetModalOpen(true)}
          >
            <Plus size={16} className="mr-2" />
            Add Asset
          </button>
          <button 
            className="btn-outline flex items-center"
            onClick={() => setIsCSVImportModalOpen(true)}
            title="Import assets from CSV file"
          >
            <Upload size={16} className="mr-2" />
            Import CSV
          </button>
          <button 
            className="btn-primary flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            onClick={() => setIsRebalanceModalOpen(true)}
            title="Rebalance your portfolio using AI optimization"
          >
            <Zap size={16} />
            Rebalance
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <GlassCard className="p-6" gradient>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-dark-400 text-sm">Total Value</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(portfolioPerformance.totalValue)}</p>
              <div className="flex items-center mt-1">
                {portfolioPerformance.dailyChangePercentage >= 0 ? (
                  <ArrowUpRight size={16} className="text-secondary mr-1" />
                ) : (
                  <ArrowDownRight size={16} className="text-red-500 mr-1" />
                )}
                <span className={portfolioPerformance.dailyChangePercentage >= 0 ? 'text-secondary' : 'text-red-500'}>
                  {formatPercentage(portfolioPerformance.dailyChangePercentage)} today
                </span>
              </div>
            </div>
            <div className="bg-dark-800/50 p-3 rounded-lg">
              <PieChart size={24} className="text-primary" />
            </div>
          </div>
        </GlassCard>
        
        <GlassCard className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-dark-400 text-sm">Total Profit/Loss</p>
              <p className={`text-2xl font-bold mt-1 ${portfolioPerformance.totalProfitLoss >= 0 ? 'text-secondary' : 'text-red-500'}`}>
                {formatCurrency(portfolioPerformance.totalProfitLoss)}
              </p>
              <div className="flex items-center mt-1">
                {portfolioPerformance.totalProfitLossPercentage >= 0 ? (
                  <TrendingUp size={16} className="text-secondary mr-1" />
                ) : (
                  <TrendingDown size={16} className="text-red-500 mr-1" />
                )}
                <span className={portfolioPerformance.totalProfitLossPercentage >= 0 ? 'text-secondary' : 'text-red-500'}>
                  {formatPercentage(portfolioPerformance.totalProfitLossPercentage)} all time
                </span>
              </div>
            </div>
            <div className="bg-dark-800/50 p-3 rounded-lg">
              <BarChart3 size={24} className="text-primary" />
            </div>
          </div>
        </GlassCard>
        
        <GlassCard className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-dark-400 text-sm">Monthly Change</p>
              <p className={`text-2xl font-bold mt-1 ${portfolioPerformance.monthlyChange >= 0 ? 'text-secondary' : 'text-red-500'}`}>
                {formatCurrency(portfolioPerformance.monthlyChange)}
              </p>
              <div className="flex items-center mt-1">
                {portfolioPerformance.monthlyChangePercentage >= 0 ? (
                  <TrendingUp size={16} className="text-secondary mr-1" />
                ) : (
                  <TrendingDown size={16} className="text-red-500 mr-1" />
                )}
                <span className={portfolioPerformance.monthlyChangePercentage >= 0 ? 'text-secondary' : 'text-red-500'}>
                  {formatPercentage(portfolioPerformance.monthlyChangePercentage)} last 30 days
                </span>
              </div>
            </div>
            <div className="bg-dark-800/50 p-3 rounded-lg">
              <LineChart size={24} className="text-primary" />
            </div>
          </div>
        </GlassCard>
        
        <GlassCard className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-dark-400 text-sm">Assets</p>
              <p className="text-2xl font-bold mt-1">{portfolioAssets.length}</p>
              <div className="flex items-center mt-1">
                <Clock size={16} className="text-dark-400 mr-1" />
                <span className="text-dark-400">Last updated {getTimeAgo(lastUpdateTime)}</span>
              </div>
            </div>
            <div className="bg-dark-800/50 p-3 rounded-lg">
              <RefreshCw size={24} className="text-primary" />
            </div>
          </div>
        </GlassCard>
      </div>
      
      <Tabs defaultValue="overview" className="mb-6">
        <TabsList>
          <TabsTrigger value="overview" onClick={() => setActiveTab('overview')}>Overview</TabsTrigger>
          <TabsTrigger value="asset-details" onClick={() => setActiveTab('asset-details')}>Asset Details</TabsTrigger>
          <TabsTrigger value="transactions" onClick={() => setActiveTab('transactions')}>Transaction History</TabsTrigger>
          <TabsTrigger value="performance" onClick={() => setActiveTab('performance')}>Performance</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="pt-6">
          <PortfolioOverview 
            assets={portfolioAssets} 
            portfolioTotalValue={portfolioTotalValue} 
            onAssetSelect={handleAssetSelect}
            onDeleteAsset={async (assetId) => {
              try {
                await apiFetch(`/api/portfolio/assets/${assetId}`, {
                  method: 'DELETE'
                });
                fetchPortfolioData();  // refresh after deletion
              } catch (err) {
                console.error('Failed to delete asset:', err);
              }
            }}
          />
        </TabsContent>
        
        <TabsContent value="asset-details" className="pt-6">
          {selectedAsset ? (
<AssetDetails
  asset={selectedAsset}
  transactions={portfolioTransactions.filter(t => t.asset.symbol === selectedAsset.symbol)}
  onBack={handleBackToOverview}
  onTrade={(asset) => {
    navigate(`/trading?symbol=${asset.symbol}`);
  }}
  onAddPosition={(asset) => {
    setPreselectedAsset(asset);
    setIsAddAssetModalOpen(true);
  }}
  onViewMarketData={(symbol) => {
    navigate(`/trading?symbol=${symbol}&view=market`);
  }}
  onRefresh={fetchPortfolioData}
/>          ) : (
            <GlassCard className="p-6 text-center">
              <p className="text-xl mb-4">Select an asset to view details</p>
              <button className="btn-primary" onClick={() => setActiveTab('overview')}>
                Go to Overview
              </button>
            </GlassCard>
          )}
        </TabsContent>
        
        <TabsContent value="transactions" className="pt-6">
          <TransactionHistory transactions={portfolioTransactions} />
        </TabsContent>
        
        <TabsContent value="performance" className="pt-6">
          <GlassCard className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-semibold">Portfolio Performance</h3>
                {chartData.length > 0 && !chartLoading && (
                  <p className="text-xs text-dark-400 mt-1">{getChartDateRange()}</p>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  className={`px-3 py-1 text-sm rounded-lg transition-all mr-2 ${
                    showAssetLines
                      ? 'bg-secondary/20 text-secondary border border-secondary/30'
                      : 'bg-dark-800 text-dark-400 hover:text-light'
                  }`}
                  onClick={() => setShowAssetLines(!showAssetLines)}
                >
                  {showAssetLines ? 'Total only' : 'Per-asset lines'}
                </button>
                <div className="flex space-x-1 bg-dark-800 rounded-lg p-1">
                  {['1W', '1M', '3M', '6M', '1Y', 'ALL'].map((tf) => (
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
                
                <button className="p-2 rounded-lg bg-dark-800 text-dark-400 hover:text-light">
                  <Download size={18} />
                </button>
              </div>
            </div>
            
            <div className="h-80 flex items-center justify-center">
              {chartLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : chartData && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#888"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="#888"
                      style={{ fontSize: '12px' }}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#1a1a2e',
                        border: '1px solid #444',
                        borderRadius: '8px',
                        padding: '12px'
                      }}
                      formatter={(value) => {
                        if (value === null || value === undefined || Number.isNaN(value as number)) return ['—', 'Portfolio Value'];
                        return [
                          new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 2
                          }).format(value as number),
                          'Portfolio Value'
                        ];
                      }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Legend />
                    {/* Total portfolio value line — always shown */}
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#3D5AF1" 
                      dot={false}
                      strokeWidth={2}
                      name="Total Portfolio"
                    />
                    {/* Per-asset lines — shown when toggled */}
                    {showAssetLines && portfolioAssets.slice(0, 6).map((asset, i) => {
                      const colors = ['#22DFBF', '#F7931A', '#627EEA', '#8A2BE2', '#FF4D4D', '#FFCC4D'];
                      return (
                        <Line
                          key={asset.symbol}
                          type="monotone"
                          dataKey={`assets.${asset.symbol}`}
                          stroke={colors[i % colors.length]}
                          dot={false}
                          strokeWidth={1.5}
                          strokeDasharray="4 2"
                          name={asset.symbol}
                          connectNulls
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-dark-400">Loading performance chart...</p>
              )}
            </div>
            
            <div className="mt-4 grid grid-cols-3 gap-4">
              {performanceMetrics?.bestPerformingAsset ? (
                <>
                  <div className="bg-dark-800/50 rounded-lg p-4">
                    <p className="text-dark-400 text-sm">Best Performing Asset</p>
                    <p className="text-lg font-medium">{performanceMetrics.bestPerformingAsset?.symbol || '—'}</p>
                    <div className="flex items-center">
                      <TrendingUp size={16} className="text-secondary mr-1" />
                      <p className="text-secondary">{formatPercentage(performanceMetrics.bestPerformingAsset?.returnPercentage || 0)}</p>
                    </div>
                  </div>
                  
                  <div className="bg-dark-800/50 rounded-lg p-4">
                    <p className="text-dark-400 text-sm">Worst Performing Asset</p>
                    <p className="text-lg font-medium">{performanceMetrics.worstPerformingAsset?.symbol || '—'}</p>
                    <div className="flex items-center">
                      <TrendingDown size={16} className={`mr-1 ${(performanceMetrics.worstPerformingAsset?.returnPercentage || 0) < 0 ? 'text-red-500' : 'text-secondary'}`} />
                      <p className={(performanceMetrics.worstPerformingAsset?.returnPercentage || 0) < 0 ? 'text-red-500' : 'text-secondary'}>
                        {formatPercentage(performanceMetrics.worstPerformingAsset?.returnPercentage || 0)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-dark-800/50 rounded-lg p-4">
                    <p className="text-dark-400 text-sm">Portfolio Beta</p>
                    <p className="text-lg font-medium">{(performanceMetrics.beta || 1.0).toFixed(2)}</p>
                    <p className="text-xs text-dark-400">vs. S&P 500</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-dark-800/50 rounded-lg p-4">
                    <p className="text-dark-400 text-sm">Best Performing Asset</p>
                    <p className="text-lg font-medium">—</p>
                    <div className="flex items-center">
                      <p className="text-dark-400">Loading...</p>
                    </div>
                  </div>
                  
                  <div className="bg-dark-800/50 rounded-lg p-4">
                    <p className="text-dark-400 text-sm">Worst Performing Asset</p>
                    <p className="text-lg font-medium">—</p>
                    <div className="flex items-center">
                      <p className="text-dark-400">Loading...</p>
                    </div>
                  </div>
                  
                  <div className="bg-dark-800/50 rounded-lg p-4">
                    <p className="text-dark-400 text-sm">Portfolio Beta</p>
                    <p className="text-lg font-medium">—</p>
                    <p className="text-xs text-dark-400">Loading...</p>
                  </div>
                </>
              )}
            </div>
</GlassCard>

          {/* Portfolio Optimizer */}
          <GlassCard className="p-6 mt-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-semibold">Portfolio Optimizer</h3>
                <p className="text-dark-400 text-sm mt-1">
                  Rebalance your portfolio using Modern Portfolio Theory
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <select
                  className="input-field"
                  value={optimizerObjective}
                  onChange={(e) => setOptimizerObjective(e.target.value as any)}
                >
                  <option value="sharpe">Max Sharpe Ratio</option>
                  <option value="minvar">Min Variance</option>
                  <option value="maxreturn">Max Return</option>
                </select>
                <button
                  className="btn-primary flex items-center"
                  onClick={handleOptimize}
                  disabled={isOptimizing || portfolioAssets.length < 2}
                >
                  {isOptimizing ? (
                    <>
                      <RefreshCw size={16} className="mr-2 animate-spin" />
                      Optimizing...
                    </>
                  ) : (
                    <>
                      <TrendingUp size={16} className="mr-2" />
                      Optimize
                    </>
                  )}
                </button>
              </div>
            </div>

            {portfolioAssets.length < 2 && (
              <p className="text-dark-400 text-sm">
                Add at least 2 assets to use the optimizer.
              </p>
            )}

            {optimizerResult && (
              <div className="mt-4">
                {/* Metrics row */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-dark-800/50 rounded-lg p-4">
                    <p className="text-dark-400 text-sm">Expected Annual Return</p>
                    <p className="text-xl font-bold text-secondary">
                      {optimizerResult.metrics?.expectedReturnAnnual?.toFixed(2)}%
                    </p>
                  </div>
                  <div className="bg-dark-800/50 rounded-lg p-4">
                    <p className="text-dark-400 text-sm">Annual Volatility</p>
                    <p className="text-xl font-bold text-amber-400">
                      {optimizerResult.metrics?.volatilityAnnual?.toFixed(2)}%
                    </p>
                  </div>
                  <div className="bg-dark-800/50 rounded-lg p-4">
                    <p className="text-dark-400 text-sm">Sharpe Ratio</p>
                    <p className="text-xl font-bold text-primary">
                      {optimizerResult.metrics?.sharpeRatio?.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Suggested allocations */}
                <h4 className="text-sm font-medium text-dark-400 mb-3 uppercase tracking-wide">
                  Suggested Allocation
                </h4>
                <div className="space-y-3">
                  {optimizerResult.allocation?.map((item: any) => (
                    <div key={item.symbol} className="flex items-center">
                      <div className="w-16 text-sm font-medium">{item.symbol}</div>
                      <div className="flex-1 mx-3">
                        <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${item.weight}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-16 text-right text-sm font-medium">
                        {item.weight.toFixed(1)}%
                      </div>
                      {/* Show current vs suggested */}
                      <div className="w-24 text-right text-xs text-dark-400">
                        {(() => {
                          const current = portfolioAssets.find(a => a.symbol === item.symbol);
                          const diff = item.weight - (current?.allocation || 0);
                          return diff > 0.5
                            ? <span className="text-secondary">+{diff.toFixed(1)}%</span>
                            : diff < -0.5
                            ? <span className="text-red-400">{diff.toFixed(1)}%</span>
                            : <span className="text-dark-500">≈ current</span>;
                        })()}
                      </div>
                    </div>
                  ))}
                </div>

                {/* AI recommendation */}
                {optimizerResult.recommendation && (
                  <div className="mt-6 p-4 bg-primary/10 border border-primary/30 rounded-lg">
                    <p className="text-sm font-medium text-primary mb-1">AI Recommendation</p>
                    <p className="text-sm text-dark-300 leading-relaxed">
                      {optimizerResult.recommendation}
                    </p>
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        </TabsContent>      </Tabs>

      <AddAssetModal 
        isOpen={isAddAssetModalOpen}
        onClose={() => {
          setIsAddAssetModalOpen(false);
          setPreselectedAsset(null);
        }}
        onAssetAdded={() => {
          fetchPortfolioData();
          setPreselectedAsset(null);
        }}
        initialAsset={preselectedAsset}
      />

      <CSVImportModal 
        isOpen={isCSVImportModalOpen}
        onClose={() => setIsCSVImportModalOpen(false)}
        onImportSuccess={fetchPortfolioData}
      />

      <PortfolioRebalance
        portfolioId={portfolioIdRef.current || ''}
        isOpen={isRebalanceModalOpen}
        onClose={() => setIsRebalanceModalOpen(false)}
        onRebalanced={fetchPortfolioData}
      />
    </div>
  );
};

export default Portfolio;