import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import PortfolioSummary from '../../components/dashboard/PortfolioSummary';
import PerformanceChart from '../../components/dashboard/PerformanceChart';
import AssetAllocation from '../../components/dashboard/AssetAllocation';
import RecentTransactions from '../../components/dashboard/RecentTransactions';
import AiInsights from '../../components/dashboard/AiInsights';
import MarketOverview from '../../components/trading/MarketOverview';
import { exportPortfolioData, getPortfolioSummary, getPortfolioAssets, getPortfolioHistory, getRecentTransactions, PortfolioSummary as PortfolioSummaryType, PortfolioAsset, PerformanceData, Transaction, AiInsight } from '../../services/portfolio.service';
import { getDepositAddress, getWallets, DepositAddress } from '../../services/wallet.service';
import { getMarketAssets, MarketAsset } from '../../services/market.service';
import aiService from '../../services/ai.service';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const Dashboard: React.FC = () => {
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummaryType | null>(null);
  const [chartData, setChartData] = useState<PerformanceData[]>([]);
  const [portfolioAssets, setPortfolioAssets] = useState<PortfolioAsset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [aiInsights, setAiInsights] = useState<AiInsight[]>([]);
  const [marketAssets, setMarketAssets] = useState<MarketAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [depositLoading, setDepositLoading] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositInfo, setDepositInfo] = useState<DepositAddress | null>(null);
  const [depositWalletName, setDepositWalletName] = useState<string | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [marketSummary, setMarketSummary] = useState(null);
  const portfolioSocketRef = React.useRef(null);

  const downloadExportFile = (data: any, format: 'pdf' | 'excel') => {
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
      doc.text(`Total Value: $${safeValue(data.summary?.totalValue).toFixed(2)}`, 20, y);
      y += 10;
      doc.text(`Daily Change: $${safeValue(data.summary?.dailyChange).toFixed(2)} (${safeValue(data.summary?.dailyChangePercentage).toFixed(2)}%)`, 20, y);
      y += 10;
      doc.text(`Weekly Change: $${safeValue(data.summary?.weeklyChange).toFixed(2)} (${safeValue(data.summary?.weeklyChangePercentage).toFixed(2)}%)`, 20, y);
      y += 10;
      doc.text(`Monthly Change: $${safeValue(data.summary?.monthlyChange).toFixed(2)} (${safeValue(data.summary?.monthlyChangePercentage).toFixed(2)}%)`, 20, y);
      y += 20;
      
      doc.text('Assets', 20, y);
      y += 10;
      if (data.assets && Array.isArray(data.assets) && data.assets.length > 0) {
        data.assets.forEach((asset: PortfolioAsset) => {
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
      if (data.transactions && Array.isArray(data.transactions) && data.transactions.length > 0) {
        data.transactions.slice(0, 10).forEach((txn: Transaction) => {
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
        ['Total Value', safeValue(data.summary?.totalValue)],
        ['Daily Change', safeValue(data.summary?.dailyChange)],
        ['Daily Change %', safeValue(data.summary?.dailyChangePercentage)],
        ['Weekly Change', safeValue(data.summary?.weeklyChange)],
        ['Weekly Change %', safeValue(data.summary?.weeklyChangePercentage)],
        ['Monthly Change', safeValue(data.summary?.monthlyChange)],
        ['Monthly Change %', safeValue(data.summary?.monthlyChangePercentage)],
        ['All Time Profit', safeValue(data.summary?.allTimeProfit)],
        ['All Time Profit %', safeValue(data.summary?.allTimeProfitPercentage)]
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      
      // Assets sheet
      const assetsData = [
        ['Asset', 'Symbol', 'Type', 'Price', 'Change 24h', 'Quantity', 'Value', 'Allocation', 'P&L', 'P&L %', 'Avg Buy Price']
      ].concat((data.assets || []).map((asset: PortfolioAsset) => [
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
      ].concat((data.transactions || []).map((txn: Transaction) => [
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
      // Use current state data for export
      const exportData = {
        summary: portfolioSummary,
        assets: portfolioAssets,
        history: chartData,
        transactions: transactions
      };
      downloadExportFile(exportData, exportFormat);
    } catch (error) {
      console.error('Error exporting portfolio data:', error);
    } finally {
      setExporting(false);
    }
  };

  const handlePerformanceTimeframeChange = useCallback(async (timeframe: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL') => {
    try {
      // Map timeframe to query parameters that backend should understand
      // You may need to adjust these based on your backend's actual parameter names
      const timeframeMap = {
        '1D': '1d',
        '1W': '1w',
        '1M': '1m',
        '3M': '3m',
        '1Y': '1y',
        'ALL': 'all'
      };

      // Call getPortfolioHistory with timeframe parameter
      // Note: If backend doesn't support this, you may need to modify the service
      const response = await getPortfolioHistory(timeframeMap[timeframe]);
      
      if (response?.data && Array.isArray(response.data) && response.data.length > 0) {
        setChartData(response.data);
        console.log(`✓ Portfolio History loaded for ${timeframe}:`, response.data.length, 'data points');
      } else {
        console.warn(`Portfolio History for ${timeframe} returned empty data`);
      }
    } catch (error) {
      console.error(`Error fetching portfolio history for ${timeframe}:`, error);
      // Keep existing data on error
    }
  }, []);

  const calculateAssetAllocations = (assets: PortfolioAsset[]): PortfolioAsset[] => {
    // Calculate total portfolio value
    const totalValue = assets.reduce((sum, asset) => sum + (asset.value || 0), 0);
    
    // If all allocations are 0, calculate them
    if (totalValue > 0 && assets.every(asset => asset.allocation === 0 || asset.allocation === undefined)) {
      return assets.map(asset => ({
        ...asset,
        allocation: totalValue > 0 ? (asset.value / totalValue) * 100 : 0
      }));
    }
    
    // Otherwise return as-is
    return assets;
  };

  const handleAddFunds = async () => {
    setDepositLoading(true);
    setDepositError(null);
    try {
      const walletsResponse = await getWallets();
      const userWallets = walletsResponse.data || [];
      if (!userWallets.length) {
        setDepositError('No connected wallets found. Please connect a wallet from the Wallet page first.');
        setShowDepositModal(true);
        return;
      }

      const wallet = userWallets[0];
      const asset = wallet.balances?.[0]?.symbol || 'USDT';
      const network = wallet.network || 'BNB';
      const depositResponse = await getDepositAddress({ walletId: wallet._id, asset, network });
      const depositPayload = depositResponse.data || depositResponse;

      setDepositWalletName(wallet.name);
      setDepositInfo(depositPayload);
      setShowDepositModal(true);
    } catch (error) {
      console.error('Error fetching deposit address:', error);
      setDepositError((error as Error).message || 'Failed to get deposit address.');
      setShowDepositModal(true);
    } finally {
      setDepositLoading(false);
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // 🔥 FAST PATH: Fetch portfolio summary FIRST to display instantly
        try {
          const summaryResponse = await getPortfolioSummary();
          if (summaryResponse?.data) {
            setPortfolioSummary(summaryResponse.data);
            console.log('✓ Portfolio Summary loaded instantly:', summaryResponse.data);
          }
        } catch (err) {
          console.warn('Portfolio Summary fetch failed:', err);
        }

        // 🔥 PARALLEL: Fetch remaining data in parallel while summary displays
        const [assets, history, txns, marketData, aiInsightsData] = await Promise.allSettled([
          getPortfolioAssets(),
          getPortfolioHistory(),
          getRecentTransactions(),
          getMarketAssets(),
          // Fetch AI insights using aiService like the AIInsights page does
          aiService.analyzeNews('BTC,ETH,SOL', 'general,technical', '48h', 5)
            .then(data => {
              // Format insights from news analysis
              const analysisData = data?.analysis || data?.articles || [];
              const formatted: AiInsight[] = analysisData
                .slice(0, 5)
                .map((insight: any) => ({
                  id: `insight-${Date.now()}-${Math.random()}`,
                  type: (insight.type || 'prediction') as 'prediction' | 'alert' | 'recommendation' | 'news',
                  title: insight.title || 'Market Event',
                  description: insight.summary || insight.description || 'AI analysis of market developments',
                  asset: insight.asset || {
                    id: 'btc',
                    name: 'Bitcoin',
                    symbol: 'BTC',
                    type: 'crypto' as const,
                    price: 0,
                    change24h: 0
                  },
                  confidence: insight.confidence || 75,
                  date: insight.timestamp || new Date().toISOString(),
                  action: (insight.sentiment === 'positive' ? 'buy' : insight.sentiment === 'negative' ? 'sell' : 'hold') as 'buy' | 'sell' | 'hold'
                }));
              return { status: 'success', data: formatted };
            })
            .catch((error) => {
              console.warn('AI insights fetch failed (non-critical):', error);
              return { status: 'error', data: [] };
            })
        ]);

        if (assets.status === 'fulfilled' && assets.value?.data && Array.isArray(assets.value.data) && assets.value.data.length > 0) {
          const assetsWithAllocations = calculateAssetAllocations(assets.value.data);
          setPortfolioAssets(assetsWithAllocations);
          console.log('✓ Portfolio Assets loaded:', assetsWithAllocations.length, 'assets');
        } else if (assets.status === 'rejected') {
          console.warn('Portfolio Assets fetch failed:', assets.reason);
        }

        if (history.status === 'fulfilled' && history.value?.data && Array.isArray(history.value.data) && history.value.data.length > 0) {
          setChartData(history.value.data);
          console.log('✓ Portfolio History loaded:', history.value.data.length, 'data points');
        } else if (history.status === 'rejected') {
          console.warn('Portfolio History fetch failed:', history.reason);
        }

        if (txns.status === 'fulfilled' && txns.value?.data && Array.isArray(txns.value.data) && txns.value.data.length > 0) {
          setTransactions(txns.value.data);
          console.log('✓ Recent Transactions loaded:', txns.value.data.length, 'transactions');
        } else if (txns.status === 'rejected') {
          console.warn('Recent Transactions fetch failed:', txns.reason);
        }

        if (marketData.status === 'fulfilled' && marketData.value?.data && Array.isArray(marketData.value.data) && marketData.value.data.length > 0) {
          setMarketAssets(marketData.value.data);
          console.log('✓ Market Assets loaded:', marketData.value.data.length, 'assets');
        } else if (marketData.status === 'rejected') {
          console.warn('Market Assets fetch failed:', marketData.reason);
        }

        if (aiInsightsData.status === 'fulfilled' && aiInsightsData.value?.data && Array.isArray(aiInsightsData.value.data)) {
          if (aiInsightsData.value.data.length > 0) {
            setAiInsights(aiInsightsData.value.data);
            console.log('✓ AI Insights loaded from /api/ai/news/analysis:', aiInsightsData.value.data.length, 'insights');
          } else {
            console.warn('AI Insights returned empty array — no insights to show');
          }
        } else if (aiInsightsData.status === 'rejected') {
          console.warn('AI Insights fetch failed:', aiInsightsData.reason);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setDataError('Failed to load dashboard data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Subscribe to portfolio WebSocket for live P&L updates
  useEffect(() => {
    const stored = localStorage.getItem('neofin_auth');
    const token  = stored ? JSON.parse(stored).accessToken : null;
    if (!token) return;

    const WS_URL = (import.meta as any).env?.VITE_WS_URL || window.location.origin;
    const socket = io(`${WS_URL}/portfolio`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    portfolioSocketRef.current = socket;

    socket.on('portfolio_update', (data: any) => {
      if (data) setPortfolioSummary(data);
    });

    socket.on('connect_error', (err: Error) => {
      console.warn('[Portfolio Socket] connect_error:', err.message);
    });

    return () => {
      socket.disconnect();
      portfolioSocketRef.current = null;
    };
  }, []);

  // Fetch market summary
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await getMarketSummary();
        if (res?.data) setMarketSummary(res.data);
      } catch {}
    };
    fetchSummary();
    const interval = setInterval(fetchSummary, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 p-4 sm:p-6 lg:p-8">
      {/* Market Summary Bar */}
      {marketSummary && (
        <div className="bg-gradient-to-r from-dark-800 to-dark-700 border border-gray-700 rounded-xl p-3 mb-6 text-xs sm:text-sm text-gray-300 space-y-2 sm:space-y-0 sm:flex sm:gap-3 md:gap-6 sm:items-center overflow-x-auto">
          {marketSummary.totalMarketCap && (
            <div className="whitespace-nowrap">Market Cap: <span className="font-semibold text-white">${(marketSummary.totalMarketCap / 1e12).toFixed(2)}T</span></div>
          )}
          {marketSummary.volume24h && (
            <div className="whitespace-nowrap">24h Vol: <span className="font-semibold text-white">${(marketSummary.volume24h / 1e9).toFixed(1)}B</span></div>
          )}
          {marketSummary.btcDominance && (
            <div className="whitespace-nowrap">BTC Dom: <span className="font-semibold text-white">{marketSummary.btcDominance.toFixed(1)}%</span></div>
          )}
          {marketSummary.fearGreedIndex && (
            <div className="whitespace-nowrap">Fear & Greed: <span className={`font-semibold ${marketSummary.fearGreedIndex > 60 ? 'text-red-400' : marketSummary.fearGreedIndex < 40 ? 'text-green-400' : 'text-yellow-400'}`}>{marketSummary.fearGreedIndex}</span></div>
          )}
          {marketSummary.topGainer && (
            <div className="whitespace-nowrap">Top Gainer: <span className="font-semibold text-green-400">{marketSummary.topGainer.symbol} +{marketSummary.topGainer.change.toFixed(2)}%</span></div>
          )}
        </div>
      )}
      {dataError && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 text-red-200 mb-4">
          <p className="text-sm">{dataError}</p>
          <button
            onClick={() => { setDataError(null); window.location.reload(); }}
            className="mt-2 text-xs underline text-red-300 hover:text-red-100"
          >
            Retry
          </button>
        </div>
      )}
      <div className="container mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'excel')}
              className="px-3 py-2 bg-dark-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
            </select>
            <button
              className="btn-outline text-sm whitespace-nowrap"
              onClick={handleExportData}
              disabled={exporting}
            >
              {exporting ? 'Exporting…' : 'Export'}
            </button>
            <button
              className="btn-primary text-sm whitespace-nowrap"
              onClick={handleAddFunds}
              disabled={depositLoading}
            >
              {depositLoading ? 'Loading…' : 'Add Funds'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 gap-6">
              <PortfolioSummary data={portfolioSummary} />
              <PerformanceChart data={chartData} onTimeframeChange={handlePerformanceTimeframeChange} />
              <MarketOverview assets={marketAssets} />
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="grid grid-cols-1 gap-6">
              <AssetAllocation assets={portfolioAssets} />
              <AiInsights insights={aiInsights} />
              <RecentTransactions transactions={transactions} />
            </div>
          </div>
        </div>
      </div>
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-700 bg-dark-800 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-700">
              <div>
                <h3 className="text-xl font-semibold">Add Funds</h3>
                <p className="text-sm text-gray-400">
                  Use the deposit instructions below to add funds to your connected wallet.
                </p>
              </div>
              <button
                className="text-gray-300 hover:text-white"
                onClick={() => {
                  setShowDepositModal(false);
                  setDepositInfo(null);
                  setDepositWalletName(null);
                  setDepositError(null);
                }}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="mt-6 space-y-4">
              {depositError ? (
                <div className="rounded-xl border border-red-600 bg-red-950/50 p-4 text-sm text-red-200">
                  {depositError}
                </div>
              ) : depositInfo ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-700 bg-dark-900 p-4">
                    <p className="text-sm text-gray-400">Wallet</p>
                    <p className="text-base font-medium text-white">{depositWalletName}</p>
                  </div>
                  <div className="rounded-xl border border-gray-700 bg-dark-900 p-4">
                    <p className="text-sm text-gray-400">Deposit Address</p>
                    <p className="break-all text-base font-medium text-white">{depositInfo.address}</p>
                    {depositInfo.tag && (
                      <p className="mt-2 text-sm text-gray-300">Tag/Memo: {depositInfo.tag}</p>
                    )}
                    <p className="mt-2 text-sm text-gray-300">Network: {depositInfo.network}</p>
                    {depositInfo.note && (
                      <p className="mt-3 p-2 rounded bg-blue-900/30 border border-blue-700/50 text-xs text-blue-300">
                        ℹ️ {depositInfo.note}
                      </p>
                    )}
                    {depositInfo.url && (
                      <p className="mt-2">
                        <a href={depositInfo.url} target="_blank" rel="noreferrer" className="text-primary underline">
                          View on exchange
                        </a>
                      </p>
                    )}
                  </div>
                  <button
                    className="btn-primary w-full"
                    onClick={() => {
                      navigator.clipboard.writeText(depositInfo.address);
                      toast.success('Address copied to clipboard!');
                    }}
                  >
                    Copy Address
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-700 bg-dark-900 p-4 text-sm text-gray-300">
                  Preparing deposit instructions, please wait.
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                className="btn-outline"
                onClick={() => {
                  setShowDepositModal(false);
                  setDepositInfo(null);
                  setDepositWalletName(null);
                  setDepositError(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;