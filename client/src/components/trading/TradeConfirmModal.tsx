import React from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

interface TradeConfirmModalProps {
  isOpen:    boolean;
  onConfirm: () => void;
  onCancel:  () => void;
  order: {
    symbol:      string;
    side:        'buy' | 'sell';
    type:        string;
    amount:      number;
    price?:      number;
    total:       number;
    stopLoss?:   { price: number };
    takeProfit?: { price: number };
    isPaper?:    boolean;
  };
}

const TradeConfirmModal: React.FC<TradeConfirmModalProps> = ({
  isOpen, onConfirm, onCancel, order,
}) => {
  if (!isOpen) return null;

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

  const estimatedFee = order.total * 0.001; // 0.1% taker fee estimate

  const warnings: string[] = [];
  if (order.stopLoss && order.price) {
    if (order.side === 'buy'  && order.stopLoss.price >= order.price)
      warnings.push('Stop loss is above entry price for a buy order.');
    if (order.side === 'sell' && order.stopLoss.price <= order.price)
      warnings.push('Stop loss is below entry price for a sell order.');
  }
  if (order.takeProfit && order.price) {
    if (order.side === 'buy'  && order.takeProfit.price <= order.price)
      warnings.push('Take profit is below entry price for a buy order.');
    if (order.side === 'sell' && order.takeProfit.price >= order.price)
      warnings.push('Take profit is above entry price for a sell order.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-dark-900 border border-dark-700 p-6 shadow-2xl">
        <button
          className="absolute right-4 top-4 p-1 rounded-full hover:bg-dark-700 text-dark-400"
          onClick={onCancel}
        >
          <X size={18}/>
        </button>

        <h3 className="text-lg font-semibold mb-1">Confirm Order</h3>
        {order.isPaper && (
          <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">
            Paper Trade
          </span>
        )}

        <div className="mt-4 space-y-3 text-sm">
          {[
            { l: 'Asset',    v: order.symbol },
            { l: 'Side',     v: <span className={order.side === 'buy' ? 'text-secondary font-semibold' : 'text-red-500 font-semibold'}>{order.side.toUpperCase()}</span> },
            { l: 'Type',     v: <span className="capitalize">{order.type}</span> },
            { l: 'Amount',   v: `${order.amount} ${order.symbol.replace(/USDT|USD/,'')}` },
            { l: 'Price',    v: order.price ? fmt(order.price) : 'Market' },
            { l: 'Total',    v: fmt(order.total) },
            { l: 'Est. Fee', v: <span className="text-dark-400">{fmt(estimatedFee)} (~0.1%)</span> },
            ...(order.stopLoss   ? [{ l: 'Stop Loss',   v: fmt(order.stopLoss.price)   }] : []),
            ...(order.takeProfit ? [{ l: 'Take Profit', v: fmt(order.takeProfit.price) }] : []),
          ].map(({ l, v }) => (
            <div key={l} className="flex justify-between border-b border-dark-800 pb-2">
              <span className="text-dark-400">{l}</span>
              <span className="font-medium">{v}</span>
            </div>
          ))}
        </div>

        {warnings.length > 0 && (
          <div className="mt-4 space-y-2">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-xs">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5"/>
                {w}
              </div>
            ))}
          </div>
        )}

        {!order.isPaper && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5"/>
            This is a <strong>live order</strong>. Real funds will be used. Double-check all values before confirming.
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg bg-dark-800 text-light hover:bg-dark-700 transition-colors font-medium text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors
              ${order.side === 'buy'
                ? 'bg-secondary hover:bg-secondary/90 text-dark-900'
                : 'bg-red-500 hover:bg-red-600 text-white'}`}
          >
            <CheckCircle size={15}/>
            Confirm {order.isPaper ? 'Paper ' : ''}{order.side === 'buy' ? 'Buy' : 'Sell'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TradeConfirmModal;
