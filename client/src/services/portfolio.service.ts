import { apiFetch } from './api';

export interface PortfolioAsset {
  id: string;
  name: string;
  symbol: string;
  type: 'crypto' | 'stock' | 'commodity' | 'forex';
  price: number;
  change24h: number;
  marketCap?: number;
  volume24h?: number;
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
  asset: {
    id: string;
    name: string;
    symbol: string;
    type: 'crypto' | 'stock' | 'commodity' | 'forex';
    price: number;
    change24h: number;
  };
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

export interface PerformanceData {
  timestamp: number;
  value: number;
}

export interface AiInsight {
  id: string;
  type: 'prediction' | 'alert' | 'recommendation' | 'news';
  title: string;
  description: string;
  asset?: {
    id: string;
    name: string;
    symbol: string;
    type: 'crypto' | 'stock' | 'commodity' | 'forex';
    price: number;
    change24h: number;
  };
  confidence: number;
  date: string;
  action?: 'buy' | 'sell' | 'hold';
}

export async function getPortfolioSummary(): Promise<{ status: string; data: PortfolioSummary }> {
  const response = await apiFetch('/api/portfolio');
  return {
    status: response.status || 'success',
    data: response.data || response
  };
}

export async function getPortfolioAssets(): Promise<{ status: string; data: PortfolioAsset[] }> {
  const response = await apiFetch('/api/portfolio/assets');
  return {
    status: response.status || 'success',
    data: response.data || response || []
  };
}

export async function getPortfolioHistory(timeframe?: string): Promise<{ status: string; data: PerformanceData[] }> {
  const url = timeframe ? `/api/portfolio/history?timeframe=${timeframe}` : '/api/portfolio/history';
  const response = await apiFetch(url);
  return {
    status: response.status || 'success',
    data: response.data || response || []
  };
}

export async function getRecentTransactions(): Promise<{ status: string; data: Transaction[] }> {
  const response = await apiFetch('/api/transaction/recent');
  return {
    status: response.status || 'success',
    data: response.data || response || []
  };
}

export interface PortfolioExportPayload {
  summary: PortfolioSummary;
  assets: PortfolioAsset[];
  history: PerformanceData[];
  transactions: Transaction[];
}

export async function exportPortfolioData(): Promise<{ status: string; data: PortfolioExportPayload }> {
  return apiFetch('/api/portfolio/export');
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

export interface PriceHistory {
  date: string;
  price: number;
  value: number;
}

export async function getPerformanceMetrics(): Promise<{ status: string; data: PerformanceMetrics }> {
  const response = await apiFetch('/api/portfolio/performance');
  return {
    status: response.status || 'success',
    data: response.data || response
  };
}

export async function getAssetAllocation(): Promise<{ status: string; data: any[] }> {
  const response = await apiFetch('/api/portfolio/allocation');
  return {
    status: response.status || 'success',
    data: response.data || response || []
  };
}

export async function getAssetHistory(assetSymbol: string, timeframe?: string): Promise<{ status: string; data: PriceHistory[] }> {
  const url = timeframe 
    ? `/api/portfolio/assets/${assetSymbol}/history?timeframe=${timeframe}`
    : `/api/portfolio/assets/${assetSymbol}/history`;
  const response = await apiFetch(url);
  return {
    status: response.status || 'success',
    data: response.data || response || []
  };
}

export async function getTransactionsByAsset(assetSymbol: string): Promise<{ status: string; data: Transaction[] }> {
  const response = await apiFetch(`/api/transaction/asset/${assetSymbol}`);
  return {
    status: response.status || 'success',
    data: response.data || response || []
  };
}

export async function getAiInsights(): Promise<{ status: string; data: AiInsight[] }> {
  try {
    // Try primary AI insights endpoint
    try {
      const response = await apiFetch('/api/ai-insights');
      return {
        status: 'success',
        data: response.data || response || []
      };
    } catch (error) {
      // Fallback to analytics/predictions if primary fails
      console.warn('Primary AI insights endpoint failed, trying analytics/predictions', error);
      const predictions = await apiFetch('/api/analytics/predictions?symbol=BTC&timeframe=7d');
      
      if (predictions?.data?.insights && Array.isArray(predictions.data.insights)) {
        return {
          status: 'success',
          data: predictions.data.insights.map((insight: any) => ({
            id: `prediction-${Date.now()}-${Math.random()}`,
            type: (insight.type || 'prediction') as 'prediction' | 'alert' | 'recommendation' | 'news',
            title: insight.title || 'Price Prediction',
            description: insight.description || 'AI-generated analysis',
            asset: insight.asset || {
              id: 'btc',
              name: 'Bitcoin',
              symbol: 'BTC',
              type: 'crypto' as const,
              price: 0,
              change24h: 0
            },
            confidence: insight.confidence || 50,
            date: insight.date || new Date().toISOString(),
            action: (insight.action || 'hold') as 'buy' | 'sell' | 'hold'
          }))
        };
      }
      
      // Return empty array if both fail
      return { status: 'success', data: [] };
    }
  } catch (error) {
    console.error('Error fetching AI insights:', error);
    return { status: 'error', data: [] };
  }
}

export interface AvailableAsset {
  id: string;
  name: string;
  symbol: string;
  type: 'crypto' | 'stock' | 'commodity' | 'forex';
  price: number;
}

export interface AssetPayload {
  assetId: string;
  symbol: string;
  type: 'crypto' | 'stock' | 'commodity' | 'forex';
  amount: number;
  costBasis: number;
  currentPrice: number;
  value: number;
  profit: number;
  profitPercentage: number;
  allocation: number;
}

export interface CreateAssetPayload {
  name: string;
  description?: string;
  assets: AssetPayload[];
  totalValue?: number;
  totalProfit?: number;
  totalProfitPercentage?: number;
}

export async function getAvailableAssets(): Promise<{ status: string; data: AvailableAsset[] }> {
  try {
    const response = await apiFetch('/api/market/assets');
    
    // Helper to extract numeric price from any format
    const extractPrice = (priceData: any): number => {
      // Direct number
      if (typeof priceData === 'number') {
        if (!isNaN(priceData)) return priceData;
      }
      // Object with price property
      if (priceData && typeof priceData === 'object') {
        if (typeof priceData.price === 'number' && !isNaN(priceData.price)) {
          return priceData.price;
        }
        if (typeof priceData.value === 'number' && !isNaN(priceData.value)) {
          return priceData.value;
        }
      }
      // Try string conversion
      if (typeof priceData === 'string') {
        const parsed = parseFloat(priceData);
        if (!isNaN(parsed)) return parsed;
      }
      // Fallback
      return 0;
    };
    
    // Ensure we have clean data with numeric prices
    const cleanedData = (response.data || response || []).map((asset: any) => {
      const cleanPrice = extractPrice(asset.price);
      return {
        id: asset.id,
        name: asset.name,
        symbol: asset.symbol,
        type: asset.type || 'crypto',
        price: cleanPrice
      };
    });
    
    console.log('DEBUG: getAvailableAssets cleaned data sample:', cleanedData[0]);
    
    return {
      status: response.status || 'success',
      data: cleanedData
    };
  } catch (error) {
    console.error('Error fetching available assets:', error);
    return { status: 'error', data: [] };
  }
}

export async function createPortfolioAsset(payload: CreateAssetPayload): Promise<{ status: string; data?: any; message?: string }> {
  try {
    console.log('RECEIVED payload in createPortfolioAsset:', JSON.stringify(payload, null, 2));
    
    // ULTRA-STRICT: Validate that NO numeric fields are objects before even processing
    const validatePayloadTypes = (p: any) => {
      const numericFields = ['amount', 'costBasis', 'currentPrice', 'value', 'profit', 'profitPercentage', 'allocation'];
      p.assets?.forEach((asset: any, idx: number) => {
        numericFields.forEach(field => {
          if (typeof asset[field] === 'object' && asset[field] !== null) {
            const errorMsg = `CRITICAL: Asset ${idx} field "${field}" is an object: ${JSON.stringify(asset[field])}`;
            console.error('🔴 ' + errorMsg);
            throw new Error(errorMsg);
          }
          if (typeof asset[field] !== 'number' || isNaN(asset[field])) {
            throw new Error(`Asset ${idx} field "${field}" is not a valid number: ${asset[field]} (type: ${typeof asset[field]})`);
          }
        });
      });
      
      const portfolioNumericFields = ['totalValue', 'totalProfit', 'totalProfitPercentage'];
      portfolioNumericFields.forEach(field => {
        if (typeof p[field] === 'object' && p[field] !== null) {
          const errorMsg = `CRITICAL: Portfolio field "${field}" is an object: ${JSON.stringify(p[field])}`;
          console.error('🔴 ' + errorMsg);
          throw new Error(errorMsg);
        }
      });
    };
    
    validatePayloadTypes(payload);
    
    // The payload should already be clean from AddAssetModal, but let's verify
    const verifyPayload = {
      ...payload,
      assets: payload.assets?.map(asset => {
        // Log what we're about to send
        const logEntry = {
          symbol: asset.symbol,
          currentPrice: asset.currentPrice,
          currentPriceType: typeof asset.currentPrice,
          currentPriceIsNumber: typeof asset.currentPrice === 'number'
        };
        console.log('Verifying asset:', logEntry);
        
        // If currentPrice is not a number at this point, extract it with AGGRESSIVE fallback
        let cleanPrice = asset.currentPrice;
        if (typeof cleanPrice !== 'number' || isNaN(cleanPrice)) {
          console.warn('WARNING: currentPrice is not a valid number!', { cleanPrice, type: typeof cleanPrice });
          
          // Try multiple extraction methods
          if (cleanPrice && typeof cleanPrice === 'object') {
            // Try common property names
            const priceProps = ['price', 'value', 'p', 'c'];
            for (const prop of priceProps) {
              if (typeof cleanPrice[prop] === 'number' && !isNaN(cleanPrice[prop])) {
                cleanPrice = cleanPrice[prop];
                console.log(`Extracted price from object.${prop}:`, cleanPrice);
                break;
              }
            }
            // If still not extracted, try Number conversion
            if (typeof cleanPrice !== 'number' || isNaN(cleanPrice)) {
              const numAttempt = Number(cleanPrice);
              if (!isNaN(numAttempt)) {
                cleanPrice = numAttempt;
                console.log('Converted object to number:', cleanPrice);
              }
            }
          } else if (typeof cleanPrice === 'string') {
            const parsed = parseFloat(cleanPrice);
            if (!isNaN(parsed)) {
              cleanPrice = parsed;
              console.log('Parsed price from string:', cleanPrice);
            }
          } else {
            const numAttempt = Number(cleanPrice);
            if (!isNaN(numAttempt) && numAttempt !== 0) {
              cleanPrice = numAttempt;
            }
          }
          
          // Final check - if still invalid, use 0 as last resort
          if (typeof cleanPrice !== 'number' || isNaN(cleanPrice)) {
            console.error('CRITICAL: Could not extract valid price, defaulting to 0:', asset.currentPrice);
            cleanPrice = 0;
          }
        }
        
        return {
          ...asset,
          currentPrice: cleanPrice
        };
      }) || []
    };
    
    console.log('Final payload to send:', JSON.stringify(verifyPayload, null, 2));
    console.log('Final currentPrice check:', {
      currentPrice: verifyPayload.assets[0]?.currentPrice,
      type: typeof verifyPayload.assets[0]?.currentPrice
    });
    
    const response = await apiFetch('/api/portfolio', {
      method: 'POST',
      body: verifyPayload
    });
    return {
      status: response.status || 'success',
      data: response.data,
      message: response.message
    };
  } catch (error: any) {
    console.error('Error creating portfolio asset:', error);
    return {
      status: 'error',
      message: error?.message || 'Failed to create portfolio asset'
    };
  }
}

export interface AssetToAddPayload {
  assetId: string;
  symbol: string;
  type: 'crypto' | 'stock' | 'commodity' | 'forex';
  amount: number;
  costBasis: number;
  currentPrice: number;
  value: number;
  profit: number;
  profitPercentage: number;
  allocation: number;
}

// New endpoint - Add asset to existing portfolio
export async function addAssetToPortfolio(assetData: AssetToAddPayload): Promise<{ status: string; data?: any; message?: string }> {
  try {
    console.log('Adding asset to portfolio:', JSON.stringify(assetData, null, 2));
    
    // Validate numeric fields
    const numericFields = ['amount', 'costBasis', 'currentPrice', 'value', 'profit', 'profitPercentage', 'allocation'];
    numericFields.forEach(field => {
      if (typeof assetData[field as keyof AssetToAddPayload] === 'object' && assetData[field as keyof AssetToAddPayload] !== null) {
        throw new Error(`Field ${field} must be a number, not an object`);
      }
      if (typeof assetData[field as keyof AssetToAddPayload] !== 'number' || isNaN(assetData[field as keyof AssetToAddPayload] as number)) {
        throw new Error(`Field ${field} is not a valid number: ${assetData[field as keyof AssetToAddPayload]}`);
      }
    });
    
    const response = await apiFetch('/api/portfolio/assets', {
      method: 'POST',
      body: assetData
    });
    
    return {
      status: response.status || 'success',
      data: response.data,
      message: response.message
    };
  } catch (error: any) {
    console.error('Error adding asset to portfolio:', error);
    return {
      status: 'error',
      message: error?.message || 'Failed to add asset to portfolio'
    };
  }
}