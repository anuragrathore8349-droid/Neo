// client/src/services/trading.service.ts
import { apiFetch } from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrderPayload {
  symbol:       string;
  exchange:     string;
  type:         'market' | 'limit' | 'stop' | 'stop_limit';
  side:         'buy' | 'sell';
  amount:       number;
  price?:       number;
  stopPrice?:   number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  postOnly?:    boolean;
  reduceOnly?:  boolean;
  mode?:        'paper' | 'live';
  stopLoss?:    { price: number; triggerType?: 'mark' | 'last' | 'index' };
  takeProfit?:  { price: number; triggerType?: 'mark' | 'last' | 'index' };
}

export interface PaperTradePayload {
  symbol:  string;
  side:    'buy' | 'sell';
  amount:  number;
  price?:  number;
  type?:   'market' | 'limit';
}

// ── Market data ───────────────────────────────────────────────────────────────

export async function getOrderBook(symbol: string, limit = 20) {
  const res = await apiFetch(`/api/trading/orderbook?symbol=${encodeURIComponent(symbol)}&limit=${limit}`);
  return { status: res.status || 'success', data: res.data || { asks: [], bids: [] } };
}

export async function getRecentTrades(symbol: string, limit = 50) {
  const res = await apiFetch(`/api/trading/trades?symbol=${encodeURIComponent(symbol)}&limit=${limit}`);
  return { status: res.status || 'success', data: res.data || [] };
}

// ── Order placement — routes to paper or live endpoint ───────────────────────

export async function placeOrder(order: OrderPayload) {
  if (order.mode === 'paper' || order.exchange === 'paper') {
    // Paper trade
    return apiFetch('/api/trading/paper/trades', {
      method: 'POST',
      body: {
        symbol: order.symbol,
        side:   order.side,
        amount: order.amount,
        price:  order.price,
        type:   order.type === 'market' ? 'market' : 'limit',
      } as PaperTradePayload,
    });
  }

  // Live trade
  return apiFetch('/api/trading/orders', {
    method: 'POST',
    body: {
      symbol:      order.symbol,
      exchange:    order.exchange,
      type:        order.type,
      side:        order.side,
      amount:      order.amount,
      price:       order.price,
      stopPrice:   order.stopPrice,
      timeInForce: order.timeInForce || 'GTC',
      postOnly:    order.postOnly    || false,
      reduceOnly:  order.reduceOnly  || false,
      mode:        'live',
      stopLoss:    order.stopLoss,
      takeProfit:  order.takeProfit,
    },
  });
}

export async function cancelOrder(orderId: string) {
  return apiFetch(`/api/trading/orders/${encodeURIComponent(orderId)}`, { method: 'DELETE' });
}

// ── Open orders / history ─────────────────────────────────────────────────────

export async function getOpenOrders(symbol?: string) {
  const q = symbol ? `?symbol=${encodeURIComponent(symbol)}` : '';
  return apiFetch(`/api/trading/orders${q}`);
}

export async function getOrderHistory(symbol?: string, from?: string, to?: string, limit = 50) {
  const p = new URLSearchParams();
  if (symbol) p.append('symbol', symbol);
  if (from)   p.append('from',   from);
  if (to)     p.append('to',     to);
  p.append('limit', String(limit));
  return apiFetch(`/api/trading/orders/history?${p.toString()}`);
}

// ── Paper trading ─────────────────────────────────────────────────────────────

export async function initializePaperAccount() {
  return apiFetch('/api/trading/paper/init', { method: 'POST' });
}

export async function placePaperTrade(trade: PaperTradePayload) {
  return apiFetch('/api/trading/paper/trades', { method: 'POST', body: trade });
}

export async function getPaperPortfolio() {
  return apiFetch('/api/trading/paper/portfolio');
}

export async function getPaperTradeHistory(symbol?: string, limit = 50) {
  const p = new URLSearchParams();
  if (symbol) p.append('symbol', symbol);
  p.append('limit', String(limit));
  return apiFetch(`/api/trading/paper/history?${p.toString()}`);
}

export async function resetPaperAccount() {
  return apiFetch('/api/trading/paper/reset', { method: 'POST' });
}

export async function closePaperAccount() {
  return apiFetch('/api/trading/paper/close', { method: 'POST' });
}

// ── API Key Management ────────────────────────────────────────────────────────

export async function getApiKeys() {
  return apiFetch('/api/trading/api-keys');
}

export async function addApiKey(payload: {
  exchange: string; apiKey: string; apiSecret: string; passphrase?: string; label?: string;
}) {
  return apiFetch('/api/trading/api-keys', { method: 'POST', body: payload });
}

export async function deleteApiKey(id: string) {
  return apiFetch(`/api/trading/api-keys/${id}`, { method: 'DELETE' });
}

export async function testApiKey(id: string) {
  return apiFetch(`/api/trading/api-keys/${id}/test`, { method: 'POST' });
}