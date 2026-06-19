import React, { useState, useEffect, useCallback } from 'react';
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

// Mock data - fallback if API fails
const fallbackPortfolioSummary: PortfolioSummaryType = {
  totalValue: 124567.89,
  dailyChange: 1234.56,
  dailyChangePercentage: 1.23,
  weeklyChange: 2345.67,
  weeklyChangePercentage: 2.34,
  monthlyChange: 3456.78,
  monthlyChangePercentage: 3.45,
  allTimeProfit: 12345.67,
  allTimeProfitPercentage: 12.34
};

const fallbackChartData: PerformanceData[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (30 - i));

  // Create a somewhat realistic price curve
  const baseValue = 100000;
  const trend = Math.sin(i / 5) * 10000;
  const random = (Math.random() - 0.5) * 5000;
  const value = baseValue + trend + random + (i * 500);

  return {
    timestamp: date.getTime(),
    value: value
  };
});

const fallbackPortfolioAssets: PortfolioAsset[] = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC', type: 'crypto', price: 43567.89, change24h: 2.34, marketCap: 845000000000, volume24h: 28000000000, quantity: 0.5, value: 21783.95, allocation: 40, profitLoss: 5000, profitLossPercentage: 25, averageBuyPrice: 33567.89 },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH', type: 'crypto', price: 2345.67, change24h: 1.23, marketCap: 280000000000, volume24h: 15000000000, quantity: 5, value: 11728.35, allocation: 25, profitLoss: 2000, profitLossPercentage: 15, averageBuyPrice: 1945.67 },
  { id: 'sol', name: 'Solana', symbol: 'SOL', type: 'crypto', price: 123.45, change24h: 5.67, marketCap: 52000000000, volume24h: 3500000000, quantity: 50, value: 6172.5, allocation: 15, profitLoss: 1500, profitLossPercentage: 30, averageBuyPrice: 93.45 },
  { id: 'usdc', name: 'USD Coin', symbol: 'USDC', type: 'crypto', price: 1, change24h: 0, marketCap: 25000000000, volume24h: 5000000000, quantity: 1000, value: 1000, allocation: 10, profitLoss: 0, profitLossPercentage: 0, averageBuyPrice: 1 },
  { id: 'aapl', name: 'Apple', symbol: 'AAPL', type: 'stock', price: 178.90, change24h: -0.45, marketCap: 2800000000000, volume24h: 5600000000, quantity: 10, value: 1789, allocation: 5, profitLoss: -50, profitLossPercentage: -2.5, averageBuyPrice: 183.40 },
  { id: 'tsla', name: 'Tesla', symbol: 'TSLA', type: 'stock', price: 245.67, change24h: -1.23, marketCap: 780000000000, volume24h: 3200000000, quantity: 5, value: 1228.35, allocation: 5, profitLoss: -100, profitLossPercentage: -5, averageBuyPrice: 265.67 },
  { id: 'xau', name: 'Gold', symbol: 'XAU', type: 'commodity', price: 1945.67, change24h: 0.34, marketCap: undefined, volume24h: undefined, quantity: 0.5, value: 972.84, allocation: 3, profitLoss: 30, profitLossPercentage: 3, averageBuyPrice: 1915.67 },
  { id: 'eurusd', name: 'EUR/USD', symbol: 'EUR/USD', type: 'forex', price: 1.0923, change24h: -0.12, marketCap: undefined, volume24h: undefined, quantity: 1000, value: 1092.3, allocation: 2, profitLoss: -15, profitLossPercentage: -1.2, averageBuyPrice: 1.1053 }
];

const fallbackTransactions: Transaction[] = [
  { id: '1', type: 'buy', asset: { id: 'btc', name: 'Bitcoin', symbol: 'BTC', type: 'crypto', price: 43567.89, change24h: 2.34 }, quantity: 0.1, price: 43567.89, total: 4356.79, fee: 4.36, date: '2023-04-15T10:30:00Z', status: 'completed' },
  { id: '2', type: 'sell', asset: { id: 'eth', name: 'Ethereum', symbol: 'ETH', type: 'crypto', price: 2345.67, change24h: 1.23 }, quantity: 1.5, price: 2345.67, total: 3518.51, fee: 3.52, date: '2023-04-12T14:45:00Z', status: 'completed' },
  { id: '3', type: 'buy', asset: { id: 'sol', name: 'Solana', symbol: 'SOL', type: 'crypto', price: 123.45, change24h: 5.67 }, quantity: 20, price: 123.45, total: 2469.00, fee: 2.47, date: '2023-04-10T09:15:00Z', status: 'completed' },
  { id: '4', type: 'transfer', asset: { id: 'usdc', name: 'USD Coin', symbol: 'USDC', type: 'crypto', price: 1, change24h: 0 }, quantity: 1000, price: 1, total: 1000, fee: 0, date: '2023-04-05T16:20:00Z', status: 'completed' },
  { id: '5', type: 'stake', asset: { id: 'eth', name: 'Ethereum', symbol: 'ETH', type: 'crypto', price: 2345.67, change24h: 1.23 }, quantity: 2, price: 2345.67, total: 4691.34, fee: 0, date: '2023-04-01T11:10:00Z', status: 'completed' }
];

const fallbackAiInsights: AiInsight[] = [
  { id: '1', type: 'prediction', title: 'BTC Price Prediction', description: 'Based on current market conditions, BTC is likely to test the $48,000 resistance level within the next 7 days.', asset: { id: 'btc', name: 'Bitcoin', symbol: 'BTC', type: 'crypto', price: 43567.89, change24h: 2.34 }, confidence: 85, date: '2h ago', action: 'buy' },
  { id: '2', type: 'alert', title: 'Market Volatility Alert', description: 'Increased market volatility expected due to upcoming Federal Reserve announcement on interest rates.', confidence: 90, date: '5h ago' },
  { id: '3', type: 'recommendation', title: 'Portfolio Rebalancing', description: 'Consider increasing allocation to SOL as technical indicators suggest strong upward momentum.', asset: { id: 'sol', name: 'Solana', symbol: 'SOL', type: 'crypto', price: 123.45, change24h: 5.67 }, confidence: 75, date: '1d ago', action: 'buy' },
  { id: '4', type: 'news', title: 'Regulatory Development', description: 'New crypto regulations in EU could positively impact compliant projects like ETH and XRP.', confidence: 80, date: '2d ago' }
];

// Additional market assets for the Market Overview component - now fetched from API
// const marketAssets = [
//   ...fallbackPortfolioAssets.map(asset => ({
//     id: asset.id,
//     name: asset.name,
//     symbol: asset.symbol,
//     type: asset.type,
//     price: asset.price,
//     change24h: asset.change24h,
//     marketCap: asset.marketCap,
//     volume24h: asset.volume24h,
//     logo: undefined
//   })),
//   { id: '8', name: 'Cardano', symbol: 'ADA', type: 'crypto' as const, price: 0.45, change24h: -5.8, marketCap: 15800000000, volume24h: 980000000, logo: undefined },
//   { id: '9', name: 'Polkadot', symbol: 'DOT', type: 'crypto' as const, price: 6.78, change24h: 3.2, marketCap: 8500000000, volume24h: 450000000, logo: undefined },
//   { id: '10', name: 'Avalanche', symbol: 'AVAX', type: 'crypto' as const, price: 34.56, change24h: 7.8, marketCap: 12300000000, volume24h: 890000000, logo: undefined },
//   { id: '11', name: 'Microsoft', symbol: 'MSFT', type: 'stock' as const, price: 345.67, change24h: 0.8, marketCap: 2580000000000, volume24h: 4300000000, logo: undefined },
//   { id: '12', name: 'Amazon', symbol: 'AMZN', type: 'stock' as const, price: 178.45, change24h: 1.2, marketCap: 1840000000000, volume24h: 3900000000, logo: undefined },
//   { id: '13', name: 'Silver', symbol: 'XAG', type: 'commodity' as const, price: 24.56, change24h: 0.5, marketCap: undefined, volume24h: undefined, logo: undefined },
//   { id: '14', name: 'USD/JPY', symbol: 'USD/JPY', type: 'forex' as const, price: 151.23, change24h: 0.3, marketCap: undefined, volume24h: undefined, logo: undefined },
//   { id: '15', name: 'GBP/USD', symbol: 'GBP/USD', type: 'forex' as const, price: 1.2567, change24h: -0.4, marketCap: undefined, volume24h: undefined, logo: undefined }
// ];

const Dashboard: React.FC = () => {
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummaryType>(fallbackPortfolioSummary);
  const [chartData, setChartData] = useState<PerformanceData[]>(fallbackChartData);
  const [portfolioAssets, setPortfolioAssets] = useState<PortfolioAsset[]>(fallbackPortfolioAssets);
  const [transactions, setTransactions] = useState<Transaction[]>(fallbackTransactions);
  const [aiInsights, setAiInsights] = useState<AiInsight[]>(fallbackAiInsights);
  const [marketAssets, setMarketAssets] = useState<MarketAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [depositLoading, setDepositLoading] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositInfo, setDepositInfo] = useState<DepositAddress | null>(null);
  const [depositWalletName, setDepositWalletName] = useState<string | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);

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

        // Fetch real data from APIs with fallback to mock data
        const [summary, assets, history, txns, marketData, aiInsightsData] = await Promise.allSettled([
          getPortfolioSummary(),
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
              console.warn('AI insights fetch failed, using fallback:', error);
              return { status: 'error', data: fallbackAiInsights };
            })
        ]);

        // Update state with real data if available, otherwise keep fallback
        if (summary.status === 'fulfilled' && summary.value?.data) {
          setPortfolioSummary(summary.value.data);
          console.log('✓ Portfolio Summary loaded:', summary.value.data);
        } else if (summary.status === 'rejected') {
          console.warn('Portfolio Summary fetch failed:', summary.reason);
        }

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
            console.warn('AI Insights returned empty array, using fallback');
          }
        } else if (aiInsightsData.status === 'rejected') {
          console.warn('AI Insights fetch failed:', aiInsightsData.reason);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Keep fallback data on error
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
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
      <div className="container mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <h2 className="text-2xl font-bold mb-4 sm:mb-0">Dashboard</h2>
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
              className="btn-outline"
              onClick={handleExportData}
              disabled={exporting}
            >
              {exporting ? 'Exporting…' : 'Export Data'}
            </button>
            <button
              className="btn-primary"
              onClick={handleAddFunds}
              disabled={depositLoading}
            >
              {depositLoading ? 'Loading…' : 'Add Funds'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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