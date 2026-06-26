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

const DEFAULT_SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'DOT', 'MATIC',
];

const PriceTicker: React.FC<PriceTickerProps> = ({ symbols = DEFAULT_SYMBOLS }) => {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchPrices = async () => {
    try {
      const res = await marketApi.getMarketPrices(symbols);
      // getMarketPrices returns ApiResponse<Record<string,any>>
      // real data is under res.data
      const priceMap: Record<string, any> = (res as any)?.data ?? {};

      const parsed: TickerItem[] = symbols
        .map((sym) => {
          const d = priceMap[sym];
          if (!d || d.price === null || d.price === undefined) return null;
          const price = typeof d.price === 'number' ? d.price : Number(d.price);
          if (isNaN(price) || price <= 0) return null;
          return { symbol: sym, price, change24h: Number(d.change24h) || 0 };
        })
        .filter(Boolean) as TickerItem[];

      if (parsed.length > 0) {
        setItems(parsed);
        setIsLoading(false);
      }
    } catch {
      // silent — ticker is non-critical
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    intervalRef.current = setInterval(fetchPrices, 15_000);
    return () => clearInterval(intervalRef.current);
  }, []);

  if (isLoading || items.length === 0) {
    return (
      <div
        className="w-full overflow-hidden bg-dark-900/90 border-b border-dark-700 backdrop-blur-sm"
        style={{ height: 40 }}
      >
        <div className="flex items-center gap-8 h-full px-4">
          {/* Show loading skeletons */}
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="inline-flex items-center gap-2 shrink-0">
              <span className="inline-block w-12 h-4 bg-gray-700 animate-pulse rounded" />
              <span className="inline-block w-16 h-4 bg-gray-700 animate-pulse rounded" />
              <span className="inline-block w-12 h-4 bg-gray-700 animate-pulse rounded" />
            </span>
          ))}
        </div>
      </div>
    );
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: v >= 1000 ? 2 : v >= 1 ? 4 : 6,
    }).format(v);

  // Duplicate for seamless loop
  const all = [...items, ...items];

  return (
    /* KEY FIX: no negative margins. The ticker is 100% wide, clips its own overflow. */
    <div
      className="w-full overflow-hidden bg-dark-900/90 border-b border-dark-700 backdrop-blur-sm"
      style={{ height: 40 }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className="flex items-center gap-8 h-full whitespace-nowrap"
        style={{
          animation: 'ticker-scroll 50s linear infinite',
          animationPlayState: isPaused ? 'paused' : 'running',
          willChange: 'transform',
        }}
      >
        {all.map((item, idx) => (
          <span
            key={`${item.symbol}-${idx}`}
            className="inline-flex items-center gap-1.5 text-xs shrink-0"
          >
            <span className="font-bold text-light">{item.symbol}</span>
            <span className="text-dark-300">{fmt(item.price)}</span>
            <span
              className={`inline-flex items-center gap-0.5 font-medium ${
                item.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {item.change24h >= 0 ? (
                <TrendingUp size={10} />
              ) : (
                <TrendingDown size={10} />
              )}
              {item.change24h >= 0 ? '+' : ''}
              {item.change24h.toFixed(2)}%
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