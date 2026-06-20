import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import * as marketApi from '../../services/market.service';

interface TickerItem {
  symbol: string;
  price: number;
  change24h: number;
}

interface PriceTickerProps {
  symbols?: string[];
}

const DEFAULT_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'UNI', 'DOT'];

const PriceTicker: React.FC<PriceTickerProps> = ({ symbols = DEFAULT_SYMBOLS }) => {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchPrices = async () => {
    try {
      const res = await marketApi.getMarketPrices(symbols);
      // getMarketPrices returns ApiResponse<Record<string, any>>
      // Actual price data is under res.data
      const priceMap: Record<string, any> = res?.data ?? {};

      const parsed: TickerItem[] = symbols
        .map((sym) => {
          const d = priceMap[sym];
          if (!d || d.price === null || d.price === undefined) return null;
          const price = typeof d.price === 'number' ? d.price : Number(d.price);
          if (isNaN(price)) return null;
          return {
            symbol: sym,
            price,
            change24h: Number(d.change24h) || 0,
          };
        })
        .filter(Boolean) as TickerItem[];

      if (parsed.length > 0) setItems(parsed);
    } catch (err) {
      console.warn('[PriceTicker] Failed to fetch prices:', err);
    }
  };

  useEffect(() => {
    fetchPrices();
    intervalRef.current = setInterval(fetchPrices, 15_000);
    return () => clearInterval(intervalRef.current);
  }, []);

  if (items.length === 0) return null;

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: v >= 1000 ? 2 : v >= 1 ? 4 : 6,
    }).format(v);

  const all = [...items, ...items];

  return (
    <div
      className="w-full h-12 overflow-hidden bg-dark-900/80 border-b border-dark-700 py-1.5 flex items-center"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className="flex gap-8 whitespace-nowrap"
        style={{
          animation: 'ticker-scroll 40s linear infinite',
          animationPlayState: isPaused ? 'paused' : 'running',
        }}
      >
        {all.map((item, idx) => (
          <span key={`${item.symbol}-${idx}`} className="inline-flex items-center gap-2 text-sm">
            <span className="font-semibold text-light">{item.symbol}</span>
            <span className="text-dark-300">{fmt(item.price)}</span>
            <span className={`flex items-center gap-0.5 ${item.change24h >= 0 ? 'text-secondary' : 'text-red-500'}`}>
              {item.change24h >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

export default PriceTicker;
