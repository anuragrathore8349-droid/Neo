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
  priceUnavailable?: boolean;
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
    data: response.data || response || [],
  };
}

export async function getMarketAssetsWithTimeframe(timeframe: string = '24h'): Promise<ApiResponse<MarketAsset[]>> {
  const response = await apiFetch(`/api/market/assets?timeframe=${timeframe}`);
  return {
    status: response.status || 'success',
    data: response.data || response || []
  };
}

export async function getMarketSummary(timeframe?: string): Promise<ApiResponse<MarketSummary>> {
  const url = timeframe ? `/api/market/summary?timeframe=${timeframe}` : '/api/market/summary';
  const response = await apiFetch(url);
  return {
    status: response.status || 'success',
    data: response.data || response || {},
  };
}

export async function getMarketPrices(symbols: string[]): Promise<ApiResponse<Record<string, any>>> {
  const symbolsParam = symbols.join(',');
  const response = await apiFetch(`/api/market/prices?symbols=${symbolsParam}`);
  return {
    status: response.status || 'success',
    data: response.data || response || {},
  };
}

export interface PriceAlert {
  _id: string;
  symbol: string;
  condition: 'above' | 'below';
  targetPrice: number;
  notificationTypes: Array<'email' | 'push' | 'sms'>;
  active: boolean;
  triggered?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePriceAlertPayload {
  symbol: string;
  type: 'above' | 'below';
  price: number;
  notificationTypes: Array<'email' | 'push' | 'sms'>;
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
  const response = await apiFetch(`/api/market/history/${symbol}?${params.toString()}`);
  return {
    status: response.status || 'success',
    data: response.data || response || {},
  };
}

export async function getPriceAlerts(limit = 50, skip = 0): Promise<ApiResponse<PriceAlert[]>> {
  const response = await apiFetch(`/api/market/alerts?limit=${limit}&skip=${skip}`);
  return {
    status: response.status || 'success',
    data: response.data || [],
  };
}

export async function createPriceAlert(payload: CreatePriceAlertPayload): Promise<ApiResponse<PriceAlert>> {
  const response = await apiFetch('/api/market/alerts', {
    method: 'POST',
    body: payload,
  });
  return {
    status: response.status || 'success',
    data: response.data || response || {} as PriceAlert,
  };
}

export async function deletePriceAlert(alertId: string): Promise<ApiResponse<{ message: string }>> {
  const response = await apiFetch(`/api/market/alerts/${alertId}`, {
    method: 'DELETE',
  });
  return {
    status: response.status || 'success',
    data: response.data || response || { message: 'Deleted' },
  };
}

export async function getTrendingAssets(): Promise<ApiResponse<MarketAsset[]>> {
  return apiFetch<ApiResponse<MarketAsset[]>>('/api/market/trending');
}

export async function searchMarketAssets(query: string): Promise<ApiResponse<MarketAsset[]>> {
  const response = await apiFetch(`/api/market/search?q=${encodeURIComponent(query)}`);
  return {
    status: response.status || 'success',
    data: response.data || response || [],
  };
}
