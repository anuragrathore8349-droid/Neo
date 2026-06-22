// client/src/pages/Trading/index.tsx
import React, { useState, useEffect, useCallback, Component, ErrorInfo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
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
import ApiKeyManager from '../../components/trading/ApiKeyManager';
import { useMarketSocket } from '../../hooks/useMarketSocket';
import * as tradingApi from '../../services/trading.service';
import * as marketApi from '../../services/market.service';
import { Asset } from '../../types';
import {
  Search, Star, Loader, RefreshCw, AlertCircle,
  TrendingUp, TrendingDown, BarChart2, ArrowDownCircle, X, Key,
  CheckCircle,
} from 'lucide-react';

const ASSET_REFRESH_INTERVAL  = 30_000;
const ORDER_REFRESH_INTERVAL  = 15_000;
const SOCKET_URL = (import.meta as any).env?.VITE_WS_URL || window.location.origin;

// ── Chart error boundary ──────────────────────────────────────────────────────
class ChartErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: Error, i: ErrorInfo) { console.error('[Chart]', e, i); }
  render() {
    if (this.state.hasError)
      return (
        <GlassCard className="flex items-center justify-center p-6" style={{ minHeight: 420 }}>
          <div className="text-center text-dark-400 text-sm">
            Chart failed to render.{' '}
            <button className="text-primary underline ml-1" onClick={() => this.setState({ hasError: false })}>
              Retry
            </button>
          </div>
        </GlassCard>
      );
    return this.props.children;
  }
}

// ── Toast notification ────────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }

// ── Main Component ────────────────────────────────────────────────────────────
const Trading: React.FC = () => {
  const [activeTab,        setActiveTab]        = useState('market');
  const [orderSubTab,      setOrderSubTab]       = useState<'open' | 'history'>('open');
  const [searchTerm,       setSearchTerm]        = useState('');
  const [assetTypeFilter,  setAssetTypeFilter]   = useState<string | null>(null);
  const [selectedAsset,    setSelectedAsset]     = useState<Asset | null>(null);
  const [assets,           setAssets]            = useState<Asset[]>([]);
  const [watchlist,        setWatchlist]         = useState<string[]>([]);
  const [orderBookData,    setOrderBookData]      = useState<{ asks: any[]; bids: any[] }>({ asks: [], bids: [] });
  const [chartData,        setChartData]         = useState<any[]>([]);
  const [openOrders,       setOpenOrders]        = useState<any[]>([]);
  const [orderHistory,     setOrderHistory]      = useState<any[]>([]);
  const [recentTrades,     setRecentTrades]      = useState<any[]>([]);
  const [isAssetsLoading,  setIsAssetsLoading]   = useState(false);
  const [isOrdersLoading,  setIsOrdersLoading]   = useState(false);
  const [isChartLoading,   setIsChartLoading]    = useState(false);
  const [isCancellingOrder,setIsCancellingOrder] = useState<string | null>(null);
  const [isDepositOpen,    setIsDepositOpen]     = useState(false);
  const [isPaperMode,      setIsPaperMode]       = useState(true);
  const [chartInterval,    setChartInterval]     = useState('1d');
  const [portfolio,        setPortfolio]         = useState<any>(null);
  const [error,            setError]             = useState<string | null>(null);
  const [orderError,       setOrderError]        = useState<string | null>(null);
  const [showAssetPanel,   setShowAssetPanel]    = useState(false);
  const [toasts,           setToasts]            = useState<Toast[]>([]);
  const [paperInitialized, setPaperInitialized]  = useState(false);

  const intervalLabelMap: Record<string, string> = {
    '1H': '1h', '4H': '4h', '1D': '1d', '1W': '1w', '1M': '1d',
  };

  // ── Toast helper ──────────────────────────────────────────────────────────
  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ── Compute available balance / asset amount from portfolio ───────────────
  const availableBalance = portfolio?.balance ?? 0;
  const availableAssetAmount = React.useMemo(() => {
    if (!portfolio || !selectedAsset) return 0;
    const holding = (portfolio.holdings || portfolio.assets || []).find(
      (h: any) => (h.symbol || '').toUpperCase() === selectedAsset.symbol.toUpperCase()
    );
    return holding?.amount ?? 0;
  }, [portfolio, selectedAsset]);

  // ── Auto-initialize paper account ─────────────────────────────────────────
  useEffect(() => {
    if (paperInitialized) return;
    tradingApi.getPaperPortfolio()
      .then((r: any) => {
        setPortfolio(r.data);
        setPaperInitialized(true);
      })
      .catch(async () => {
        try {
          const r: any = await tradingApi.initializePaperAccount();
          setPortfolio(r.data);
          setPaperInitialized(true);
        } catch { /* silent */ }
      });
  }, [paperInitialized]);

  // ── Refresh portfolio when switching modes ────────────────────────────────
  const refreshPortfolio = useCallback(async () => {
    try {
      if (isPaperMode) {
        const r: any = await tradingApi.getPaperPortfolio();
        setPortfolio(r.data);
      }
    } catch { /* silent */ }
  }, [isPaperMode]);

  useEffect(() => { refreshPortfolio(); }, [isPaperMode]);

  // ── Live order-book via /trading WebSocket ────────────────────────────────
  const tradingSocketRef = useRef<any>(null);

  useEffect(() => {
    if (!selectedAsset?.symbol) return;
    const symbol = selectedAsset.symbol.toUpperCase();

    // Disconnect previous
    tradingSocketRef.current?.disconnect();

    const sock = io(`${SOCKET_URL}/trading`, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: { token: localStorage.getItem('token') || '' },
    });
    tradingSocketRef.current = sock;

    sock.on('connect', () => {
      sock.emit('subscribeOrderbook', { symbol });
    });

    // Live order book push — updates UI at ~100ms intervals from Binance
    sock.on('orderbook', (data: any) => {
      if (!data || data.symbol !== symbol) return;
      setOrderBookData({
        asks: data.asks || [],
        bids: data.bids || [],
      });
    });

    // Live price tick — update selected asset price for chart animation
    sock.on('priceUpdate', (data: any) => {
      if (data?.symbol !== symbol) return;
      setSelectedAsset(prev => prev ? { ...prev, price: data.price, change24h: data.change24h } : prev);
      setAssets(prev => prev.map(a =>
        a.symbol === symbol ? { ...a, price: data.price, change24h: data.change24h } : a
      ));
    });

    return () => {
      sock.emit('unsubscribeOrderbook', { symbol });
      sock.disconnect();
    };
  }, [selectedAsset?.symbol]);

  // ── WebSocket: live price updates ─────────────────────────────────────────
  useMarketSocket({
    symbols:  assets.map(a => a.symbol),
    enabled:  assets.length > 0,
    onPriceUpdate: ({ symbol, price }) => {
      setAssets(prev => prev.map(a => a.symbol === symbol ? { ...a, price } : a));
      setSelectedAsset(prev => prev?.symbol === symbol ? { ...prev, price } : prev);
    },
  });

  // ── Fetch market assets ───────────────────────────────────────────────────
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
      if (!silent) setError('Failed to load market data. Please try again.');
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
    try { const r = await marketApi.getWatchlist(); setWatchlist(r.data || []); } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchWatchlist(); }, []);

  const toggleWatchlist = useCallback(async (symbol: string) => {
    const upper  = symbol.toUpperCase();
    const inList = watchlist.includes(upper);
    setWatchlist(prev => inList ? prev.filter(s => s !== upper) : [...prev, upper]);
    try {
      await (inList ? marketApi.removeFromWatchlist(upper) : marketApi.addToWatchlist(upper));
    } catch {
      setWatchlist(prev => inList ? [...prev, upper] : prev.filter(s => s !== upper));
    }
  }, [watchlist]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const fetchChartData = useCallback(async (symbol: string, interval: string) => {
    setIsChartLoading(true);
    try {
      const response = await marketApi.getPriceHistory(symbol, interval);
      const prices   = response.data?.prices || response.data || [];
      setChartData(
        Array.isArray(prices)
          ? prices.map((p: any) => ({
              date:   new Date(p.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              open:   p.open, close: p.close, high: p.high, low: p.low, volume: p.volume || 0,
            }))
          : []
      );
    } catch { setChartData([]); }
    finally  { setIsChartLoading(false); }
  }, []);

  // ── Order Book data ───────────────────────────────────────────────────────
  const loadOrderBook = useCallback(async (symbol: string) => {
    try {
      const r: any = await tradingApi.getOrderBook(symbol, 30);
      setOrderBookData({
        asks: r.data?.asks || [],
        bids: r.data?.bids || [],
      });
    } catch { /* silent */ }
  }, []);

  // ── Orders ────────────────────────────────────────────────────────────────
  const loadOpenOrders = useCallback(async (symbol?: string) => {
    try {
      const r: any = await tradingApi.getOpenOrders(symbol);
      setOpenOrders(r.data || []);
    } catch { /* silent */ }
  }, []);

  const loadOrderHistory = useCallback(async (symbol?: string) => {
    try {
      const r: any = await tradingApi.getOrderHistory(symbol);
      setOrderHistory(r.data || []);
    } catch { /* silent */ }
  }, []);

  // ── Select asset ──────────────────────────────────────────────────────────
  const handleSelectAsset = useCallback((asset: Asset) => {
    setSelectedAsset(asset);
    setShowAssetPanel(false);
    fetchChartData(asset.symbol, chartInterval);
    loadOrderBook(asset.symbol);
    loadOpenOrders(asset.symbol);
    loadOrderHistory(asset.symbol);
  }, [chartInterval, fetchChartData, loadOrderBook, loadOpenOrders, loadOrderHistory]);

  useEffect(() => {
    if (selectedAsset) {
      fetchChartData(selectedAsset.symbol, chartInterval);
      loadOrderBook(selectedAsset.symbol);
      loadOpenOrders(selectedAsset.symbol);
      loadOrderHistory(selectedAsset.symbol);
    }
  }, [selectedAsset?.symbol, chartInterval, fetchChartData, loadOrderBook, loadOpenOrders, loadOrderHistory]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (selectedAsset) {
        loadOpenOrders(selectedAsset.symbol);
        loadOrderHistory(selectedAsset.symbol);
      }
    }, ORDER_REFRESH_INTERVAL);
    return () => window.clearInterval(id);
  }, [selectedAsset?.symbol]);

  // ── Place order ───────────────────────────────────────────────────────────
  const handlePlaceOrder = useCallback(async (order: any) => {
    if (!selectedAsset) return;
    setOrderError(null);
    setIsOrdersLoading(true);

    try {
      const payload = {
        symbol:      selectedAsset.symbol,
        exchange:    isPaperMode ? 'paper' : (order.exchange || 'binance'),
        type:        order.type,
        side:        order.side,
        amount:      order.amount,
        price:       order.price,
        stopPrice:   order.stopPrice,
        timeInForce: order.timeInForce || 'GTC',
        postOnly:    order.postOnly    || false,
        reduceOnly:  order.reduceOnly  || false,
        mode:        isPaperMode ? 'paper' : 'live',
        stopLoss:    order.stopLoss,
        takeProfit:  order.takeProfit,
      };

      const response: any = await tradingApi.placeOrder(payload);
      const orderData = response.data;

      if (isPaperMode) {
        addToast(`Paper ${order.side.toUpperCase()} order placed!`, 'success');
        await refreshPortfolio();
      } else {
        addToast(`${order.side.toUpperCase()} order submitted to exchange`, 'success');
        setOpenOrders(prev => [orderData, ...prev]);
      }

      await loadOrderHistory(selectedAsset.symbol);
    } catch (error: any) {
      const msg = error?.message || 'Failed to place order.';
      setOrderError(msg);
      addToast(msg, 'error');
    } finally {
      setIsOrdersLoading(false);
    }
  }, [selectedAsset, isPaperMode, refreshPortfolio, loadOrderHistory]);

  // ── Cancel order ──────────────────────────────────────────────────────────
  const handleCancelOrder = useCallback(async (orderId: string) => {
    setIsCancellingOrder(orderId);
    try {
      await tradingApi.cancelOrder(orderId);
      setOpenOrders(prev => prev.filter(o => (o.id || o._id) !== orderId));
      addToast('Order cancelled', 'info');
    } catch (error: any) {
      setOrderError(error?.message || 'Failed to cancel order.');
    } finally {
      setIsCancellingOrder(null);
    }
  }, []);

  // ── Filtered assets ───────────────────────────────────────────────────────
  const filteredAssets = React.useMemo(() => assets.filter(asset => {
    const matchesSearch = searchTerm === '' ||
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = assetTypeFilter === null || asset.type === assetTypeFilter;
    return matchesSearch && matchesType;
  }), [assets, searchTerm, assetTypeFilter]);

  // ── Asset list panel ──────────────────────────────────────────────────────
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
        {['All','Crypto','Stock','Forex'].map(f => (
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
                      <Star size={10} className={watchlist.includes(asset.symbol.toUpperCase()) ? 'text-amber-400 fill-amber-400' : ''} />
                    </button>
                  </div>
                  <p className="text-dark-400 text-xs truncate">{asset.name}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <p className="text-sm font-medium text-light">
                  {(asset as any).priceUnavailable ? '—' :
                    `$${(asset.price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full overflow-x-hidden">

      {/* ── Toast notifications ───────────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-xs">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm text-white transition-all ${
              t.type === 'success' ? 'bg-green-600' :
              t.type === 'error'   ? 'bg-red-600'   : 'bg-dark-700 border border-dark-600'
            }`}
          >
            {t.type === 'success' && <CheckCircle size={14} />}
            {t.type === 'error'   && <AlertCircle size={14} />}
            {t.message}
          </div>
        ))}
      </div>

      {/* ── Price Ticker ──────────────────────────────────────────────────── */}
      <div className="w-full mb-4">
    {   /*<PriceTicker /> */}
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
            onClick={() => { setActiveTab('orders'); setOrderSubTab('history'); }}
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
          <AlertCircle size={15} className="flex-shrink-0" />{error}
        </div>
      )}

      {/* ── Paper portfolio summary ────────────────────────────────────────── */}
      {isPaperMode && portfolio && (
        <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Cash Balance', value: `$${(portfolio.balance ?? 0).toFixed(2)}`, color: '' },
            { label: 'Invested',     value: `$${(portfolio.investedAmount ?? 0).toFixed(2)}`, color: '' },
            { label: 'P&L',
              value: `${(portfolio.profitLoss ?? 0) >= 0 ? '+' : ''}$${(portfolio.profitLoss ?? 0).toFixed(2)}`,
              color: (portfolio.profitLoss ?? 0) >= 0 ? 'text-secondary' : 'text-red-400' },
            { label: 'Return',
              value: `${(portfolio.profitLossPercentage ?? 0) >= 0 ? '+' : ''}${(portfolio.profitLossPercentage ?? 0).toFixed(2)}%`,
              color: (portfolio.profitLossPercentage ?? 0) >= 0 ? 'text-secondary' : 'text-red-400' },
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
            <TabsTrigger value="apikeys"><Key size={12} className="mr-1 inline-block" />API Keys</TabsTrigger>
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
          {/* Mobile button */}
          <div className="lg:hidden mb-3 flex items-center gap-2">
            <button
              onClick={() => setShowAssetPanel(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800 border border-dark-700 text-sm text-light hover:border-primary/50 transition-colors"
            >
              <BarChart2 size={15} />
              {selectedAsset ? (
                <span>
                  <span className="font-semibold">{selectedAsset.symbol}</span>
                  {' — '}${(selectedAsset.price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              ) : 'Select Asset'}
            </button>
            {selectedAsset && (
              <button onClick={() => setIsDepositOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm">
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
                <div className="flex-1 min-h-0"><AssetListPanel /></div>
              </div>
            </div>
          )}

          {/* Desktop layout */}
          <div className="flex flex-col lg:flex-row gap-4 w-full">
            {/* Sidebar */}
            <div className="hidden lg:flex flex-col w-56 xl:w-64 flex-shrink-0">
              <GlassCard className="p-3 flex flex-col" style={{ height: 'calc(100vh - 220px)', minHeight: 400 }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Assets</h3>
                  <button onClick={() => fetchMarketAssets()} className="p-1 rounded text-dark-400 hover:text-light" title="Refresh">
                    <RefreshCw size={13} />
                  </button>
                </div>
                <div className="flex-1 min-h-0"><AssetListPanel /></div>
              </GlassCard>
            </div>

            {/* Main area */}
            <div className="flex-1 min-w-0 space-y-4">
              {selectedAsset ? (
                <>
                  {/* Order error */}
                  {orderError && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                      <AlertCircle size={14} />
                      <span>{orderError}</span>
                      <button onClick={() => setOrderError(null)} className="ml-auto"><X size={14} /></button>
                    </div>
                  )}

                  {/* Chart + Trade Form */}
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
                            livePrice={selectedAsset.price}
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
                        onLevelClick={(price) => {
                          // Pre-fill trade form — handled inside TradeForm via asset.price
                          setSelectedAsset(prev => prev ? { ...prev, price } : prev);
                        }}
                      />
                    </div>
                    <div className="xl:col-span-2 min-w-0 w-full overflow-hidden">
                      <GlassCard className="p-4">
                        <div className="flex gap-4 mb-4 border-b border-dark-700">
                          {(['open','history'] as const).map(tab => (
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
                          cancellingId={isCancellingOrder}
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
                    <p className="text-dark-400 text-sm mb-4">Choose an asset from the sidebar to start trading</p>
                    <button onClick={() => setShowAssetPanel(true)} className="btn-primary lg:hidden">Browse Assets</button>
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
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-4 border-b border-dark-700 flex-1">
                {(['open','history'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setOrderSubTab(tab)}
                    className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      orderSubTab === tab ? 'border-primary text-primary' : 'border-transparent text-dark-400 hover:text-light'
                    }`}
                  >
                    {tab === 'open' ? `Open Orders (${openOrders.length})` : 'Order History'}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { loadOpenOrders(selectedAsset?.symbol); loadOrderHistory(selectedAsset?.symbol); }}
                className="p-1.5 rounded text-dark-400 hover:text-light ml-3"
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>
            </div>
            <OrderHistory
              orders={orderSubTab === 'open' ? openOrders : orderHistory}
              showCancelButton={orderSubTab === 'open'}
              onCancelOrder={handleCancelOrder}
              cancellingId={isCancellingOrder}
            />
          </GlassCard>
        </TabsContent>

        {/* ── ALERTS ──────────────────────────────────────────────────────── */}
        <TabsContent value="alerts" className="pt-4">
          <PriceAlerts assets={assets} />
        </TabsContent>

        {/* ── API KEYS (new) ───────────────────────────────────────────────── */}
        <TabsContent value="apikeys" className="pt-4">
          <ApiKeyManager />
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
