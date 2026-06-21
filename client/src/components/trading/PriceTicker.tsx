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
  const [animationDuration, setAnimationDuration] = useState(50);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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

  // Track screen width and calculate animation duration
  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const calculateDuration = () => {
      if (contentRef.current && containerRef.current) {
        const contentWidth = contentRef.current.scrollWidth;
        const containerWidth = containerRef.current.clientWidth;
        
        if (contentWidth > 0) {
          // Calculate duration: ensure content scrolls smoothly across viewport
          // Faster for small screens, slower for large screens
          const baseSpeed = screenWidth < 640 ? 25 : screenWidth < 1024 ? 35 : 45;
          const duration = (contentWidth / containerWidth) * baseSpeed;
          setAnimationDuration(Math.max(20, duration));
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(calculateDuration, 100);
    return () => clearTimeout(timeoutId);
  }, [items, screenWidth]);

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
      ref={containerRef}
      className="w-full overflow-x-hidden bg-dark-900/80 border-b border-dark-700 py-1 sm:py-1.5 flex items-center"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        ref={contentRef}
        className="flex whitespace-nowrap"
        style={{
          animation: `ticker-scroll ${animationDuration}s linear infinite`,
          animationPlayState: isPaused ? 'paused' : 'running',
          minHeight: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: screenWidth < 640 ? '0.75rem' : screenWidth < 1024 ? '1rem' : '1.5rem',
          paddingLeft: screenWidth < 640 ? '0.5rem' : screenWidth < 1024 ? '1rem' : '1rem',
          paddingRight: screenWidth < 640 ? '0.5rem' : screenWidth < 1024 ? '1rem' : '1rem',
        }}
      >
        {all.map((item, idx) => (
          <div 
            key={`${item.symbol}-${idx}`} 
            className="inline-flex items-center flex-shrink-0"
            style={{ gap: screenWidth < 640 ? '0.25rem' : '0.5rem' }}
          >
            <span 
              className="font-semibold text-light whitespace-nowrap"
              style={{ fontSize: screenWidth < 640 ? '0.65rem' : screenWidth < 1024 ? '0.75rem' : '0.875rem' }}
            >
              {item.symbol}
            </span>
            <span 
              className="text-dark-300 whitespace-nowrap"
              style={{ fontSize: screenWidth < 640 ? '0.65rem' : screenWidth < 1024 ? '0.75rem' : '0.875rem' }}
            >
              {fmt(item.price)}
            </span>
            <span 
              className={`flex items-center whitespace-nowrap flex-shrink-0 ${item.change24h >= 0 ? 'text-secondary' : 'text-red-500'}`}
              style={{ fontSize: screenWidth < 640 ? '0.65rem' : screenWidth < 1024 ? '0.75rem' : '0.875rem', gap: '0.125rem' }}
            >
              {item.change24h >= 0 ? <TrendingUp size={screenWidth < 640 ? 8 : 10} /> : <TrendingDown size={screenWidth < 640 ? 8 : 10} />}
              {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%
            </span>
          </div>
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
