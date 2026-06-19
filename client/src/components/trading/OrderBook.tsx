import React from 'react';
import GlassCard from '../common/GlassCard';
import { motion } from 'framer-motion';

interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

interface OrderBookProps {
  asks: OrderBookEntry[];
  bids: OrderBookEntry[];
  currentPrice: number;
  loading?: boolean;
}

const OrderBook: React.FC<OrderBookProps> = ({ asks, bids, currentPrice, loading = false }) => {
  if (loading) {
    return (
      <GlassCard className="p-6 h-full">
        <h3 className="text-lg font-semibold mb-4">Order Book</h3>
        <div className="text-center py-12 text-dark-400">Loading order book...</div>
      </GlassCard>
    );
  }
  const formatNumber = (value: number, decimals: number = 2) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Calculate totals and max total for visualization
  const asksWithTotal = asks.map(ask => ({
    ...ask,
    total: (ask.total !== undefined) ? ask.total : ask.price * ask.amount
  }));

  const bidsWithTotal = bids.map(bid => ({
    ...bid,
    total: (bid.total !== undefined) ? bid.total : bid.price * bid.amount
  }));

  const maxTotal = Math.max(
    ...asksWithTotal.map(ask => ask.total),
    ...bidsWithTotal.map(bid => bid.total),
    1 // Fallback to prevent -Infinity
  );

  return (
    <GlassCard className="p-6 h-full">
      <h3 className="text-lg font-semibold mb-4">Order Book</h3>
      
      <div className="mb-2 flex justify-between text-xs text-dark-400">
        <span>Price (USD)</span>
        <span>Amount</span>
        <span>Total</span>
      </div>
      
      {/* Asks (Sell Orders) */}
      <div className="mb-4 max-h-40 overflow-y-auto flex flex-col-reverse">
        {[...asksWithTotal].reverse().map((ask, index) => (
          <div 
            key={`ask-${index}`}
            className="grid grid-cols-3 text-right py-1 text-sm border-b border-dark-800 relative"
          >
            <div 
              className="absolute right-0 top-0 bottom-0 bg-red-500/10"
              style={{ width: `${(ask.total / maxTotal) * 100}%` }}
            ></div>
            <span className="text-red-500 relative z-10">{formatNumber(ask.price)}</span>
            <span className="relative z-10">{formatNumber(ask.amount, 4)}</span>
            <span className="relative z-10">{formatNumber(ask.total, 4)}</span>
          </div>
        ))}
      </div>
      
      {/* Current Price */}
      <div className="py-2 text-center font-medium text-lg border-y border-primary/30">
        <span className="text-primary">{formatCurrency(currentPrice)}</span>
      </div>
      
      {/* Bids (Buy Orders) */}
      <div className="mt-4 max-h-40 overflow-y-auto">
        {bidsWithTotal.map((bid, index) => (
          <div 
            key={`bid-${index}`}
            className="grid grid-cols-3 text-right py-1 text-sm border-b border-dark-800 relative"
          >
            <div 
              className="absolute right-0 top-0 bottom-0 bg-secondary/10"
              style={{ width: `${(bid.total / maxTotal) * 100}%` }}
            ></div>
            <span className="text-secondary relative z-10">{formatNumber(bid.price)}</span>
            <span className="relative z-10">{formatNumber(bid.amount, 4)}</span>
            <span className="relative z-10">{formatNumber(bid.total, 4)}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

export default OrderBook;