import React, { useState, useEffect, useCallback, Component, ErrorInfo } from 'react';
import { Loader, AlertCircle, Info } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import MarketChart from './MarketChart';
import OrderBook from './OrderBook';
import TradeForm from './TradeForm';
import OrderHistory from './OrderHistory';
import * as marketApi from '../../services/market.service';
import * as tradingApi from '../../services/trading.service';
import { Asset } from '../../types';
class ChartErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ChartErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full min-h-[300px] text-dark-400 text-sm">
          Chart failed to load.{' '}
          <button
            className="ml-2 text-primary underline"
            onClick={() => this.setState({ hasError: false })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
interface TradingViewProps {
  asset: Asset;
  onPlaceOrder: (order: any) => void;
  orderLoading?: boolean;
}

const TradingView: React.FC<TradingViewProps> = ({ asset, onPlaceOrder, orderLoading = false }) => {
  const [priceHistory,     setPriceHistory]     = useState<any[]>([]);
  const [orderBook,        setOrderBook]         = useState<{ asks: any[]; bids: any[] }>({ asks: [], bids: [] });
  const [openOrders,       setOpenOrders]        = useState<any[]>([]);
  const [orderHistory,     setOrderHistory]      = useState<any[]>([]);
  const [loadingChart,     setLoadingChart]      = useState(false);
  const [loadingOrderBook, setLoadingOrderBook]  = useState(false);
  const [loadingOrders,    setLoadingOrders]     = useState(false);
  const [apiInterval,      setApiInterval]       = useState('1d');
  const [activeTab,        setActiveTab]         = useState<'open' | 'history'>('open');
  const [error,            setError]             = useState<string | null>(null);
  const [isPaperMode,      setIsPaperMode]       = useState(false);
  const [availableBalance, setAvailableBalance]  = useState(0);
  const [availableAsset,   setAvailableAsset]    = useState(0);

  const intervalMap: Record<string, string> = {
    '1H': '1h', '4H': '4h', '1D': '1d', '1W': '1w', '1M': '1d',
  };

  const fetchBalance = useCallback(async () => {
    try {
      const res       = await tradingApi.getPaperPortfolio();
      const portfolio = res.data || res;
      setAvailableBalance(portfolio.balance ?? 0);
      const holding = (portfolio.holdings || []).find(
        (h: any) => h.symbol?.toUpperCase() === asset?.symbol?.toUpperCase()
      );
      setAvailableAsset(holding?.quantity ?? 0);
    } catch {
      // Portfolio may not yet be initialised
    }
  }, [asset?.symbol]);

  const fetchPriceHistory = useCallback(async () => {
    if (!asset?.symbol) return;
    setLoadingChart(true);
    setError(null);
    try {
      const response = await marketApi.getPriceHistory(asset.symbol, apiInterval);
      const raw      = response.data?.prices || response.data || [];
      setPriceHistory(
        raw.map((c: any) => ({
          date:   new Date(c.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          open:   c.open,  high: c.high,  low: c.low,
          close:  c.close, volume: c.volume ?? 0,
        }))
      );
    } catch {
      setError('Failed to load price history. Please try again.');
    } finally {
      setLoadingChart(false);
    }
  }, [asset?.symbol, apiInterval]);

  const fetchOrderBook = useCallback(async () => {
    if (!asset?.symbol) return;
    setLoadingOrderBook(true);
    try {
      const response = await tradingApi.getOrderBook(asset.symbol, 20);
      const data     = response.data || response;
      setOrderBook({ asks: data.asks || [], bids: data.bids || [] });
    } catch { /* non-critical */ }
    finally { setLoadingOrderBook(false); }
  }, [asset?.symbol]);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const [openRes, histRes] = await Promise.all([
        tradingApi.getOpenOrders(asset?.symbol),
        tradingApi.getOrderHistory(asset?.symbol, undefined, undefined, 50),
      ]);
      setOpenOrders(openRes.data  || []);
      setOrderHistory(histRes.data || []);
    } catch { /* non-critical */ }
    finally { setLoadingOrders(false); }
  }, [asset?.symbol]);

  useEffect(() => { fetchPriceHistory(); }, [fetchPriceHistory]);

  useEffect(() => {
    fetchOrderBook();
    const id = window.setInterval(fetchOrderBook, 10_000);
    return () => window.clearInterval(id);
  }, [fetchOrderBook]);

  useEffect(() => { fetchOrders(); },  [fetchOrders]);
  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  useEffect(() => {
    if (!isPaperMode) return;
    const id = window.setInterval(fetchBalance, 30_000);
    return () => window.clearInterval(id);
  }, [isPaperMode, fetchBalance]);

  const handleIntervalChange = (label: string) => setApiInterval(intervalMap[label] || '1d');

  const handleOrderPlaced = async (order: any) => {
    await onPlaceOrder(order);
    setTimeout(() => { fetchOrders(); fetchBalance(); }, 1500);
  };

  return (
    <div className="space-y-4">
      {isPaperMode && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm">
          <Info size={15} />
          <span><strong>Paper Trading</strong> — simulated trades at real prices. No real money at risk.</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle size={15} />{error}
        </div>
      )}

      {/* Chart (2 cols) + TradeForm (1 col) — items-start prevents height matching */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          {loadingChart ? (
            <GlassCard className="p-6 flex items-center justify-center min-h-[480px]">
              <div className="flex flex-col items-center gap-3 text-dark-400">
                <Loader size={28} className="animate-spin text-primary" />
                <span className="text-sm">Loading chart…</span>
              </div>
            </GlassCard>
          ) : priceHistory.length > 0 ? (
            <ChartErrorBoundary>
              <MarketChart asset={asset} data={priceHistory} onIntervalChange={handleIntervalChange} />
            </ChartErrorBoundary>
          ) : (
            <GlassCard className="p-6 flex items-center justify-center min-h-[480px]">
              <p className="text-dark-400 text-sm">No chart data available for {asset?.symbol}</p>
            </GlassCard>
          )}
        </div>

        <div className="lg:col-span-1">
          <TradeForm
            asset={asset}
            onPlaceOrder={handleOrderPlaced}
            loading={orderLoading}
            availableBalance={availableBalance}
            availableAsset={availableAsset}
            isPaperMode={isPaperMode}
            onTogglePaperMode={() => setIsPaperMode(p => !p)}
          />
        </div>
      </div>

      {/* Order Book (1 col) + Orders (2 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div>
          <OrderBook asks={orderBook.asks} bids={orderBook.bids} currentPrice={asset?.price ?? 0} loading={loadingOrderBook} />
        </div>

        <div className="lg:col-span-2">
          <GlassCard className="p-6">
            <div className="flex gap-4 mb-4 border-b border-dark-700">
              {(['open','history'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-dark-400 hover:text-light'}`}
                >
                  {tab === 'open' ? `Open Orders (${openOrders.length})` : 'Order History'}
                </button>
              ))}
            </div>

            {loadingOrders ? (
              <div className="flex justify-center py-8"><Loader size={20} className="animate-spin text-primary" /></div>
            ) : (
              <OrderHistory
                orders={activeTab === 'open' ? openOrders : orderHistory}
                showCancelButton={activeTab === 'open'}
                onCancelOrder={async (orderId) => {
                  try { await tradingApi.cancelOrder(orderId); fetchOrders(); }
                  catch (err) { console.error('Cancel error:', err); }
                }}
              />
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default TradingView;