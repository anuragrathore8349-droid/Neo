import { apiFetch } from './api';

interface OrderPayload {
  symbol:      string;
  exchange:    string;
  type:        'market' | 'limit' | 'stop' | 'stop_limit';
  side:        'buy' | 'sell';
  amount:      number;
  price?:      number;
  stopPrice?:  number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  postOnly?:   boolean;
  reduceOnly?: boolean;
  mode?:       'paper' | 'live';
  stopLoss?:   { price: number; triggerType?: 'mark' | 'last' | 'index' };
  takeProfit?: { price: number; triggerType?: 'mark' | 'last' | 'index' };
}

interface PaperTradePayload {
  symbol:  string;
  side:    'buy' | 'sell';
  amount:  number;
  price?:  number;
  type?:   'market' | 'limit';
}

// ── Market data ──────────────────────────────────────────────────────────────

export async function getOrderBook(symbol: string, limit = 50) {
  const raw = await apiFetch(
    `/api/trading/orderbook?symbol=${encodeURIComponent(symbol)}&limit=${limit}`
  );
  // Controller wraps result as { status, data: { asks, bids } }
  // Always normalise so callers get { data: { asks, bids } }
  return { data: (raw as any)?.data ?? raw };
}

export async function getRecentTrades(symbol: string, limit = 50) {
  return apiFetch(
    `/api/trading/trades?symbol=${encodeURIComponent(symbol)}&limit=${limit}`
  );
}

// ── Real trading ─────────────────────────────────────────────────────────────

export async function getOpenOrders(symbol?: string) {
  const q = symbol ? `?symbol=${encodeURIComponent(symbol)}` : '';
  return apiFetch(`/api/trading/orders${q}`);
}

export async function getOrderHistory(
  symbol?: string, from?: string, to?: string, limit = 50
) {
  const p = new URLSearchParams();
  if (symbol) p.append('symbol', symbol);
  if (from)   p.append('from',   from);
  if (to)     p.append('to',     to);
  p.append('limit', String(limit));
  return apiFetch(`/api/trading/orders/history?${p.toString()}`);
}

export async function placeOrder(order: OrderPayload) {
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
      mode:        order.mode        || 'live',
      stopLoss:    order.stopLoss,
      takeProfit:  order.takeProfit,
    },
  });
}

export async function cancelOrder(orderId: string) {
  return apiFetch(`/api/trading/orders/${encodeURIComponent(orderId)}`, {
    method: 'DELETE',
  });
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