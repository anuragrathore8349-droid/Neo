import React, { useState, useEffect } from 'react';
import GlassCard from '../common/GlassCard';
import { Asset } from '../../types';
import TradeConfirmModal from './TradeConfirmModal';

interface TradeFormProps {
  asset: Asset;
  onPlaceOrder: (order: any) => void;
  loading?: boolean;
  availableBalance?: number;
  availableAsset?: number;
  isPaperMode?: boolean;
  onTogglePaperMode?: () => void;
}

const TradeForm: React.FC<TradeFormProps> = ({
  asset,
  onPlaceOrder,
  loading = false,
  availableBalance = 0,
  availableAsset = 0,
  isPaperMode = false,
  onTogglePaperMode,
}) => {
  const [side,         setSide]         = useState<'buy' | 'sell'>('buy');
  const [orderType,    setOrderType]    = useState<'market' | 'limit' | 'stop'>('limit');
  const [price,        setPrice]        = useState<string>((asset.price ?? 0).toString());
  const [amount,       setAmount]       = useState<string>('');
  const [total,        setTotal]        = useState<string>('0');
  const [stopLoss,     setStopLoss]     = useState<string>('');
  const [takeProfit,   setTakeProfit]   = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<any | null>(null);

  useEffect(() => {
    if (asset.price != null) setPrice(asset.price.toString());
  }, [asset.price]);

  useEffect(() => {
    const p = parseFloat(price) || 0;
    const a = parseFloat(amount) || 0;
    setTotal((p * a).toFixed(2));
  }, [price, amount]);

  const handleAmountPercentage = (pct: number) => {
    if (side === 'buy') {
      if (availableBalance <= 0) return;
      const currentPrice  = parseFloat(price) || asset.price || 1;
      const maxBuyAmount  = availableBalance / currentPrice;
      setAmount(((maxBuyAmount * pct) / 100).toFixed(6));
    } else {
      if (availableAsset <= 0) return;
      setAmount(((availableAsset * pct) / 100).toFixed(6));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;

    const order: any = {
      symbol:      asset.symbol,
      side,
      type:        orderType,
      amount:      parsedAmount,
      price:       orderType !== 'market' ? parseFloat(price) : undefined,
      total:       parseFloat(total),
      exchange:    isPaperMode ? 'paper' : 'binance',
      timeInForce: 'GTC',
      postOnly:    false,
      reduceOnly:  false,
      mode:        isPaperMode ? 'paper' : 'live',
      isPaper:     isPaperMode,
    };

    if (stopLoss && parseFloat(stopLoss) > 0) {
      order.stopLoss = { price: parseFloat(stopLoss), triggerType: 'last' };
    }
    if (takeProfit && parseFloat(takeProfit) > 0) {
      order.takeProfit = { price: parseFloat(takeProfit), triggerType: 'last' };
    }

    if (isPaperMode) {
      onPlaceOrder(order);
      // ── Reset form after successful paper trade ──────────────────────────
      setAmount('');
      setStopLoss('');
      setTakeProfit('');
    } else {
      setPendingOrder(order);
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

  const slNum  = parseFloat(stopLoss);
  const tpNum  = parseFloat(takeProfit);
  const prNum  = parseFloat(price);

  return (
    <GlassCard className="p-6 h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Place Order</h3>
        {onTogglePaperMode && (
          <button
            type="button"
            onClick={onTogglePaperMode}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${
              isPaperMode
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-dark-700 text-dark-400 border border-dark-600'
            }`}
          >
            {isPaperMode ? '📄 Paper' : '💰 Live'}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Buy / Sell */}
        <div className="flex mb-4">
          <button type="button" onClick={() => setSide('buy')}
            className={`flex-1 py-2 rounded-l-lg transition-all ${side === 'buy' ? 'bg-secondary text-dark-900 font-medium' : 'bg-dark-800 text-dark-400 hover:text-light'}`}>
            Buy
          </button>
          <button type="button" onClick={() => setSide('sell')}
            className={`flex-1 py-2 rounded-r-lg transition-all ${side === 'sell' ? 'bg-red-500 text-white font-medium' : 'bg-dark-800 text-dark-400 hover:text-light'}`}>
            Sell
          </button>
        </div>

        {/* Available balance */}
        <div className="mb-3 p-2 bg-dark-900 rounded-lg">
          <div className="flex justify-between text-xs text-dark-400">
            <span>Available:</span>
            {side === 'buy' ? (
              <span className="text-light font-medium">
                ${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            ) : (
              <span className="text-light font-medium">
                {availableAsset.toFixed(6)} {asset.symbol}
              </span>
            )}
          </div>
          {isPaperMode && (
            <div className="mt-1 text-xs text-amber-400 text-center">📄 Paper Trading Mode</div>
          )}
        </div>

        {/* Order type */}
        <div className="flex gap-2 mb-3">
          {(['market', 'limit', 'stop'] as const).map(t => (
            <button key={t} type="button" onClick={() => setOrderType(t)}
              className={`px-3 py-1 text-sm rounded-md transition-all capitalize ${orderType === t ? 'bg-primary text-white' : 'bg-dark-800 text-dark-400 hover:text-light'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Price (hidden for market) */}
        {orderType !== 'market' && (
          <div className="mb-3">
            <label className="block text-sm text-dark-400 mb-1">Price</label>
            <div className="relative">
              <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                className="input-field w-full pr-16" placeholder="0.00" step="any" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 text-sm">USD</span>
            </div>
          </div>
        )}

        {/* Amount */}
        <div className="mb-3">
          <label className="block text-sm text-dark-400 mb-1">Amount</label>
          <div className="relative">
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="input-field w-full pr-16" placeholder="0.000000" step="any" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 text-sm">{asset.symbol}</span>
          </div>
        </div>

        {/* Percentage buttons */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[25, 50, 75, 100].map(pct => (
            <button key={pct} type="button" onClick={() => handleAmountPercentage(pct)}
              className="text-xs py-1 bg-dark-800 rounded-md hover:bg-dark-700 transition-colors">
              {pct}%
            </button>
          ))}
        </div>

        {/* Total */}
        <div className="mb-3">
          <label className="block text-sm text-dark-400 mb-1">Total</label>
          <div className="relative">
            <input type="text" value={`$${total}`} readOnly className="input-field w-full pr-16 bg-dark-800/50" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 text-sm">USD</span>
          </div>
        </div>

        {/* Advanced (SL/TP) */}
        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full text-xs text-dark-400 hover:text-primary mb-3 flex items-center justify-center gap-1 transition-colors">
          <span>{showAdvanced ? '▲' : '▼'}</span>
          {showAdvanced ? 'Hide' : 'Show'} Stop Loss / Take Profit
        </button>

        {showAdvanced && (
          <div className="space-y-3 mb-4 p-3 bg-dark-900/50 rounded-lg border border-dark-700">
            <div>
              <label className="block text-xs text-red-400 mb-1">Stop Loss (USD)</label>
              <div className="relative">
                <input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)}
                  placeholder="Optional" className="input-field w-full pr-16 text-sm" step="any" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 text-xs">USD</span>
              </div>
              {stopLoss && !isNaN(slNum) && orderType !== 'market' && (
                (side === 'buy'  && slNum >= prNum) ||
                (side === 'sell' && slNum <= prNum)
              ) && (
                <p className="text-xs text-red-400 mt-1">
                  Stop loss should be {side === 'buy' ? 'below' : 'above'} entry price for {side} orders
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs text-secondary mb-1">Take Profit (USD)</label>
              <div className="relative">
                <input type="number" value={takeProfit} onChange={e => setTakeProfit(e.target.value)}
                  placeholder="Optional" className="input-field w-full pr-16 text-sm" step="any" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 text-xs">USD</span>
              </div>
              {takeProfit && !isNaN(tpNum) && orderType !== 'market' && (
                (side === 'buy'  && tpNum <= prNum) ||
                (side === 'sell' && tpNum >= prNum)
              ) && (
                <p className="text-xs text-amber-400 mt-1">
                  Take profit should be {side === 'buy' ? 'above' : 'below'} entry price for {side} orders
                </p>
              )}
            </div>
          </div>
        )}

        <button type="submit" disabled={loading || !amount || parseFloat(amount) <= 0}
          className={`w-full py-3 rounded-lg font-medium transition-all ${
            loading || !amount || parseFloat(amount) <= 0 ? 'opacity-50 cursor-not-allowed' : ''
          } ${side === 'buy' ? 'bg-secondary hover:bg-secondary/90 text-dark-900' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
          {loading
            ? 'Submitting…'
            : `${side === 'buy' ? 'Buy' : 'Sell'} ${asset.symbol}${isPaperMode ? ' (Paper)' : ''}`}
        </button>
      </form>

      {pendingOrder && (
        <TradeConfirmModal
          isOpen={!!pendingOrder}
          order={pendingOrder}
          onConfirm={() => {
            onPlaceOrder(pendingOrder);
            setPendingOrder(null);
            setAmount(''); setStopLoss(''); setTakeProfit('');
          }}
          onCancel={() => setPendingOrder(null)}
        />
      )}
    </GlassCard>
  );
};

export default TradeForm;