import React, { useRef, useEffect } from 'react';
import GlassCard from '../common/GlassCard';

interface OrderBookEntry {
  price: number;
  amount: number;
  total?: number;
}

interface OrderBookProps {
  asks: OrderBookEntry[];
  bids: OrderBookEntry[];
  currentPrice: number;
  loading?: boolean;
  /** Optional — called when user clicks a price level to fill trade form */
  onLevelClick?: (price: number) => void;
}

const OrderBook: React.FC<OrderBookProps> = ({ asks, bids, currentPrice, loading = false, onLevelClick }) => {
  const prevPriceRef = useRef(currentPrice);
  const priceRef     = useRef<HTMLSpanElement>(null);

  // Flash price cell on change
  useEffect(() => {
    if (!priceRef.current || currentPrice === prevPriceRef.current) return;
    const el = priceRef.current;
    const up = currentPrice > prevPriceRef.current;
    el.classList.add(up ? 'text-secondary' : 'text-red-400');
    el.classList.remove(!up ? 'text-secondary' : 'text-red-400');
    const t = setTimeout(() => {
      el.classList.remove('text-secondary', 'text-red-400');
      el.classList.add('text-primary');
    }, 800);
    prevPriceRef.current = currentPrice;
    return () => clearTimeout(t);
  }, [currentPrice]);

  const fmt  = (v: number, d = 2) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  const fmtUsd = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

  if (loading) return (
    <GlassCard className="p-5 h-full flex flex-col">
      <h3 className="text-base font-semibold mb-3">Order Book</h3>
      <div className="flex-1 flex items-center justify-center text-dark-400 text-sm">Loading…</div>
    </GlassCard>
  );

  if (!bids?.length || !asks?.length) return (
    <GlassCard className="p-5 h-full flex flex-col">
      <h3 className="text-base font-semibold mb-3">Order Book</h3>
      <div className="flex-1 flex flex-col items-center justify-center text-dark-400 text-sm gap-2">
        <div className="w-5 h-5 border-2 border-dark-400 border-t-primary rounded-full animate-spin" />
        <p>Connecting…</p>
        <p className="text-xs text-dark-500">Subscribe to an asset to see live depth</p>
      </div>
    </GlassCard>
  );

  const withTotal = (arr: OrderBookEntry[]) =>
    arr.map(e => ({ ...e, total: e.total ?? e.price * e.amount }));

  const asksT = withTotal(asks.slice(0, 15));
  const bidsT = withTotal(bids.slice(0, 15));
  const maxTotal = Math.max(...asksT.map(e => e.total!), ...bidsT.map(e => e.total!), 1);

  const Row = ({ entry, side }: { entry: (typeof asksT)[0]; side: 'ask'|'bid' }) => {
    const pct  = Math.min(100, (entry.total! / maxTotal) * 100);
    const bg   = side === 'ask' ? 'bg-red-500/8' : 'bg-secondary/8';
    const col  = side === 'ask' ? 'text-red-400' : 'text-secondary';
    return (
      <div
        className="grid grid-cols-3 text-right py-1.5 text-xs relative cursor-pointer hover:bg-dark-700/40 transition-colors rounded"
        onClick={() => onLevelClick?.(entry.price)}
      >
        <div className={`absolute inset-0 ${bg} rounded`} style={{ width: `${pct}%`, right: 0, left: 'auto' }} />
        <span className={`relative z-10 font-mono ${col}`}>{fmt(entry.price)}</span>
        <span className="relative z-10 text-dark-300 font-mono">{fmt(entry.amount, 4)}</span>
        <span className="relative z-10 text-dark-400 font-mono">{fmt(entry.total!, 2)}</span>
      </div>
    );
  };

  return (
    <GlassCard className="p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">Order Book</h3>
        <span className="flex items-center gap-1 text-xs text-secondary">
          <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse" /> Live
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 text-right text-xs text-dark-500 mb-1 px-0.5">
        <span>Price</span><span>Amount</span><span>Total</span>
      </div>

      {/* Asks (sell) — reversed so lowest ask is near the midprice */}
      <div className="flex-1 min-h-0 overflow-y-auto mb-1" style={{ maxHeight: 220 }}>
        {[...asksT].reverse().map((e, i) => <Row key={`a${i}`} entry={e} side="ask" />)}
      </div>

      {/* Mid price */}
      <div className="py-2 text-center border-y border-dark-700/60 my-1">
        <span ref={priceRef} className="text-primary text-lg font-bold transition-colors duration-300 font-mono">
          {fmtUsd(currentPrice)}
        </span>
      </div>

      {/* Bids (buy) */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-1" style={{ maxHeight: 220 }}>
        {bidsT.map((e, i) => <Row key={`b${i}`} entry={e} side="bid" />)}
      </div>
    </GlassCard>
  );
};

export default OrderBook;