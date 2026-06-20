import React, { useEffect, useState, useCallback } from 'react';
import LineChart from '../../components/charts/LineChart/LineChart';
import RiskGauge from '../../components/ai/RiskGauge/RiskGauge';
import SentimentCard from '../../components/ai/SentimentCard/SentimentCard';
import PredictionCard from '../../components/ai/PredictionCard/PredictionCard';
import StrategyCard from '../../components/ai/StrategyCard/StrategyCard';
import MarketInsightCard from '../../components/ai/MarketInsightCard/MarketInsightCard';
import { Brain, Target, TrendingUp, AlertTriangle, Lightbulb, LineChart as LineChartIcon } from 'lucide-react';
import aiService from '../../services/ai.service';
import { getMarketSummary } from '../../services/market.service';

// Loading Skeleton Component
const LoadingSkeleton = () => (
  <div className="bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-6 animate-pulse">
    <div className="h-64 bg-[#2A2B35]/50 rounded-lg"></div>
  </div>
);

// Error Message Component
const ErrorBoundary = ({ error, retryFn }: { error: string; retryFn: () => void }) => (
  <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6 text-red-200">
    <h3 className="font-semibold mb-2">Error Loading Data</h3>
    <p className="text-sm mb-4">{error}</p>
    <button
      onClick={retryFn}
      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
    >
      Retry
    </button>
  </div>
);

// Data Source Badge Component
const DataBadge = ({ source }: { source?: string }) => {
  if (!source) return null;
  const isLive = source === 'live' || source === 'kraken';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${
      isLive ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
    }`}>
      {isLive ? '● Live' : '◐ Cached'}
    </span>
  );
};
const DominanceBar: React.FC<{ data: any }> = ({ data }) => {
  if (!data) return null;
  return (
    <div className="bg-[#1A1B23]/60 border border-[#3D5AF1]/20 rounded-xl p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-white">Market Dominance</h3>
        <span className={`text-xs font-medium ${data.marketCapChange24h >= 0 ? 'text-[#22DFBF]' : 'text-red-400'}`}>
          {data.marketCapChange24h >= 0 ? '+' : ''}{data.marketCapChange24h}% 24h
        </span>
      </div>
      {/* Stacked bar */}
      <div className="flex rounded-full overflow-hidden h-3 mb-3">
        <div style={{ width: `${data.btcDominance}%` }} className="bg-[#F7931A]" title={`BTC ${data.btcDominance}%`} />
        <div style={{ width: `${data.ethDominance}%` }} className="bg-[#627EEA]" title={`ETH ${data.ethDominance}%`} />
        <div style={{ width: `${data.altcoinDominance}%` }} className="bg-[#3D5AF1]" title={`Alts ${data.altcoinDominance}%`} />
      </div>
      <div className="flex gap-4 text-xs">
        <span><span className="text-[#F7931A]">●</span> BTC {data.btcDominance}%</span>
        <span><span className="text-[#627EEA]">●</span> ETH {data.ethDominance}%</span>
        <span><span className="text-[#3D5AF1]">●</span> Alts {data.altcoinDominance}%</span>
      </div>
      <p className="text-xs text-gray-500 mt-2">{data.signal}</p>
      <div className="flex justify-between text-xs text-gray-500 mt-2">
        <span>Market Cap: {data.totalMarketCapFormatted}</span>
        <span>Vol 24h: {data.totalVolumeFormatted}</span>
      </div>
    </div>
  );
};
const FearGreedCard: React.FC<{ data: any; loading: boolean }> = ({ data, loading }) => {
  if (loading) return (
    <div className="bg-[#1A1B23]/60 border border-[#3D5AF1]/20 rounded-xl p-6 animate-pulse">
      <div className="h-4 bg-gray-700 rounded w-1/2 mb-4" />
      <div className="h-16 bg-gray-700 rounded w-1/3 mx-auto" />
    </div>
  );

  if (!data) return null;

  const getColor = (value: number) => {
    if (value >= 75) return '#FF4B4B';   // Extreme Greed — red
    if (value >= 55) return '#FFB800';   // Greed — orange
    if (value >= 45) return '#888888';   // Neutral — grey
    if (value >= 25) return '#3D5AF1';   // Fear — blue
    return '#22DFBF';                     // Extreme Fear — green (contrarian buy)
  };

  const color = getColor(data.value);
  const rotation = (data.value / 100) * 180 - 90; // -90 to +90 degrees

  return (
    <div className="bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-6 hover:border-[#3D5AF1]/40 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Fear & Greed Index</h3>
        <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">● Live</span>
      </div>

      {/* Gauge */}
      <div className="flex flex-col items-center mb-4">
        <div className="relative w-40 h-20 mb-2">
          <svg viewBox="0 0 200 110" className="w-full">
            {/* Background arc */}
            <path d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="16" strokeLinecap="round" />
            {/* Colored arc segments */}
            <path d="M 20 100 A 80 80 0 0 1 60 36"
              fill="none" stroke="#22DFBF" strokeWidth="16" strokeLinecap="round" opacity="0.6" />
            <path d="M 60 36 A 80 80 0 0 1 100 20"
              fill="none" stroke="#3D5AF1" strokeWidth="16" strokeLinecap="round" opacity="0.6" />
            <path d="M 100 20 A 80 80 0 0 1 140 36"
              fill="none" stroke="#888" strokeWidth="16" strokeLinecap="round" opacity="0.6" />
            <path d="M 140 36 A 80 80 0 0 1 180 100"
              fill="none" stroke="#FFB800" strokeWidth="16" strokeLinecap="round" opacity="0.6" />
            {/* Needle */}
            <line
              x1="100" y1="100"
              x2={100 + 65 * Math.cos((rotation - 90) * Math.PI / 180)}
              y2={100 + 65 * Math.sin((rotation - 90) * Math.PI / 180)}
              stroke={color} strokeWidth="3" strokeLinecap="round"
            />
            <circle cx="100" cy="100" r="5" fill={color} />
          </svg>
        </div>
        <div className="text-5xl font-bold mb-1" style={{ color }}>{data.value}</div>
        <div className="text-lg font-medium" style={{ color }}>{data.zone}</div>
        <div className="text-xs text-gray-500 mt-1">
          {data.change > 0 ? '+' : ''}{data.change} from yesterday
        </div>
      </div>

      {/* 7-day history */}
      {data.history?.length > 1 && (
        <div className="flex gap-1 justify-center mb-4">
          {data.history.slice(0, 7).reverse().map((h: any, i: number) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className="w-6 rounded-sm"
                style={{
                  height: `${Math.max(8, (h.value / 100) * 40)}px`,
                  backgroundColor: getColor(h.value),
                  opacity: 0.7 + (i / 7) * 0.3
                }}
              />
              <span className="text-xs text-gray-600">{h.date.split(' ')[1]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Advice */}
      <p className="text-xs text-gray-400 text-center leading-relaxed">{data.advice}</p>
      <p className="text-xs text-gray-600 text-center mt-2">Source: Alternative.me • Updates daily</p>
    </div>
  );
};

const TrendingCoins: React.FC<{ coins: any[]; loading?: boolean }> = ({ coins, loading }) => {
  if (loading) return (
    <div className="bg-[#1A1B23]/60 border border-[#3D5AF1]/20 rounded-xl p-4 animate-pulse">
      <div className="h-4 bg-gray-700 rounded w-1/4 mb-3" />
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-3 py-1 rounded-full bg-gray-700 w-20 h-6" />
        ))}
      </div>
    </div>
  );
  
  if (!coins?.length) return null;
  return (
    <div className="bg-[#1A1B23]/60 border border-[#3D5AF1]/20 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white mb-3">🔥 Trending Now</h3>
      <div className="flex flex-wrap gap-2">
        {coins.map((coin, i) => (
          <span key={i} className="px-3 py-1 rounded-full bg-[#3D5AF1]/10 border border-[#3D5AF1]/20 text-xs text-[#3D5AF1] font-medium">
            #{i + 1} {coin.symbol}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-600 mt-2">Source: CoinGecko • Updates every 10 min</p>
    </div>
  );
};

const AIInsights: React.FC = () => {
  // State for market summary data
  const [marketSummaryData, setMarketSummaryData] = useState<any>(null);
  const [marketSummaryLoading, setMarketSummaryLoading] = useState(true);

  // State for price predictions
  const [pricePredictions, setPricePredictions] = useState<any>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  // State for risk assessment
  const [riskAssessment, setRiskAssessment] = useState<any>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState<string | null>(null);

  // State for market sentiment
  const [sentiments, setSentiments] = useState<any[]>([]);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [sentimentError, setSentimentError] = useState<string | null>(null);

  // State for price predictions (for cards)
  const [assetPredictions, setAssetPredictions] = useState<any[]>([]);
  const [assetPredLoading, setAssetPredLoading] = useState(false);
  const [assetPredError, setAssetPredError] = useState<string | null>(null);

  // State for strategies
  const [strategies, setStrategies] = useState<any[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(false);
  const [strategiesError, setStrategiesError] = useState<string | null>(null);

  // State for market insights
  const [insights, setInsights] = useState<any[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // State for Fear & Greed Index
  const [fearGreed, setFearGreed] = useState<any>(null);
  const [fearGreedLoading, setFearGreedLoading] = useState(true);

  // State for BTC dominance
  const [btcDominance, setBtcDominance] = useState<any>(null);
  const [dominanceLoading, setDominanceLoading] = useState(false);

  // State for trending coins
  const [trendingCoins, setTrendingCoins] = useState<any[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);

  // Helper: Get fear/greed label from numeric value
  function getFearGreedLabel(value: number) {
    if (value <= 25) return 'Extreme Fear';
    if (value <= 45) return 'Fear';
    if (value <= 55) return 'Neutral';
    if (value <= 75) return 'Greed';
    return 'Extreme Greed';
  }

  // Fetch market summary (BTC dominance, market cap, fear/greed index)
  useEffect(() => {
    let cancelled = false;
    async function fetchSummary() {
      try {
        setMarketSummaryLoading(true);
        const res = await getMarketSummary();
        if (!cancelled) {
          const d = res.data;
          const fearGreedValue = d.fearGreedIndex ?? 50;
          
          // Set dominance data
          setMarketSummaryData({
            btcDominance: d.btcDominance ?? 50,
            ethDominance: 12, // not in API, approximate
            altcoinDominance: (100 - (d.btcDominance ?? 50) - 12).toFixed(1),
            marketCapChange24h: 0,
            totalMarketCapFormatted: d.totalMarketCap
              ? `$${(d.totalMarketCap / 1e12).toFixed(2)}T`
              : 'N/A',
            totalVolumeFormatted: d.volume24h
              ? `$${(d.volume24h / 1e9).toFixed(1)}B`
              : 'N/A',
            signal: '',
          });

          // Set fear & greed data for FearGreedCard
          setFearGreed({
            value: fearGreedValue,
            zone: getFearGreedLabel(fearGreedValue),
            change: 0,
            history: [],
            advice: 'Monitor market sentiment and adjust positions accordingly.',
          });
        }
      } catch (e) {
        console.error('Market summary fetch failed', e);
      } finally {
        if (!cancelled) setMarketSummaryLoading(false);
      }
    }
    fetchSummary();
    const interval = setInterval(fetchSummary, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Fetch price predictions for chart
  const fetchPricePredictions = useCallback(async () => {
    try {
      setPriceLoading(true);
      setPriceError(null);
      console.log('Fetching Bitcoin price predictions...');
      
      const data = await aiService.getPricePredictions('BTC', '1d', '30');
      
      // Transform data for chart
      if (data && data.predictions) {
        const chartData = {
          labels: data.predictions.map((_: any, i: number) => 
            new Date(Date.now() + i * 86400000).toLocaleDateString('en-US', { 
              month: 'short',
              day: 'numeric'
            })
          ),
          datasets: [
            {
              label: 'Bitcoin Price Prediction',
              data: data.predictions.map((p: any) => p.price || p),
              borderColor: '#3D5AF1',
              backgroundColor: 'rgba(61, 90, 241, 0.1)',
              fill: true,
              tension: 0.4,
            }
          ]
        };
        setPricePredictions(chartData);
        console.log('Price predictions loaded successfully');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch price predictions';
      setPriceError(errorMsg);
      console.error('Error fetching price predictions:', error);
    } finally {
      setPriceLoading(false);
    }
  }, []);

  // Fetch risk assessment
  const fetchRiskAssessment = useCallback(async () => {
    try {
      setRiskLoading(true);
      setRiskError(null);
      console.log('Fetching risk assessment...');
      
      const mockAssets = [
        { symbol: 'BTC', amount: 0.5 },
        { symbol: 'ETH', amount: 10 },
        { symbol: 'USDC', amount: 5000 }
      ];
      
      const data = await aiService.getRiskAssessment(mockAssets, '30d');
      
      if (data && data.portfolio) {
        setRiskAssessment(data.portfolio);
        console.log('Risk assessment loaded successfully');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch risk assessment';
      setRiskError(errorMsg);
      console.error('Error fetching risk assessment:', error);
    } finally {
      setRiskLoading(false);
    }
  }, []);

  // Fetch market sentiments
  const fetchMarketSentiments = useCallback(async () => {
    try {
      setSentimentLoading(true);
      setSentimentError(null);
      console.log('Fetching market sentiments...');
      
      const symbols = ['BTC', 'ETH', 'ADA'];
      const sentimentData = await Promise.all(
        symbols.map(symbol => 
          aiService.getMarketSentiment(symbol, 'social,news', '24h')
            .catch(() => null)
        )
      );

      const formattedSentiments = sentimentData
        .map((data, i) => {
          if (!data) return null;
          
          // Convert 0-1 score to 0-100 percentage
          const rawScore = data.overall?.score ?? 0.5;           // 0–1
          const scorePercent = data.overall?.scorePercent        // use pre-computed if available
                            ?? Math.round(rawScore * 100);       // else convert
          
          // Use real 7-day change if available, else proportional approximation
          const change7d = data.overall?.change7d                // real 7-day change
                        ?? ((rawScore - 0.5) * 20);              // proportional approximation if not
          
          return {
            sentiment: scorePercent > 60 ? 'positive' : scorePercent < 40 ? 'negative' : 'neutral',
            score: scorePercent,   // now correctly in 0–100 range
            change: parseFloat(change7d.toFixed(2)),
            asset: symbols[i]
          };
        })
        .filter(Boolean);

      setSentiments(formattedSentiments);
      console.log('Market sentiments loaded successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch sentiments';
      setSentimentError(errorMsg);
      console.error('Error fetching sentiments:', error);
    } finally {
      setSentimentLoading(false);
    }
  }, []);

  // Fetch asset price predictions (for cards)
  const fetchAssetPredictions = useCallback(async () => {
    try {
      setAssetPredLoading(true);
      setAssetPredError(null);
      console.log('Fetching asset predictions...');
      
      const symbols = ['BTC', 'ETH', 'SOL'];
      const predictions: any[] = [];
      
      // Fetch with delays to avoid rate limiting
      for (const symbol of symbols) {
        try {
          const pred = await aiService.getPricePredictions(symbol, '1d', '7');
          predictions.push(pred);
        } catch (error) {
          console.warn(`Failed to fetch prediction for ${symbol}:`, error);
          predictions.push(null);
        }
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Format predictions for display
      const formattedPredictions = predictions
        .map((pred, i) => {
          if (!pred) return null;
          return {
            asset: symbols[i],
            currentPrice: pred.currentPrice 
                       ?? pred.predictions?.[0]?.price 
                       ?? pred.average 
                       ?? 0,
            predictedPrice: pred.average 
                         ?? pred.predictions?.slice(-1)[0]?.price 
                         ?? 0,
            confidence: pred.confidence || 75,
            timeframe: '7 Days'
          };
        })
        .filter(Boolean);

      setAssetPredictions(formattedPredictions);
      console.log('Asset predictions loaded successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch predictions';
      setAssetPredError(errorMsg);
      console.error('Error fetching asset predictions:', error);
    } finally {
      setAssetPredLoading(false);
    }
  }, []);

  // Fetch strategy recommendations
  const fetchStrategies = useCallback(async () => {
    try {
      setStrategiesLoading(true);
      setStrategiesError(null);
      console.log('Fetching strategy recommendations...');
      
      // Try to fetch real portfolio, fall back to mock if not available
      let portfolio = [
        { symbol: 'BTC', amount: 0.5 },
        { symbol: 'ETH', amount: 10 },
        { symbol: 'USDC', amount: 5000 }
      ];

      try {
        // Attempt to fetch real portfolio from server
        const portfolioData = await fetch('/api/portfolio/assets').then(r => r.json());
        if (portfolioData.data && Array.isArray(portfolioData.data) && portfolioData.data.length > 0) {
          portfolio = portfolioData.data.map((asset: any) => ({
            symbol: asset.symbol,
            amount: asset.quantity || asset.value || 0
          }));
          console.log('✓ Using real portfolio data');
        }
      } catch {
        console.log('Using mock portfolio (real portfolio unavailable)');
      }

      const data = await aiService.getStrategyRecommendations(
        portfolio,
        {
          riskTolerance: 0.7,
          investmentHorizon: '180d',
          strategy: 'mixed'
        }
      );

      if (data && data.strategies) {
        const formattedStrategies = data.strategies.map((s: any) => ({
          title: s.type?.replace(/_/g, ' ').toUpperCase() || 'Strategy',
          type: s.type || 'moderate',
          expectedReturn: s.expectedReturn || 15,
          riskLevel: s.risk || 5,
          timeframe: s.timeframe || '1-2 years',
          description: s.description || 'AI-generated strategy recommendation',
          actions: s.steps || []
        }));
        
        setStrategies(formattedStrategies);
        console.log('✓ Strategies loaded successfully:', formattedStrategies.length, 'strategies');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch strategies';
      setStrategiesError(errorMsg);
      console.error('Error fetching strategies:', error);
    } finally {
      setStrategiesLoading(false);
    }
  }, []);

  // Helper to format relative time
  const formatRelativeTime = (timestamp: string | number) => {
    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
      const now = new Date();
      const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (secondsAgo < 60) return 'Just now';
      if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
      if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
      if (secondsAgo < 604800) return `${Math.floor(secondsAgo / 86400)}d ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Recently';
    }
  };

  // Fetch market insights/news analysis
  const fetchInsights = useCallback(async () => {
    try {
      setInsightsLoading(true);
      setInsightsError(null);
      console.log('Fetching market insights...');
      
      const data = await aiService.analyzeNews('BTC,ETH,SOL', 'general,technical', '48h', 10);

      if (data) {
        // Format insights from news analysis - handle both analysis and articles fields
        const analysisData = data.analysis || data.articles || [];
        const formattedInsights = analysisData
          .slice(0, 5)
          .map((insight: any) => {
            const rawConf = insight.confidence ?? 0.75;
            return {
              title: insight.title || 'Market Event',
              description: insight.summary || insight.description || 'AI analysis of market developments',
              impact: insight.sentiment === 'positive' ? 'positive' : insight.sentiment === 'negative' ? 'negative' : 'neutral',
              confidence: rawConf <= 1 ? Math.round(rawConf * 100) : Math.round(rawConf),
              tags: insight.tags || [insight.category || 'Market'],
              timestamp: formatRelativeTime(insight.timestamp),
              sentiment: insight.sentiment || 'neutral'
            };
          });

        setInsights(formattedInsights);
        console.log('✓ Insights loaded successfully:', formattedInsights.length, 'items');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch insights';
      setInsightsError(errorMsg);
      console.error('Error fetching insights:', error);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  // Fetch Fear & Greed Index
  const fetchFearGreed = useCallback(async () => {
    try {
      setFearGreedLoading(true);
      const data = await aiService.getFearGreedIndex();
      setFearGreed(data);
    } catch (err) {
      console.error('Fear & Greed fetch failed:', err);
    } finally {
      setFearGreedLoading(false);
    }
  }, []);

  // Fetch BTC dominance
  const fetchBTCDominance = useCallback(async () => {
    try {
      setDominanceLoading(true);
      const data = await aiService.getBTCDominance();
      setBtcDominance(data);
    } catch (err) {
      console.error('BTC dominance fetch failed:', err);
    } finally {
      setDominanceLoading(false);
    }
  }, []);

  // Fetch trending coins
  const fetchTrendingCoins = useCallback(async () => {
    try {
      setTrendingLoading(true);
      const data = await aiService.getTrendingCoins();
      setTrendingCoins(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      console.error('Trending coins fetch failed:', err);
      // Fallback to mock data if service fails
      const mockTrending = [
        { symbol: 'BTC', name: 'Bitcoin' },
        { symbol: 'ETH', name: 'Ethereum' },
        { symbol: 'SOL', name: 'Solana' },
        { symbol: 'ADA', name: 'Cardano' },
        { symbol: 'XRP', name: 'Ripple' },
        { symbol: 'DOGE', name: 'Dogecoin' },
        { symbol: 'LINK', name: 'Chainlink' }
      ];
      setTrendingCoins(mockTrending);
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  // Load all data on component mount
  useEffect(() => {
    fetchPricePredictions();
    fetchRiskAssessment();
    fetchMarketSentiments();
    fetchAssetPredictions();
    fetchStrategies();
    fetchInsights();
    fetchFearGreed();
    fetchBTCDominance();
    fetchTrendingCoins();
  }, [
    fetchPricePredictions,
    fetchRiskAssessment,
    fetchMarketSentiments,
    fetchAssetPredictions,
    fetchStrategies,
    fetchInsights,
    fetchFearGreed,
    fetchBTCDominance,
    fetchTrendingCoins
  ]);

  // Refresh live data every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMarketSentiments();
      fetchAssetPredictions();
      fetchInsights();
      fetchTrendingCoins();
      fetchBTCDominance();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchMarketSentiments, fetchAssetPredictions, fetchInsights, fetchTrendingCoins, fetchBTCDominance]);

  // Refresh Fear & Greed every hour (it only updates daily)
  useEffect(() => {
    fetchFearGreed();
    const interval = setInterval(fetchFearGreed, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchFearGreed]);

  return (
    <div className="min-h-screen bg-[rgb(40,43,55)] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Brain className="w-8 h-8 text-[#3D5AF1]" />
          <div>
            <h1 className="text-3xl font-bold">AI Market Insights</h1>
            <p className="text-gray-400 text-sm mt-1">Real-time ML-powered analysis and predictions</p>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Price Predictions Section */}
          <div className="lg:col-span-2 bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-[#3D5AF1]" />
              <h2 className="text-xl font-semibold">Price Predictions (180 Days)</h2>
            </div>
            {priceLoading && <LoadingSkeleton />}
            {priceError && <ErrorBoundary error={priceError} retryFn={fetchPricePredictions} />}
            {pricePredictions && <LineChart data={pricePredictions} />}
          </div>

          {/* Risk Assessment */}
          <div className="bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <AlertTriangle className="w-5 h-5 text-[#3D5AF1]" />
              <h2 className="text-xl font-semibold">Risk Assessment</h2>
            </div>
            {riskLoading && <LoadingSkeleton />}
            {riskError && <ErrorBoundary error={riskError} retryFn={fetchRiskAssessment} />}
            {riskAssessment && (
              <div className="flex justify-center">
                <RiskGauge riskScore={riskAssessment.score || 50} />
              </div>
            )}
          </div>
        </div>
        {/* Fear & Greed Index */}
        <FearGreedCard data={fearGreed} loading={fearGreedLoading} />

        {/* BTC Dominance */}
        {!marketSummaryLoading && marketSummaryData && <DominanceBar data={marketSummaryData} />}

        {/* Trending Now */}
        <TrendingCoins coins={trendingCoins} loading={trendingLoading} />

        {/* Market Sentiment */}
        {sentimentLoading || sentiments.length > 0 || sentimentError ? (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <LineChartIcon className="w-5 h-5 text-[#3D5AF1]" />
              <h2 className="text-xl font-semibold">Market Sentiment<DataBadge source="live" /></h2>
            </div>
            {sentimentLoading && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <LoadingSkeleton />
                <LoadingSkeleton />
                <LoadingSkeleton />
              </div>
            )}
            {sentimentError && <ErrorBoundary error={sentimentError} retryFn={fetchMarketSentiments} />}
            {sentiments.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {sentiments.map((sentiment, i) => (
                  <SentimentCard
                    key={i}
                    sentiment={sentiment.sentiment}
                    score={sentiment.score}
                    change={sentiment.change}
                    asset={sentiment.asset}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* AI-Powered Predictions */}
        {assetPredLoading || assetPredictions.length > 0 || assetPredError ? (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Lightbulb className="w-5 h-5 text-[#3D5AF1]" />
              <h2 className="text-xl font-semibold">AI-Powered Predictions (7 Days)<DataBadge source="live" /></h2>
            </div>
            {assetPredLoading && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <LoadingSkeleton />
                <LoadingSkeleton />
                <LoadingSkeleton />
              </div>
            )}
            {assetPredError && <ErrorBoundary error={assetPredError} retryFn={fetchAssetPredictions} />}
            {assetPredictions.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {assetPredictions.map((pred, i) => (
                  <PredictionCard
                    key={i}
                    asset={pred.asset}
                    currentPrice={pred.currentPrice}
                    predictedPrice={pred.predictedPrice}
                    confidence={pred.confidence}
                    timeframe={pred.timeframe}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Strategy Recommendations */}
        {strategiesLoading || strategies.length > 0 || strategiesError ? (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Target className="w-5 h-5 text-[#3D5AF1]" />
              <h2 className="text-xl font-semibold">AI Strategy Recommendations<DataBadge source="live" /></h2>
            </div>
            {strategiesLoading && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <LoadingSkeleton />
                <LoadingSkeleton />
                <LoadingSkeleton />
              </div>
            )}
            {strategiesError && <ErrorBoundary error={strategiesError} retryFn={fetchStrategies} />}
            {strategies.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {strategies.map((strategy, index) => (
                  <StrategyCard key={index} {...strategy} />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Market Insights */}
        {insightsLoading || insights.length > 0 || insightsError ? (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Brain className="w-5 h-5 text-[#3D5AF1]" />
              <h2 className="text-xl font-semibold">Latest AI Insights<DataBadge source="live" /></h2>
            </div>
            {insightsLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <LoadingSkeleton />
                <LoadingSkeleton />
              </div>
            )}
            {insightsError && <ErrorBoundary error={insightsError} retryFn={fetchInsights} />}
            {insights.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {insights.map((insight, index) => (
                  <MarketInsightCard key={index} {...insight} />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Loading State Message */}
        {priceLoading || riskLoading || sentimentLoading || assetPredLoading || strategiesLoading || insightsLoading ? (
          <div className="bg-blue-900/20 border border-blue-500/50 rounded-xl p-4 text-blue-200 text-sm">
            <div className="flex items-center gap-2">
              <div className="animate-spin">⚡</div>
              Loading AI insights from server... Please wait.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AIInsights;
