import { apiFetch } from './api';

export interface MarketAsset {
  id: string;
  name: string;
  symbol: string;
  type: 'crypto' | 'stock' | 'commodity' | 'forex';
  price: number;
  change24h: number;
  marketCap?: number;
  volume24h?: number;
  logo?: string;
}

export interface MarketSummary {
  totalMarketCap: number;
  volume24h: number;
  marketCapChange?: number;
  volumeChange?: number;
  btcDominance?: number;
  fearGreedIndex?: number;
  topGainer?: { name: string; symbol: string; change: number };
  topLoser?: { name: string; symbol: string; change: number };
}

export interface PriceHistory {
  timestamp: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ApiResponse<T> {
  status: string;
  data: T;
}

export async function getMarketAssets(): Promise<ApiResponse<MarketAsset[]>> {
  const response = await apiFetch('/api/market/assets');
  return {
    status: response.status || 'success',
    data: response.data || response || []
  };
}

export async function getMarketPrices(symbols: string[]): Promise<ApiResponse<Record<string, any>>> {
  const symbolsParam = symbols.join(',');
  const response = await apiFetch(`/api/market/prices?symbols=${symbolsParam}`);
  return {
    status: response.status || 'success',
    data: response.data || response || {}
  };
}

export async function getPriceHistory(
  symbol: string,
  interval: string = '1d',
  from?: string,
  to?: string
): Promise<ApiResponse<{ prices?: PriceHistory[]; indicators?: any }>> {
  const params = new URLSearchParams();
  params.append('interval', interval);
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  
  const response = await apiFetch(
    `/api/market/history/${symbol}?${params.toString()}`
  );
  return {
    status: response.status || 'success',
    data: response.data || response || {}
  };
}

export async function getTrendingAssets(): Promise<ApiResponse<MarketAsset[]>> {
  return apiFetch<ApiResponse<MarketAsset[]>>('/api/market/trending');
}

export async function getMarketSummary(timeframe?: string): Promise<ApiResponse<MarketSummary>> {
  const url = timeframe ? `/api/market/summary?timeframe=${timeframe}` : '/api/market/summary';
  const response = await apiFetch(url);
  return {
    status: response.status || 'success',
    data: response.data || response || {
      totalMarketCap: 0,
      volume24h: 0,
      btcDominance: 0,
      fearGreedIndex: 0
    }
  };
}

// ✅ ADD — Watchlist API functions:
export async function getWatchlist(): Promise<ApiResponse<string[]>> {
  const response = await apiFetch('/api/market/watchlist');
  return {
    status: response.status || 'success',
    data: response.data || []
  };
}

export async function addToWatchlist(symbol: string): Promise<ApiResponse<string[]>> {
  const response = await apiFetch(`/api/market/watchlist/${encodeURIComponent(symbol)}`, {
    method: 'POST'
  });
  return {
    status: response.status || 'success',
    data: response.data || []
  };
}

export async function removeFromWatchlist(symbol: string): Promise<ApiResponse<string[]>> {
  const response = await apiFetch(`/api/market/watchlist/${encodeURIComponent(symbol)}`, {
    method: 'DELETE'
  });
  return {
    status: response.status || 'success',
    data: response.data || []
  };
}

// ✅ ADD — Price Alert API functions:
export interface PriceAlert {
  _id: string;
  symbol: string;
  condition: 'above' | 'below';
  targetPrice: number;
  notificationTypes: string[];
  triggered: boolean;
  createdAt: string;
}

export async function getPriceAlerts(): Promise<ApiResponse<PriceAlert[]>> {
  const response = await apiFetch('/api/market/alerts');
  return {
    status: response.status || 'success',
    data: response.data || []
  };
}

export async function createPriceAlert(payload: {
  symbol: string;
  type: 'above' | 'below';
  price: number;
  notificationTypes?: string[];
}): Promise<ApiResponse<PriceAlert>> {
  const response = await apiFetch('/api/market/alerts', {
    method: 'POST',
    body: payload
  });
  return {
    status: response.status || 'success',
    data: response.data
  };
}

export async function deletePriceAlert(alertId: string): Promise<ApiResponse<null>> {
  const response = await apiFetch(`/api/market/alerts/${encodeURIComponent(alertId)}`, {
    method: 'DELETE'
  });
  return {
    status: response.status || 'success',
    data: null
  };
}
