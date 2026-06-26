export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface Asset {
  id: string;
  name: string;
  symbol: string;
  type: 'crypto' | 'stock' | 'forex' | 'commodity';
  price: number;
  change24h: number;
  marketCap?: number;
  volume24h?: number;
  logo?: string;
}

export interface PortfolioAsset extends Asset {
  quantity: number;
  value: number;
  allocation: number;
  profitLoss: number;
  profitLossPercentage: number;
  averageBuyPrice: number;
}

export interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'transfer' | 'stake' | 'unstake' | 'swap';
  asset: Asset;
  quantity: number;
  price: number;
  total: number;
  fee: number;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface PortfolioSummary {
  totalValue: number;
  dailyChange: number;
  dailyChangePercentage: number;
  weeklyChange: number;
  weeklyChangePercentage: number;
  monthlyChange: number;
  monthlyChangePercentage: number;
  allTimeProfit: number;
  allTimeProfitPercentage: number;
}

export interface PerformanceMetrics {
  bestPerformingAsset: {
    symbol: string;
    name: string;
    returnPercentage: number;
  };
  worstPerformingAsset: {
    symbol: string;
    name: string;
    returnPercentage: number;
  };
  beta?: number;
  sharpeRatio?: number;
  sortino?: number;
  volatility?: number;
}

export interface PerformanceData {
  timestamp: number;
  value: number;
}

export interface MarketData {
  price: number;
  change24h: number;
  change24hPercentage: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  marketCap: number;
  supply: number;
  maxSupply?: number;
}

export interface ChartData {
  timestamp: number;
  value: number;
}

export interface AiInsight {
  id: string;
  type: 'prediction' | 'alert' | 'recommendation' | 'news';
  title: string;
  description: string;
  asset?: Asset;
  confidence: number;
  date: string;
  action?: 'buy' | 'sell' | 'hold';
}

export interface DefiProtocol {
  id: string;
  name: string;
  category: 'lending' | 'dex' | 'yield' | 'derivatives' | 'other';
  tvl: number;
  apy: number;
  risk: 'low' | 'medium' | 'high';
  logo?: string;
}

export interface DefiPosition {
  id: string;
  protocol: DefiProtocol;
  asset: Asset;
  value: number;
  apy: number;
  rewards: number;
  startDate: string;
  endDate?: string;
  status: 'active' | 'ended' | 'claimed';
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  date: string;
  read: boolean;
}

export interface PricePredictionResult {
  symbol: string;
  currentPrice: number | null;
  predictions: Array<{ price: number; timestamp: string }>;
  average: number;
  confidence: number;
}