import React, { useEffect, useState, useCallback } from 'react';
import LineChart from '../../components/charts/LineChart/LineChart';
import RiskGauge from '../../components/ai/RiskGauge/RiskGauge';
import SentimentCard from '../../components/ai/SentimentCard/SentimentCard';
import PredictionCard from '../../components/ai/PredictionCard/PredictionCard';
import StrategyCard from '../../components/ai/StrategyCard/StrategyCard';
import MarketInsightCard from '../../components/ai/MarketInsightCard/MarketInsightCard';
import { usePlan } from '../../context/PlanContext';
import UpgradeWall from '../../components/common/UpgradeWall/UpgradeWall';

import {
  Brain, Target, TrendingUp, AlertTriangle, Lightbulb,
  LineChart as LineChartIcon, RefreshCw, Zap, DollarSign
} from 'lucide-react';
import aiService from '../../services/ai.service';
import { apiFetch } from '../../services/api';
import { getMarketSummary } from '../../services/market.service';

// ─── Shared UI helpers ────────────────────────────────────────────────────────

const LoadingSkeleton = () => (
  <div className="bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-6 animate-pulse">
    <div className="h-64 bg-[#2A2B35]/50 rounded-lg" />
  </div>
);

const ErrorCard = ({ error, retryFn }: { error: string; retryFn: () => void }) => (
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

// ─── NEW: Market Overview Panel ───────────────────────────────────────────────

const MarketOverviewPanel: React.FC<{ data: any; loading: boolean }> = ({ data, loading }) => {
  if (loading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1,2,3,4].map(i => (
        <div key={i} className="bg-[#1A1B23]/60 border border-[#3D5AF1]/20 rounded-xl p-4 animate-pulse">
          <div className="h-3 bg-gray-700 rounded w-1/2 mb-3" />
          <div className="h-7 bg-gray-700 rounded w-3/4" />
        </div>
      ))}
    </div>
  );
  if (!data) return null;

  const stats = [
    {
      label: 'BTC Price',
      value: data.spotPrices?.BTC?.price
        ? `$${Number(data.spotPrices.BTC.price).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : '—',
      sub: data.spotPrices?.BTC?.change24h != null
        ? `${data.spotPrices.BTC.change24h > 0 ? '+' : ''}${Number(data.spotPrices.BTC.change24h).toFixed(2)}% 24h`
        : '',
      pos: (data.spotPrices?.BTC?.change24h ?? 0) >= 0
    },
    {
      label: 'ETH Price',
      value: data.spotPrices?.ETH?.price
        ? `$${Number(data.spotPrices.ETH.price).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : '—',
      sub: data.spotPrices?.ETH?.change24h != null
        ? `${data.spotPrices.ETH.change24h > 0 ? '+' : ''}${Number(data.spotPrices.ETH.change24h).toFixed(2)}% 24h`
        : '',
      pos: (data.spotPrices?.ETH?.change24h ?? 0) >= 0
    },
    {
      label: 'Fear & Greed',
      value: data.fearGreed?.value != null ? String(data.fearGreed.value) : '—',
      sub: data.fearGreed?.zone ?? '',
      pos: (data.fearGreed?.value ?? 50) > 50
    },
    {
      label: 'BTC Dominance',
      value: data.dominance?.btcDominance != null ? `${data.dominance.btcDominance}%` : '—',
      sub: data.dominance?.signal ?? '',
      pos: true
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((s, i) => (
        <div key={i} className="bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-4 hover:border-[#3D5AF1]/40 transition-all">
          <div className="text-xs text-gray-400 mb-1">{s.label}</div>
          <div className="text-2xl font-bold text-white">{s.value}</div>
          {s.sub && <div className={`text-xs mt-1 ${s.pos ? 'text-green-400' : 'text-red-400'}`}>{s.sub}</div>}
        </div>
      ))}
    </div>
  );
};

// ─── NEW: Investment Opportunities Panel ──────────────────────────────────────

const OpportunitiesPanel: React.FC<{ data: any[]; loading: boolean; error: string | null; retry: () => void }> = ({ data, loading, error, retry }) => {
  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1,2,3].map(i => <LoadingSkeleton key={i} />)}
    </div>
  );
  if (error) return <ErrorCard error={error} retryFn={retry} />;
  if (!data.length) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((opp, i) => (
        <div key={i} className="bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-5 hover:border-[#3D5AF1]/40 transition-all">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="text-lg font-bold text-white">{opp.symbol}</div>
              <div className={`text-sm ${opp.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {opp.change24h > 0 ? '+' : ''}{opp.change24h}% 24h
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              opp.riskLevel === 'high' ? 'bg-red-500/20 text-red-400' :
              opp.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-green-500/20 text-green-400'
            }`}>
              {opp.riskLevel} risk
            </span>
          </div>
          <div className="text-sm text-gray-300 mb-3">{opp.reason}</div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Score: {opp.opportunityScore}/100</span>
            <span>${opp.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="mt-2 h-1.5 bg-gray-700 rounded-full">
            <div
              className="h-1.5 bg-[#3D5AF1] rounded-full transition-all"
              style={{ width: `${opp.opportunityScore}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Existing sub-components ──────────────────────────────────────────────────

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
      {data.signal && <p className="text-xs text-gray-500 mt-2">{data.signal}</p>}
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
    if (value >= 75) return '#FF4B4B';
    if (value >= 55) return '#FFB800';
    if (value >= 45) return '#888888';
    if (value >= 25) return '#3D5AF1';
    return '#22DFBF';
  };
  const color = getColor(data.value);
  const rotation = (data.value / 100) * 180 - 90;

  return (
    <div className="bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-6 hover:border-[#3D5AF1]/40 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Fear & Greed Index</h3>
        <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">● Live</span>
      </div>
      <div className="flex flex-col items-center mb-4">
        <div className="relative w-40 h-20 mb-2">
          <svg viewBox="0 0 200 110" className="w-full">
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="16" strokeLinecap="round" />
            <path d="M 20 100 A 80 80 0 0 1 60 36" fill="none" stroke="#22DFBF" strokeWidth="16" strokeLinecap="round" opacity="0.6" />
            <path d="M 60 36 A 80 80 0 0 1 100 20" fill="none" stroke="#3D5AF1" strokeWidth="16" strokeLinecap="round" opacity="0.6" />
            <path d="M 100 20 A 80 80 0 0 1 140 36" fill="none" stroke="#888" strokeWidth="16" strokeLinecap="round" opacity="0.6" />
            <path d="M 140 36 A 80 80 0 0 1 180 100" fill="none" stroke="#FFB800" strokeWidth="16" strokeLinecap="round" opacity="0.6" />
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
              <span className="text-xs text-gray-600">{h.date?.split(' ')[1] ?? ''}</span>
            </div>
          ))}
        </div>
      )}
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
        {[1,2,3,4,5].map(i => <div key={i} className="px-3 py-1 rounded-full bg-gray-700 w-20 h-6" />)}
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

// ─── Main page component ──────────────────────────────────────────────────────

const AIInsights: React.FC = () => {
  const { canAccessFeature } = usePlan();

  // Market overview (new)
  const [marketOverview, setMarketOverview] = useState<any>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Dominance (from market summary)
  const [marketSummaryData, setMarketSummaryData] = useState<any>(null);
  const [marketSummaryLoading, setMarketSummaryLoading] = useState(true);

  // Price predictions chart
  const [pricePredictions, setPricePredictions] = useState<any>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  // Risk assessment
  const [riskAssessment, setRiskAssessment] = useState<any>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState<string | null>(null);

  // Market sentiment
  const [sentiments, setSentiments] = useState<any[]>([]);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [sentimentError, setSentimentError] = useState<string | null>(null);

  // Asset predictions (cards)
  const [assetPredictions, setAssetPredictions] = useState<any[]>([]);
  const [assetPredLoading, setAssetPredLoading] = useState(false);
  const [assetPredError, setAssetPredError] = useState<string | null>(null);

  // Strategies
  const [strategies, setStrategies] = useState<any[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(false);
  const [strategiesError, setStrategiesError] = useState<string | null>(null);

  // Market insights (news)
  const [insights, setInsights] = useState<any[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // Fear & Greed
  const [fearGreed, setFearGreed] = useState<any>(null);
  const [fearGreedLoading, setFearGreedLoading] = useState(true);

  // BTC dominance
  const [btcDominance, setBtcDominance] = useState<any>(null);

  // Trending coins
  const [trendingCoins, setTrendingCoins] = useState<any[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);

  // Investment opportunities (new)
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [oppLoading, setOppLoading] = useState(false);
  const [oppError, setOppError] = useState<string | null>(null);

  // Global refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!canAccessFeature('aiInsights')) {
    return (
      <UpgradeWall
        feature="AI Insights"
        requiredPlan="Pro"
        description="Get AI-powered market predictions, sentiment analysis, and investment strategies."
      />
    );
  }

  // ── Fetch functions ──────────────────────────────────────────────────────

  const fetchMarketOverview = useCallback(async () => {
    try {
      setOverviewLoading(true);
      const data = await aiService.getMarketOverview();
      setMarketOverview(data);
    } catch (err) {
      console.warn('Market overview failed:', err);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const fetchMarketSummary = useCallback(async () => {
    try {
      setMarketSummaryLoading(true);
      const res = await getMarketSummary();
      const d = res.data;
      const fearGreedValue = d.fearGreedIndex ?? 50;

      setMarketSummaryData({
        btcDominance: d.btcDominance ?? 50,
        ethDominance: 12,
        altcoinDominance: parseFloat((100 - (d.btcDominance ?? 50) - 12).toFixed(1)),
        marketCapChange24h: 0,
        totalMarketCapFormatted: d.totalMarketCap ? `$${(d.totalMarketCap / 1e12).toFixed(2)}T` : 'N/A',
        totalVolumeFormatted: d.volume24h ? `$${(d.volume24h / 1e9).toFixed(1)}B` : 'N/A',
        signal: '',
      });

      setFearGreed(prev => prev || {
        value: fearGreedValue,
        zone: getFearGreedLabel(fearGreedValue),
        change: 0,
        history: [],
        advice: 'Monitor market sentiment and adjust positions accordingly.',
      });
    } catch (e) {
      console.warn('Market summary failed:', e);
    } finally {
      setMarketSummaryLoading(false);
    }
  }, []);

  function getFearGreedLabel(value: number) {
    if (value <= 25) return 'Extreme Fear';
    if (value <= 45) return 'Fear';
    if (value <= 55) return 'Neutral';
    if (value <= 75) return 'Greed';
    return 'Extreme Greed';
  }

  const fetchPricePredictions = useCallback(async () => {
    try {
      setPriceLoading(true);
      setPriceError(null);
      // horizon sent as plain number string — validator strips letters and parses
      const data = await aiService.getPricePredictions('BTC', '1d', '30');
      if (data?.predictions) {
        setPricePredictions({
          labels: data.predictions.map((_: any, i: number) =>
            new Date(Date.now() + i * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          ),
          datasets: [{
            label: 'BTC Price Prediction',
            data: data.predictions.map((p: any) => p.price || p),
            borderColor: '#3D5AF1',
            backgroundColor: 'rgba(61, 90, 241, 0.1)',
            fill: true,
            tension: 0.4,
          }]
        });
      }
    } catch (error: any) {
      setPriceError(error.message || 'Failed to fetch price predictions');
    } finally {
      setPriceLoading(false);
    }
  }, []);

  const fetchRiskAssessment = useCallback(async () => {
    try {
      setRiskLoading(true);
      setRiskError(null);

      // Try real portfolio first, fall back to demo assets
      let assets = [
        { symbol: 'BTC', amount: 0.5 },
        { symbol: 'ETH', amount: 10 },
        { symbol: 'USDC', amount: 5000 }
      ];

      try {
        const portfolioData = await apiFetch('/api/portfolio/assets');
        if (portfolioData.data?.length > 0) {
          assets = portfolioData.data.map((a: any) => ({
            symbol: a.symbol,
            amount: parseFloat(a.quantity || a.value || '0') || 0
          })).filter((a: any) => a.amount > 0);
        }
      } catch { /* use demo assets */ }

      const data = await aiService.getRiskAssessment(assets, '30d');
      if (data?.portfolio) setRiskAssessment(data.portfolio);
    } catch (error: any) {
      setRiskError(error.message || 'Failed to fetch risk assessment');
    } finally {
      setRiskLoading(false);
    }
  }, []);

  const fetchMarketSentiments = useCallback(async () => {
    try {
      setSentimentLoading(true);
      setSentimentError(null);
      const symbols = ['BTC', 'ETH', 'ADA'];

      const sentimentData = await Promise.all(
        symbols.map(symbol =>
          aiService.getMarketSentiment(symbol, 'technical', '24h').catch(() => null)
        )
      );

      const formatted = sentimentData
        .map((data, i) => {
          if (!data) return null;
          const rawScore = data.overall?.score ?? 0.5;
          const scorePercent = data.overall?.scorePercent ?? Math.round(rawScore * 100);
          const change7d = data.overall?.change7d ?? ((rawScore - 0.5) * 20);
          return {
            sentiment: scorePercent > 60 ? 'positive' : scorePercent < 40 ? 'negative' : 'neutral',
            score: scorePercent,
            change: parseFloat(change7d.toFixed(2)),
            asset: symbols[i]
          };
        })
        .filter(Boolean);

      setSentiments(formatted);
    } catch (error: any) {
      setSentimentError(error.message || 'Failed to fetch sentiments');
    } finally {
      setSentimentLoading(false);
    }
  }, []);

  const fetchAssetPredictions = useCallback(async () => {
    try {
      setAssetPredLoading(true);
      setAssetPredError(null);
      const symbols = ['BTC', 'ETH', 'SOL'];
      const predictions: any[] = [];

      for (const symbol of symbols) {
        try {
          // Use '7' (plain number) so validator passes max(90) check
          const pred = await aiService.getPricePredictions(symbol, '1d', '7');
          predictions.push(pred);
        } catch {
          predictions.push(null);
        }
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      const formatted = predictions
        .map((pred, i) => {
          if (!pred) return null;
          return {
            asset: symbols[i],
            currentPrice: pred.currentPrice ?? pred.predictions?.[0]?.price ?? 0,
            predictedPrice: pred.average ?? pred.predictions?.slice(-1)[0]?.price ?? 0,
            confidence: pred.confidence || 75,
            timeframe: '7 Days'
          };
        })
        .filter(Boolean);

      setAssetPredictions(formatted);
    } catch (error: any) {
      setAssetPredError(error.message || 'Failed to fetch predictions');
    } finally {
      setAssetPredLoading(false);
    }
  }, []);

  const fetchStrategies = useCallback(async () => {
    try {
      setStrategiesLoading(true);
      setStrategiesError(null);

      let portfolio = [
        { symbol: 'BTC', amount: 0.5 },
        { symbol: 'ETH', amount: 10 },
        { symbol: 'USDC', amount: 5000 }
      ];

      try {
        const portfolioData = await apiFetch('/api/portfolio/assets');
        if (portfolioData.data?.length > 0) {
          portfolio = portfolioData.data.map((asset: any) => ({
            symbol: asset.symbol,
            amount: asset.quantity || asset.value || 0
          }));
        }
      } catch { /* use demo portfolio */ }

      const data = await aiService.getStrategyRecommendations(portfolio, {
        riskTolerance: 0.7,
        investmentHorizon: '180d',
        strategy: 'mixed'
      });

      if (data?.strategies) {
        setStrategies(data.strategies.map((s: any) => ({
          title: s.type?.replace(/_/g, ' ').toUpperCase() || 'Strategy',
          type: s.type || 'moderate',
          expectedReturn: s.expectedReturn || 15,
          riskLevel: s.risk || 5,
          timeframe: s.timeframe || '1-2 years',
          description: s.description || 'AI-generated strategy recommendation',
          actions: s.steps || []
        })));
      }
    } catch (error: any) {
      setStrategiesError(error.message || 'Failed to fetch strategies');
    } finally {
      setStrategiesLoading(false);
    }
  }, []);

  const formatRelativeTime = (timestamp: string | number) => {
    try {
      const date = new Date(timestamp);
      const secondsAgo = Math.floor((Date.now() - date.getTime()) / 1000);
      if (secondsAgo < 60) return 'Just now';
      if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
      if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
      return `${Math.floor(secondsAgo / 86400)}d ago`;
    } catch { return 'Recently'; }
  };

  const fetchInsights = useCallback(async () => {
    try {
      setInsightsLoading(true);
      setInsightsError(null);
      // Use '24h' (not '48h') and 'general,technical' — both valid with fixed validator
      const data = await aiService.analyzeNews('BTC,ETH,SOL', 'general,technical', '24h', 10);
      if (data) {
        const analysisData = data.analysis || data.articles || [];
        setInsights(analysisData.slice(0, 5).map((insight: any) => {
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
        }));
      }
    } catch (error: any) {
      setInsightsError(error.message || 'Failed to fetch insights');
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  const fetchFearGreed = useCallback(async () => {
    try {
      setFearGreedLoading(true);
      const data = await aiService.getFearGreedIndex();
      setFearGreed(data);
    } catch { /* fallback kept from market summary */ }
    finally { setFearGreedLoading(false); }
  }, []);

  const fetchBTCDominance = useCallback(async () => {
    try {
      const data = await aiService.getBTCDominance();
      setBtcDominance(data);
    } catch { /* silent */ }
  }, []);

  const fetchTrendingCoins = useCallback(async () => {
    try {
      setTrendingLoading(true);
      const data = await aiService.getTrendingCoins();
      setTrendingCoins(Array.isArray(data) ? data : data?.data || []);
    } catch {
      setTrendingCoins([
        { symbol: 'BTC' }, { symbol: 'ETH' }, { symbol: 'SOL' },
        { symbol: 'ADA' }, { symbol: 'XRP' }, { symbol: 'DOGE' }, { symbol: 'LINK' }
      ]);
    } finally { setTrendingLoading(false); }
  }, []);

  const fetchOpportunities = useCallback(async () => {
    try {
      setOppLoading(true);
      setOppError(null);
      const data = await aiService.getInvestmentOpportunities({ type: 'crypto', limit: 6 });
      setOpportunities(data?.opportunities || []);
    } catch (error: any) {
      setOppError(error.message || 'Failed to fetch opportunities');
    } finally {
      setOppLoading(false);
    }
  }, []);

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetchMarketOverview();
    fetchMarketSummary();
    fetchPricePredictions();
    fetchRiskAssessment();
    fetchMarketSentiments();
    fetchAssetPredictions();
    fetchStrategies();
    fetchInsights();
    fetchFearGreed();
    fetchBTCDominance();
    fetchTrendingCoins();
    fetchOpportunities();
  }, [
    fetchMarketOverview, fetchMarketSummary, fetchPricePredictions, fetchRiskAssessment,
    fetchMarketSentiments, fetchAssetPredictions, fetchStrategies, fetchInsights,
    fetchFearGreed, fetchBTCDominance, fetchTrendingCoins, fetchOpportunities
  ]);

  // Auto-refresh live data every 5 minutes
  useEffect(() => {
    const id = setInterval(() => {
      fetchMarketOverview();
      fetchMarketSentiments();
      fetchAssetPredictions();
      fetchInsights();
      fetchTrendingCoins();
      fetchBTCDominance();
      fetchOpportunities();
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchMarketOverview, fetchMarketSentiments, fetchAssetPredictions, fetchInsights, fetchTrendingCoins, fetchBTCDominance, fetchOpportunities]);

  // Fear & Greed refreshes hourly
  useEffect(() => {
    const id = setInterval(fetchFearGreed, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchFearGreed]);

  // ── Refresh All handler ───────────────────────────────────────────────────

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.allSettled([
      fetchMarketOverview(),
      fetchMarketSummary(),
      fetchPricePredictions(),
      fetchRiskAssessment(),
      fetchMarketSentiments(),
      fetchAssetPredictions(),
      fetchStrategies(),
      fetchInsights(),
      fetchFearGreed(),
      fetchBTCDominance(),
      fetchTrendingCoins(),
      fetchOpportunities()
    ]);
    setIsRefreshing(false);
  }, [
    fetchMarketOverview, fetchMarketSummary, fetchPricePredictions, fetchRiskAssessment,
    fetchMarketSentiments, fetchAssetPredictions, fetchStrategies, fetchInsights,
    fetchFearGreed, fetchBTCDominance, fetchTrendingCoins, fetchOpportunities
  ]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[rgb(40,43,55)] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-[#3D5AF1]" />
            <div>
              <h1 className="text-3xl font-bold">AI Market Insights</h1>
              <p className="text-gray-400 text-sm mt-1">Real-time ML-powered analysis and predictions</p>
            </div>
          </div>
          {/* NEW: Refresh All button */}
          <button
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-[#3D5AF1]/20 hover:bg-[#3D5AF1]/30 border border-[#3D5AF1]/30 rounded-lg text-sm font-medium text-[#3D5AF1] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh All'}
          </button>
        </div>

        {/* NEW: Market Overview Panel */}
        <MarketOverviewPanel data={marketOverview} loading={overviewLoading} />

        {/* Price Predictions + Risk Assessment */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-[#3D5AF1]" />
              <h2 className="text-xl font-semibold">Price Predictions (30 Days)</h2>
            </div>
            {priceLoading && <LoadingSkeleton />}
            {priceError && <ErrorCard error={priceError} retryFn={fetchPricePredictions} />}
            {pricePredictions && !priceLoading && <LineChart data={pricePredictions} />}
          </div>

          <div className="bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <AlertTriangle className="w-5 h-5 text-[#3D5AF1]" />
              <h2 className="text-xl font-semibold">Risk Assessment</h2>
            </div>
            {riskLoading && <LoadingSkeleton />}
            {riskError && <ErrorCard error={riskError} retryFn={fetchRiskAssessment} />}
            {riskAssessment && !riskLoading && (
              <div className="flex justify-center">
                <RiskGauge riskScore={riskAssessment.score || 50} />
              </div>
            )}
          </div>
        </div>

        {/* Fear & Greed */}
        <FearGreedCard data={fearGreed} loading={fearGreedLoading} />

        {/* BTC Dominance */}
        {!marketSummaryLoading && btcDominance
          ? <DominanceBar data={btcDominance} />
          : !marketSummaryLoading && marketSummaryData
          ? <DominanceBar data={marketSummaryData} />
          : null}

        {/* Trending Coins */}
        <TrendingCoins coins={trendingCoins} loading={trendingLoading} />

        {/* NEW: Investment Opportunities */}
        {(oppLoading || opportunities.length > 0 || oppError) && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <DollarSign className="w-5 h-5 text-[#3D5AF1]" />
              <h2 className="text-xl font-semibold">Investment Opportunities<DataBadge source="live" /></h2>
            </div>
            <OpportunitiesPanel data={opportunities} loading={oppLoading} error={oppError} retry={fetchOpportunities} />
          </div>
        )}

        {/* Market Sentiment */}
        {(sentimentLoading || sentiments.length > 0 || sentimentError) && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <LineChartIcon className="w-5 h-5 text-[#3D5AF1]" />
              <h2 className="text-xl font-semibold">Market Sentiment<DataBadge source="live" /></h2>
            </div>
            {sentimentLoading && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <LoadingSkeleton /><LoadingSkeleton /><LoadingSkeleton />
              </div>
            )}
            {sentimentError && <ErrorCard error={sentimentError} retryFn={fetchMarketSentiments} />}
            {sentiments.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {sentiments.map((s, i) => (
                  <SentimentCard key={i} sentiment={s.sentiment} score={s.score} change={s.change} asset={s.asset} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI-Powered Predictions (7-day cards) */}
        {(assetPredLoading || assetPredictions.length > 0 || assetPredError) && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Lightbulb className="w-5 h-5 text-[#3D5AF1]" />
              <h2 className="text-xl font-semibold">AI-Powered Predictions (7 Days)<DataBadge source="live" /></h2>
            </div>
            {assetPredLoading && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <LoadingSkeleton /><LoadingSkeleton /><LoadingSkeleton />
              </div>
            )}
            {assetPredError && <ErrorCard error={assetPredError} retryFn={fetchAssetPredictions} />}
            {assetPredictions.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {assetPredictions.map((pred, i) => (
                  <PredictionCard key={i} {...pred} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Strategy Recommendations */}
        {(strategiesLoading || strategies.length > 0 || strategiesError) && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Target className="w-5 h-5 text-[#3D5AF1]" />
              <h2 className="text-xl font-semibold">AI Strategy Recommendations<DataBadge source="live" /></h2>
            </div>
            {strategiesLoading && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <LoadingSkeleton /><LoadingSkeleton /><LoadingSkeleton />
              </div>
            )}
            {strategiesError && <ErrorCard error={strategiesError} retryFn={fetchStrategies} />}
            {strategies.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {strategies.map((strategy, i) => (
                  <StrategyCard key={i} {...strategy} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Latest AI Insights (news) */}
        {(insightsLoading || insights.length > 0 || insightsError) && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Brain className="w-5 h-5 text-[#3D5AF1]" />
              <h2 className="text-xl font-semibold">Latest AI Insights<DataBadge source="live" /></h2>
            </div>
            {insightsLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <LoadingSkeleton /><LoadingSkeleton />
              </div>
            )}
            {insightsError && <ErrorCard error={insightsError} retryFn={fetchInsights} />}
            {insights.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {insights.map((insight, i) => (
                  <MarketInsightCard key={i} {...insight} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Global loading banner */}
        {(priceLoading || riskLoading || sentimentLoading || assetPredLoading || strategiesLoading || insightsLoading) && (
          <div className="bg-blue-900/20 border border-blue-500/50 rounded-xl p-4 text-blue-200 text-sm">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 animate-pulse" />
              Loading AI insights from live data sources…
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInsights;
