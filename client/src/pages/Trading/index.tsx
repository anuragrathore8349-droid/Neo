import React, { useState, useEffect, useCallback, Component, ErrorInfo } from 'react';
import { io } from 'socket.io-client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/common/Tabs';
import GlassCard from '../../components/common/GlassCard';
import PriceTicker from '../../components/common/PriceTicker';
import MarketOverview from '../../components/trading/MarketOverview';
import MarketChart from '../../components/trading/MarketChart';
import OrderBook from '../../components/trading/OrderBook';
import TradeForm from '../../components/trading/TradeForm';
import OrderHistory from '../../components/trading/OrderHistory';
import Watchlist from '../../components/trading/Watchlist';
import DepositModal from '../../components/trading/DepositModal';
import PriceAlerts from '../../components/trading/PriceAlerts';
import { useMarketSocket } from '../../hooks/useMarketSocket';
import * as tradingApi from '../../services/trading.service';
import * as marketApi from '../../services/market.service';
import { Asset } from '../../types';
import {
  Search, Star, Loader, RefreshCw, AlertCircle,
  TrendingUp, TrendingDown, BarChart2, ArrowDownCircle, X,
} from 'lucide-react';

const ASSET_REFRESH_INTERVAL = 30_000;
const ORDER_REFRESH_INTERVAL = 15_000;

// ── Chart error boundary ─────────────────────────────────────────────────────
class ChartErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: Error, i: ErrorInfo) { console.error('[Chart]', e, i); }
  render() {
    if (this.state.hasError)
      return (
        <GlassCard className="flex items-center justify-center p-6" style={{ minHeight: 420 }}>
          <div className="text-center text-dark-400 text-sm">
            Chart failed to render.{' '}
            <button
              className="text-primary underline ml-1"
              onClick={() => this.setState({ hasError: false })}
            >
              Retry
            </button>
          </div>
        </GlassCard>
      );
    return this.props.children;
  }
}

// ── Main component ───────────────────────────────────────────────────────────
const Trading: React.FC = () => {
  const [activeTab,       setActiveTab]       = useState('market');
  const [orderSubTab,     setOrderSubTab]      = useState<'open' | 'history'>('open');
  const [searchTerm,      setSearchTerm]       = useState('');
  const [assetTypeFilter, setAssetTypeFilter]  = useState<string | null>(null);
  const [selectedAsset,   setSelectedAsset]    = useState<Asset | null>(null);
  const [assets,          setAssets]           = useState<Asset[]>([]);
  const [watchlist,       setWatchlist]        = useState<string[]>([]);
  const [orderBookData,   setOrderBookData]    = useState<{ asks: any[]; bids: any[] }>({ asks: [], bids: [] });
  const [chartData,       setChartData]        = useState<any[]>([]);
  const [openOrders,      setOpenOrders]       = useState<any[]>([]);
  const [orderHistory,    setOrderHistory]     = useState<any[]>([]);
  const [isAssetsLoading, setIsAssetsLoading]  = useState(false);
  const [isOrdersLoading, setIsOrdersLoading]  = useState(false);
  const [isChartLoading,  setIsChartLoading]   = useState(false);
  const [isDepositOpen,   setIsDepositOpen]    = useState(false);
  const [isPaperMode,     setIsPaperMode]      = useState(true); // Default to paper mode for safety
  const [chartInterval,   setChartInterval]    = useState('1d');
  const [portfolio,       setPortfolio]        = useState<any>(null);
  const [error,           setError]            = useState<string | null>(null);
  const [showAssetPanel,  setShowAssetPanel]   = useState(false);

  const intervalLabelMap: Record<string, string> = {
    '1H': '1h', '4H': '4h', '1D': '1d', '1W': '1w', '1M': '1d',
  };

  // ── WebSocket order book (trading namespace) ──────────────────────────────
  useEffect(() => {
    if (!selectedAsset) return;
    const SOCKET_URL = (import.meta as any).env?.VITE_WS_URL || window.location.origin;
    const stored = localStorage.getItem('neofin_auth');
    const token = stored ? JSON.parse(stored)?.accessToken : null;
    if (!token) return;

    const tradingSocket = io(`${SOCKET_URL}/trading`, {
      auth: { token },
      transports: ['websocket'],
    });

    tradingSocket.on('connect', () => {
      tradingSocket.emit('subscribeOrderbook', { symbol: selectedAsset.symbol });
    });

    tradingSocket.on('orderbook', (data: any) => {
      if (data?.symbol === selectedAsset?.symbol && data?.data) {
        setOrderBookData(data.data);
      }
    });

    return () => {
      tradingSocket.emit('unsubscribeOrderbook', { symbol: selectedAsset.symbol });
      tradingSocket.disconnect();
    };
  }, [selectedAsset?.symbol]);

  // ── WebSocket live price updates ──────────────────────────────────────────
  useMarketSocket({
    symbols: assets.map(a => a.symbol),
    enabled: assets.length > 0,
    onPriceUpdate: ({ symbol, price }) => {
      setAssets(prev => prev.map(a => a.symbol === symbol ? { ...a, price } : a));
      setSelectedAsset(prev => prev?.symbol === symbol ? { ...prev, price } : prev);
    },
  });

  // ── Fetch assets ──────────────────────────────────────────────────────────
  const fetchMarketAssets = useCallback(async (silent = false) => {
    if (!silent) setIsAssetsLoading(true);
    setError(null);
    try {
      const response     = await marketApi.getMarketAssets();
      const marketAssets = (response.data || []) as Asset[];
      setAssets(marketAssets);
      if (!selectedAsset && marketAssets.length > 0) {
        setSelectedAsset(marketAssets[0]);
      } else if (selectedAsset) {
        const updated = marketAssets.find(a => a.symbol === selectedAsset.symbol);
        if (updated) setSelectedAsset(updated);
      }
    } catch {
      setError('Failed to load market data. Please try again.');
    } finally {
      if (!silent) setIsAssetsLoading(false);
    }
  }, [selectedAsset]);

  useEffect(() => {
    fetchMarketAssets();
    const id = window.setInterval(() => fetchMarketAssets(true), ASSET_REFRESH_INTERVAL);
    return () => window.clearInterval(id);
  }, []);

  // ── Watchlist ─────────────────────────────────────────────────────────────
  const fetchWatchlist = useCallback(async () => {
    try {
      const r = await marketApi.getWatchlist();
      setWatchlist(r.data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchWatchlist(); }, []);

  const toggleWatchlist = useCallback(async (symbol: string) => {
    const upper  = symbol.toUpperCase();
    const inList = watchlist.includes(upper);
    setWatchlist(prev => inList ? prev.filter(s => s !== upper) : [...prev, upper]);
    try {
      await (inList ? marketApi.removeFromWatchlist(upper) : marketApi.addToWatchlist(upper));
    } catch {
      // rollback
      setWatchlist(prev => inList ? [...prev, upper] : prev.filter(s => s !== upper));
    }
  }, [watchlist]);

  // ── Chart ─────────────────────────────────────────────────────────────────
  const fetchChartData = useCallback(async (symbol: string, interval: string) => {
    setIsChartLoading(true);
    try {
      const response = await marketApi.getPriceHistory(symbol, interval);
      const prices   = response.data?.prices || response.data || [];
      setChartData(
        Array.isArray(prices)
          ? prices.map((p: any) => ({
              date:   new Date(p.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              open:   p.open,
              close:  p.close,
              high:   p.high,
              low:    p.low,
              volume: p.volume || 0,
            }))
          : []
      );
    } catch {
      setChartData([]);
    } finally {
      setIsChartLoading(false);
    }
  }, []);

  // ── Order book ────────────────────────────────────────────────────────────
  const fetchOrderBook = useCallback(async (symbol: string) => {
    try {
      const response = await tradingApi.getOrderBook(symbol, 20);
      const data     = (response as any).data || response;
      setOrderBookData({ asks: data.asks || [], bids: data.bids || [] });
    } catch { /* non-critical */ }
  }, []);

  // ── Orders ────────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async (symbol?: string) => {
    try {
      const [openRes, histRes] = await Promise.all([
        tradingApi.getOpenOrders(symbol),
        tradingApi.getOrderHistory(undefined, undefined, undefined, 100),
      ]);
      setOpenOrders((openRes  as any).data || []);
      setOrderHistory((histRes as any).data || []);
    } catch { /* non-critical */ }
  }, []);

  // ── Paper portfolio ───────────────────────────────────────────────────────
  const fetchPortfolio = useCallback(async () => {
    try {
      const r = await tradingApi.getPaperPortfolio();
      setPortfolio((r as any).data || r);
    } catch { /* non-critical */ }
  }, []);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedAsset) return;
    fetchChartData(selectedAsset.symbol, chartInterval);
    fetchOrderBook(selectedAsset.symbol);
    fetchOrders(selectedAsset.symbol);
  }, [selectedAsset?.symbol]);

  useEffect(() => {
    if (!selectedAsset) return;
    fetchChartData(selectedAsset.symbol, chartInterval);
  }, [chartInterval]);

  useEffect(() => {
    if (!selectedAsset) return;
    const id = window.setInterval(() => fetchOrderBook(selectedAsset.symbol), 10_000);
    return () => window.clearInterval(id);
  }, [selectedAsset?.symbol]);

  useEffect(() => {
    const id = window.setInterval(() => fetchOrders(selectedAsset?.symbol), ORDER_REFRESH_INTERVAL);
    return () => window.clearInterval(id);
  }, [selectedAsset?.symbol]);

  // Fetch portfolio on mount and whenever paper mode toggles
  useEffect(() => { fetchPortfolio(); }, [isPaperMode]);

  // ── Balances for TradeForm ────────────────────────────────────────────────
  const availableBalance     = portfolio?.balance ?? 0;
  const availableAssetAmount = selectedAsset
    ? portfolio?.holdings?.find((h: any) => h.symbol?.toUpperCase() === selectedAsset.symbol?.toUpperCase())?.quantity ?? 0
    : 0;

  // ── Place order ───────────────────────────────────────────────────────────
  const handlePlaceOrder = useCallback(async (order: any) => {
    if (!selectedAsset) return;
    setIsOrdersLoading(true);
    try {
      if (isPaperMode) {
        await tradingApi.placePaperTrade({
          symbol: selectedAsset.symbol,
          side:   order.side,
          amount: order.amount,
          price:  order.price,
          type:   (order.type === 'market' || order.type === 'limit') ? order.type : 'market',
        });
        await fetchPortfolio();
      } else {
        await tradingApi.placeOrder({
          symbol:      selectedAsset.symbol,
          exchange:    order.exchange || 'binance',
          type:        order.type        || 'market',
          side:        order.side        || 'buy',
          amount:      order.amount      || 0,
          price:       order.price,
          stopPrice:   order.stopPrice,
          timeInForce: order.timeInForce || 'GTC',
          postOnly:    order.postOnly    || false,
          reduceOnly:  order.reduceOnly  || false,
          mode:        'live',
          stopLoss:    order.stopLoss,
          takeProfit:  order.takeProfit,
        });
      }
      setTimeout(() => fetchOrders(selectedAsset.symbol), 1500);
    } catch (err: any) {
      setError(err?.message || 'Failed to place order. Please try again.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsOrdersLoading(false);
    }
  }, [selectedAsset, isPaperMode]);

  const handleCancelOrder = useCallback(async (orderId: string) => {
    try {
      await tradingApi.cancelOrder(orderId);
      await fetchOrders(selectedAsset?.symbol);
    } catch { /* non-critical */ }
  }, [selectedAsset?.symbol]);

  // ── Filter assets ─────────────────────────────────────────────────────────
  const filteredAssets = assets.filter(asset => {
    const matchesSearch =
      searchTerm === '' ||
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = assetTypeFilter === null || asset.type === assetTypeFilter;
    return matchesSearch && matchesType;
  });

  const handleSelectAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setShowAssetPanel(false);
  };

  // ── Asset list panel (sidebar + mobile slide-over) ────────────────────────
  const AssetListPanel = () => (
    <div className="flex flex-col h-full">
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search..."
          className="w-full pl-8 pr-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-light placeholder-dark-500 focus:outline-none focus:border-primary"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex gap-1 mb-3 flex-wrap">
        {['All', 'Crypto', 'Stock', 'Forex'].map(f => (
          <button
            key={f}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
              (f === 'All' ? assetTypeFilter === null : assetTypeFilter === f.toLowerCase())
                ? 'bg-primary text-white'
                : 'bg-dark-800 text-dark-400 hover:text-light'
            }`}
            onClick={() => setAssetTypeFilter(f === 'All' ? null : f.toLowerCase())}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
        {isAssetsLoading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-dark-400">
            <Loader size={16} className="animate-spin text-primary" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : filteredAssets.length === 0 ? (
          <p className="text-center text-dark-400 text-sm py-8">No assets found</p>
        ) : (
          filteredAssets.map(asset => (
            <button
              key={asset.id}
              onClick={() => handleSelectAsset(asset)}
              className={`w-full flex justify-between items-center px-2 py-2.5 rounded-lg transition-all text-left ${
                selectedAsset?.id === asset.id
                  ? 'bg-primary/10 border border-primary/30'
                  : 'hover:bg-dark-800/70 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 flex-shrink-0 rounded-full bg-dark-700 flex items-center justify-center text-xs font-bold">
                  {asset.symbol.substring(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-sm text-light">{asset.symbol}</span>
                    <button
                      onClick={e => { e.stopPropagation(); toggleWatchlist(asset.symbol); }}
                      className="text-dark-500 hover:text-amber-400 transition-colors"
                    >
                      <Star size={10} className={watchlist.includes(asset.symbol) ? 'text-amber-400 fill-amber-400' : ''} />
                    </button>
                  </div>
                  <p className="text-dark-400 text-xs truncate">{asset.name}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <p className="text-sm font-medium text-light">
                  {(asset as any).priceUnavailable
                    ? '—'
                    : `$${(asset.price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </p>
                <p className={`text-xs flex items-center justify-end gap-0.5 ${(asset.change24h ?? 0) >= 0 ? 'text-secondary' : 'text-red-400'}`}>
                  {(asset.change24h ?? 0) >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                  {(asset.change24h ?? 0) > 0 ? '+' : ''}{(asset.change24h ?? 0).toFixed(2)}%
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  // ────────────────────────────────────────────────────────────────────────────
  return (
    /*
     * KEY FIX: overflow-x-hidden on the outermost div.
     * This ensures nothing — not the ticker, not a wide table — can widen
     * the page and produce a horizontal scrollbar.
     */
    <div className="min-h-screen w-full overflow-x-hidden">

      {/* ── Price Ticker (full-width, no negative margin) ─────────────────── */}
      {/*
       * Render PriceTicker OUTSIDE the padded page container.
       * We use a negative-margin approach only if the parent has overflow:hidden.
       * Safest approach: let the ticker be its own full-width block here,
       * and accept whatever padding the page layout gives it.
       * If your layout wraps content in a padded container, either:
       *   (a) move PriceTicker above that container, or
       *   (b) use the approach below with overflow-x:hidden on the page root.
       */}
      <div className="w-full mb-4">
        <PriceTicker />
      </div>

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
        <h2 className="text-2xl font-bold">Trading</h2>
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => setIsPaperMode(p => !p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
              isPaperMode
                ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                : 'bg-dark-800 border-dark-700 text-dark-400 hover:border-primary/50'
            }`}
          >
            {isPaperMode ? '📄 Paper Mode' : '💰 Live Mode'}
          </button>
          <button
            onClick={() => { setActiveTab('orders'); }}
            className="btn-outline text-sm px-3 py-1.5"
          >
            Order History
          </button>
          <button
            onClick={() => setIsDepositOpen(true)}
            className="btn-primary text-sm px-3 py-1.5"
          >
            Deposit
          </button>
        </div>
      </div>

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-3 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle size={15} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Paper portfolio summary ────────────────────────────────────────── */}
      {isPaperMode && portfolio && (
        <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Cash Balance', value: `$${(portfolio.balance ?? 0).toFixed(2)}`,                                                         color: '' },
            { label: 'Invested',     value: `$${(portfolio.investedAmount ?? 0).toFixed(2)}`,                                                   color: '' },
            { label: 'P&L',          value: `${(portfolio.profitLoss ?? 0) >= 0 ? '+' : ''}$${(portfolio.profitLoss ?? 0).toFixed(2)}`,         color: (portfolio.profitLoss ?? 0) >= 0 ? 'text-secondary' : 'text-red-400' },
            { label: 'Return',       value: `${(portfolio.profitLossPercentage ?? 0) >= 0 ? '+' : ''}${(portfolio.profitLossPercentage ?? 0).toFixed(2)}%`, color: (portfolio.profitLossPercentage ?? 0) >= 0 ? 'text-secondary' : 'text-red-400' },
          ].map(({ label, value, color }) => (
            <GlassCard key={label} className="p-3">
              <p className="text-xs text-dark-400 mb-0.5">{label}</p>
              <p className={`text-base font-semibold ${color}`}>{value}</p>
            </GlassCard>
          ))}
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="flex w-max min-w-full">
            <TabsTrigger value="market">Market</TabsTrigger>
            <TabsTrigger value="trade">Trade</TabsTrigger>
            <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>
        </div>

        {/* ── MARKET OVERVIEW ─────────────────────────────────────────────── */}
        <TabsContent value="market" className="pt-4">
          <MarketOverview
            assets={assets}
            watchlist={watchlist}
            onToggleWatchlist={toggleWatchlist}
          />
        </TabsContent>

        {/* ── TRADE ───────────────────────────────────────────────────────── */}
        <TabsContent value="trade" className="pt-4">
          {/* Mobile: button to open asset panel */}
          <div className="lg:hidden mb-3 flex items-center gap-2">
            <button
              onClick={() => setShowAssetPanel(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800 border border-dark-700 text-sm text-light hover:border-primary/50 transition-colors"
            >
              <BarChart2 size={15} />
              {selectedAsset ? (
                <span>
                  <span className="font-semibold">{selectedAsset.symbol}</span>
                  {' — '}$
                  {(selectedAsset.price ?? 0).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              ) : 'Select Asset'}
            </button>
            {selectedAsset && (
              <button
                onClick={() => setIsDepositOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm"
              >
                <ArrowDownCircle size={14} /> Deposit
              </button>
            )}
          </div>

          {/* Mobile slide-over panel */}
          {showAssetPanel && (
            <div className="fixed inset-0 z-50 flex lg:hidden">
              <div className="absolute inset-0 bg-black/60" onClick={() => setShowAssetPanel(false)} />
              <div className="relative z-10 w-72 max-w-[85vw] h-full bg-dark-900 border-r border-dark-700 flex flex-col p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Assets</h3>
                  <button onClick={() => setShowAssetPanel(false)} className="p-1 rounded-full hover:bg-dark-700 text-dark-400">
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <AssetListPanel />
                </div>
              </div>
            </div>
          )}

          {/* Desktop: sidebar + main */}
          <div className="flex flex-col lg:flex-row gap-4 w-full">
            {/* Sidebar */}
            <div className="hidden lg:flex flex-col w-56 xl:w-64 flex-shrink-0">
              <GlassCard
                className="p-3 flex flex-col"
                style={{ height: 'calc(100vh - 220px)', minHeight: 400 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Assets</h3>
                  <button
                    onClick={() => fetchMarketAssets()}
                    className="p-1 rounded text-dark-400 hover:text-light"
                    title="Refresh"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <AssetListPanel />
                </div>
              </GlassCard>
            </div>

            {/* Main trading area — min-w-0 prevents it overflowing flex parent */}
            <div className="flex-1 min-w-0 space-y-4">
              {selectedAsset ? (
                <>
                  {/* Chart + TradeForm */}
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start w-full">
                    <div className="xl:col-span-2 min-w-0 w-full overflow-hidden">
                      <ChartErrorBoundary>
                        {isChartLoading ? (
                          <GlassCard className="flex items-center justify-center p-6" style={{ minHeight: 420 }}>
                            <div className="flex flex-col items-center gap-3 text-dark-400">
                              <Loader size={24} className="animate-spin text-primary" />
                              <span className="text-sm">Loading chart…</span>
                            </div>
                          </GlassCard>
                        ) : (
                          <MarketChart
                            asset={selectedAsset}
                            data={chartData}
                            onIntervalChange={label => setChartInterval(intervalLabelMap[label] || '1d')}
                          />
                        )}
                      </ChartErrorBoundary>
                    </div>
                    <div className="xl:col-span-1 min-w-0 w-full">
                      <TradeForm
                        asset={selectedAsset}
                        onPlaceOrder={handlePlaceOrder}
                        loading={isOrdersLoading}
                        availableBalance={availableBalance}
                        availableAsset={availableAssetAmount}
                        isPaperMode={isPaperMode}
                        onTogglePaperMode={() => setIsPaperMode(p => !p)}
                      />
                    </div>
                  </div>

                  {/* OrderBook + Orders */}
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start w-full">
                    <div className="xl:col-span-1 min-w-0 w-full">
                      <OrderBook
                        asks={orderBookData.asks}
                        bids={orderBookData.bids}
                        currentPrice={selectedAsset.price ?? 0}
                      />
                    </div>
                    <div className="xl:col-span-2 min-w-0 w-full overflow-hidden">
                      <GlassCard className="p-4">
                        <div className="flex gap-4 mb-4 border-b border-dark-700">
                          {(['open', 'history'] as const).map(tab => (
                            <button
                              key={tab}
                              onClick={() => setOrderSubTab(tab)}
                              className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                orderSubTab === tab
                                  ? 'border-primary text-primary'
                                  : 'border-transparent text-dark-400 hover:text-light'
                              }`}
                            >
                              {tab === 'open'
                                ? `Open Orders (${openOrders.length})`
                                : 'Order History'}
                            </button>
                          ))}
                        </div>
                        <OrderHistory
                          orders={orderSubTab === 'open' ? openOrders : orderHistory}
                          showCancelButton={orderSubTab === 'open'}
                          onCancelOrder={handleCancelOrder}
                        />
                      </GlassCard>
                    </div>
                  </div>
                </>
              ) : (
                <GlassCard className="p-10 flex items-center justify-center" style={{ minHeight: 400 }}>
                  <div className="text-center">
                    <BarChart2 size={40} className="mx-auto mb-3 text-dark-500" />
                    <p className="text-lg font-medium mb-1">No asset selected</p>
                    <p className="text-dark-400 text-sm mb-4">
                      Choose an asset from the sidebar to start trading
                    </p>
                    <button onClick={() => setShowAssetPanel(true)} className="btn-primary lg:hidden">
                      Browse Assets
                    </button>
                  </div>
                </GlassCard>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── WATCHLIST ───────────────────────────────────────────────────── */}
        <TabsContent value="watchlist" className="pt-4">
          <Watchlist
            assets={assets}
            watchlist={watchlist}
            onToggleWatchlist={assetId => {
              const a = assets.find(x => x.id === assetId);
              if (a) toggleWatchlist(a.symbol);
            }}
            onSelectAsset={asset => { setSelectedAsset(asset); setActiveTab('trade'); }}
          />
        </TabsContent>

        {/* ── ORDERS ──────────────────────────────────────────────────────── */}
        <TabsContent value="orders" className="pt-4">
          <GlassCard className="p-4">
            <div className="flex gap-4 mb-4 border-b border-dark-700">
              {(['open', 'history'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setOrderSubTab(tab)}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    orderSubTab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-dark-400 hover:text-light'
                  }`}
                >
                  {tab === 'open' ? `Open Orders (${openOrders.length})` : 'Order History'}
                </button>
              ))}
            </div>
            <OrderHistory
              orders={orderSubTab === 'open' ? openOrders : orderHistory}
              showCancelButton={orderSubTab === 'open'}
              onCancelOrder={handleCancelOrder}
            />
          </GlassCard>
        </TabsContent>

        {/* ── ALERTS ──────────────────────────────────────────────────────── */}
        <TabsContent value="alerts" className="pt-4">
          <PriceAlerts assets={assets} />
        </TabsContent>
      </Tabs>

      <DepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        assets={assets}
      />
    </div>
  );
};

export default Trading;
