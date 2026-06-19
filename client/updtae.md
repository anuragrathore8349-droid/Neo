bash

cat > /home/claude/trading_fix_plan_v2.md << 'ENDOFFILE'
# 🚀 Trading System — Production Fix Plan v2
## Complete Second-Pass: Everything Not Covered in Plan v1

> **Assumption**: All 18 fixes from Plan v1 are already applied.
> **Goal**: 100% production-ready — zero dummy data, zero broken methods, zero missing features.
> Every single remaining issue is documented here with exact file paths and complete replacement code.

---

## Table of Contents

### Backend Fixes
1. [market_service.js — 6 missing methods (watchlist + alerts)](#1-market_servicejs--6-missing-methods-watchlist--alerts)
2. [market_service.js — fetchStockHistory crashes when from/to are undefined](#2-market_servicejs--fetchstockhistory-crashes-when-fromto-are-undefined)
3. [market_service.js — fetchCryptoDetails throws intentionally (details route broken)](#3-market_servicejs--fetchcryptodetails-throws-intentionally)
4. [market_service.js — searchCryptoAssets always returns empty array](#4-market_servicejs--searchcryptoassets-always-returns-empty-array)
5. [market_service.js — fetchTrendingCrypto always returns empty array](#5-market_servicejs--fetchtrendingcrypto-always-returns-empty)
6. [market_controller.js — getMarketSummary still has hardcoded fallback prices + hardcoded btcDominance](#6-market_controllerjs--getmarketsummary-hardcoded-fallback--btcdominance)
7. [trading_service.js — normalizeSymbolForExchange uses flat exchange map (same bug as cancelOrder)](#7-trading_servicejs--normalizesymbolforexchange-uses-flat-exchange-map)
8. [trading_service.js — getOpenOrders N+1 problem: syncOrderStatus called inline for every order](#8-trading_servicejs--getopenorders-n1-problem)
9. [paper-trading.service.js — P&L percentage double-counts investedAmount](#9-paper-tradingservicejs--pl-percentage-double-counts-investedamount)
10. [paper-trading.service.js — fallback log says "CoinGecko" (wrong service name)](#10-paper-tradingservicejs--fallback-log-says-coingecko)
11. [wallet_service.js — uses ethers v5 API (ethers.utils) but blockchain.js uses ethers v6](#11-wallet_servicejs--ethers-v5-vs-v6-conflict)
12. [wallet_service.js — console.log statements throughout production code](#12-wallet_servicejs--consolelog-in-production-code)
13. [marketData_job.js — scheduleMarketDataUpdates adds duplicate repeat jobs on restart](#13-marketdata_jobjs--duplicate-repeat-jobs-on-restart)
14. [NEW FILE: models/watchlist.model.js — imported by market_service but doesn't exist](#14-new-file-modelswatchlistmodeljs--missing)

### Frontend Fixes
15. [trading.service.ts — cancelOrder function missing entirely](#15-trading_servicets--cancelorder-missing)
16. [trading.service.ts — placeOrder doesn't forward mode/stopLoss/takeProfit fields](#16-trading_servicets--placeorder-missing-fields)
17. [index.tsx (trading page) — complete rewrite: missing WebSocket, open orders, balance, paper mode, cancel, TradingView](#17-indextsx--complete-rewrite)
18. [market.service.ts — missing getPriceAlerts / createAlert / deleteAlert / watchlist functions](#18-market_servicets--missing-frontend-api-functions)
19. [OrderBook.tsx — asks should render in reverse order (lowest ask nearest spread)](#19-orderbooktsx--asks-wrong-order)
20. [NEW FILE: hooks/useMarketSocket.ts — already in plan v1, add to package.json dependency note](#20-packagejson--add-socketio-client)
21. [NEW COMPONENT: PriceAlerts.tsx — complete alerts UI (backend exists, no frontend)](#21-new-component-pricealertstsx)

---

## 1. `market_service.js` — 6 missing methods (watchlist + alerts)

**Problem**: `market_controller.js` calls `marketService.getWatchlist()`, `addToWatchlist()`, `removeFromWatchlist()`, `createPriceAlert()`, `getPriceAlerts()`, `deletePriceAlert()` — **none of these exist in `market_service.js`**. Every single one of those routes throws `TypeError: marketService.X is not a function` at runtime.

**File**: `src/services/market.service.js`

**Add the following 6 methods inside the `MarketService` class, before the closing `}`:**

```js
// ============================================================
// WATCHLIST METHODS — Add all 3 inside the MarketService class
// ============================================================

async getWatchlist(userId) {
  try {
    const watchlist = await Watchlist.findOne({ userId });
    if (!watchlist) return [];
    return watchlist.symbols || [];
  } catch (error) {
    logger.error('Error fetching watchlist:', error);
    throw error;
  }
}

async addToWatchlist(userId, symbol) {
  try {
    const upper = symbol.toUpperCase();
    let watchlist = await Watchlist.findOne({ userId });
    if (!watchlist) {
      watchlist = new Watchlist({ userId, symbols: [upper] });
    } else {
      if (!watchlist.symbols.includes(upper)) {
        watchlist.symbols.push(upper);
      }
    }
    await watchlist.save();
    return watchlist.symbols;
  } catch (error) {
    logger.error('Error adding to watchlist:', error);
    throw error;
  }
}

async removeFromWatchlist(userId, symbol) {
  try {
    const upper = symbol.toUpperCase();
    const watchlist = await Watchlist.findOne({ userId });
    if (!watchlist) return;
    watchlist.symbols = watchlist.symbols.filter(s => s !== upper);
    await watchlist.save();
    return watchlist.symbols;
  } catch (error) {
    logger.error('Error removing from watchlist:', error);
    throw error;
  }
}

// ============================================================
// PRICE ALERT METHODS — Add all 3 inside the MarketService class
// ============================================================

async createPriceAlert(userId, alertData) {
  try {
    const alert = new MarketAlert({
      userId,
      symbol: alertData.symbol.toUpperCase(),
      type: alertData.type,
      price: alertData.price,
      notificationTypes: alertData.notificationTypes || ['email'],
      isTriggered: false,
    });
    await alert.save();
    return alert;
  } catch (error) {
    logger.error('Error creating price alert:', error);
    throw error;
  }
}

async getPriceAlerts(userId) {
  try {
    return await MarketAlert.find({ userId, isTriggered: false })
      .sort({ createdAt: -1 });
  } catch (error) {
    logger.error('Error fetching price alerts:', error);
    throw error;
  }
}

async deletePriceAlert(userId, alertId) {
  try {
    const result = await MarketAlert.findOneAndDelete({ _id: alertId, userId });
    if (!result) throw new Error('Alert not found');
    return result;
  } catch (error) {
    logger.error('Error deleting price alert:', error);
    throw error;
  }
}
```

---

## 2. `market_service.js` — `fetchStockHistory` crashes when `from`/`to` are undefined

**Problem**: `fetchStockHistory` passes `from` and `to` directly to `new Date(undefined)` — produces `Invalid Date` which crashes `yahooFinance.historical()`. This happens any time `from`/`to` are not provided in the request.

**File**: `src/services/market.service.js`

**Find and replace:**

```js
// ❌ BROKEN:
  async fetchStockHistory(symbol, interval, from, to) {
    try {
      const queryOptions = {
        period1: new Date(from),
        period2: new Date(to),
        interval: this.convertIntervalForYahoo(interval)
      };
```

```js
// ✅ FIXED — provide safe defaults:
  async fetchStockHistory(symbol, interval, from, to) {
    try {
      // Default: last 90 days if not specified
      const toDate = to ? new Date(to) : new Date();
      const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 90 * 24 * 60 * 60 * 1000);

      const queryOptions = {
        period1: fromDate,
        period2: toDate,
        interval: this.convertIntervalForYahoo(interval)
      };
```

---

## 3. `market_service.js` — `fetchCryptoDetails` throws intentionally

**Problem**: `fetchCryptoDetails` throws `new Error('fetchCryptoDetails removed...')`. The `GET /api/market/details/:symbol` route always returns 500 for any crypto symbol. Needs a real implementation using Kraken data.

**File**: `src/services/market.service.js`

**Find and replace:**

```js
// ❌ BROKEN:
  async fetchCryptoDetails(symbol) {
    throw new Error('fetchCryptoDetails removed: CoinGecko integration removed; use Kraken or internal details');
  }
```

```js
// ✅ FIXED — build details from Kraken live price + OHLC:
  async fetchCryptoDetails(symbol) {
    try {
      // Fetch live price and recent history in parallel from Kraken
      const [priceData, history] = await Promise.allSettled([
        krakenService.getLivePrice(symbol),
        krakenService.getHistoricalData(symbol, '1d', null)
      ]);

      const price = priceData.status === 'fulfilled' ? priceData.value : null;
      const candles = history.status === 'fulfilled' ? history.value : [];

      // Compute 52-week high/low from daily candles
      const highs = candles.map(c => c.high).filter(Boolean);
      const lows = candles.map(c => c.low).filter(Boolean);

      return {
        symbol: symbol.toUpperCase(),
        name: symbol.toUpperCase(),
        type: 'crypto',
        source: 'kraken',
        marketData: {
          currentPrice: price?.price ?? null,
          change24h: price?.change24h ?? null,
          volume24h: price?.volume24h ?? null,
          high24h: price?.high24h ?? null,
          low24h: price?.low24h ?? null,
          high52w: highs.length > 0 ? Math.max(...highs) : null,
          low52w: lows.length > 0 ? Math.min(...lows) : null,
          lastUpdated: price?.lastUpdated ?? new Date().toISOString(),
        }
      };
    } catch (error) {
      logger.error(`Error fetching crypto details for ${symbol}:`, error.message);
      throw error;
    }
  }
```

---

## 4. `market_service.js` — `searchCryptoAssets` always returns `[]`

**Problem**: `searchCryptoAssets` returns an empty array unconditionally. The entire `/api/market/search` endpoint is broken for crypto.

**File**: `src/services/market.service.js`

**Find and replace:**

```js
// ❌ BROKEN:
  async searchCryptoAssets(query) {
    logger.warn('searchCryptoAssets: CoinGecko removed; returning empty result');
    return [];
  }
```

```js
// ✅ FIXED — search against Kraken's known symbol map:
  async searchCryptoAssets(query) {
    try {
      if (!query || query.length < 1) return [];

      const q = query.toUpperCase();

      // All symbols Kraken supports (from kraken.service.js symbolMap + common extras)
      const knownCryptoSymbols = [
        'BTC','ETH','SOL','XRP','ADA','DOGE','DOT','MATIC','LINK','AVAX',
        'LTC','USDT','USDC','BNB','XLM','TRX','ETC','UNI','ALGO','ICP',
        'NEAR','ATOM','ARB','OP','APT','SUI','PEPE','MKR','AAVE','SNX',
        'CRV','COMP','YFI','SUSHI','BAL','REN','KNC','ZRX','BAT','ENJ',
        'MANA','SAND','AXS','CHZ','FLOW','HBAR','VET','THETA','FTM','RUNE'
      ];

      const nameMap: Record<string, string> = {
        'BTC': 'Bitcoin', 'ETH': 'Ethereum', 'SOL': 'Solana', 'XRP': 'Ripple',
        'ADA': 'Cardano', 'DOGE': 'Dogecoin', 'DOT': 'Polkadot', 'MATIC': 'Polygon',
        'LINK': 'Chainlink', 'AVAX': 'Avalanche', 'LTC': 'Litecoin', 'USDT': 'Tether',
        'USDC': 'USD Coin', 'BNB': 'Binance Coin', 'XLM': 'Stellar', 'TRX': 'TRON',
        'ETC': 'Ethereum Classic', 'UNI': 'Uniswap', 'ALGO': 'Algorand',
        'ICP': 'Internet Computer', 'NEAR': 'NEAR Protocol', 'ATOM': 'Cosmos',
        'ARB': 'Arbitrum', 'OP': 'Optimism', 'APT': 'Aptos', 'SUI': 'Sui',
        'PEPE': 'Pepe', 'MKR': 'Maker', 'AAVE': 'Aave'
      };

      return knownCryptoSymbols
        .filter(sym =>
          sym.includes(q) || (nameMap[sym] || '').toUpperCase().includes(q)
        )
        .slice(0, 20)
        .map(sym => ({
          symbol: sym,
          name: nameMap[sym] || sym,
          type: 'crypto',
          source: 'kraken'
        }));
    } catch (error) {
      logger.error('Error searching crypto assets:', error);
      return [];
    }
  }
```

---

## 5. `market_service.js` — `fetchTrendingCrypto` always returns `[]`

**Problem**: `fetchTrendingCrypto` always returns an empty array. The trending crypto section shows nothing.

**File**: `src/services/market.service.js`

**Find and replace:**

```js
// ❌ BROKEN:
  async fetchTrendingCrypto() {
    logger.warn('fetchTrendingCrypto: CoinGecko removed; returning empty trending list');
    return [];
  }
```

```js
// ✅ FIXED — use Kraken to fetch top assets by volume and calculate trend:
  async fetchTrendingCrypto() {
    try {
      const topSymbols = ['BTC','ETH','SOL','XRP','ADA','AVAX','DOGE','MATIC','LINK','DOT'];
      const prices = await krakenService.getLivePrices(topSymbols);

      return topSymbols
        .map(symbol => {
          const data = prices[symbol];
          if (!data || data.price === null) return null;
          return {
            symbol,
            name: symbol,
            type: 'crypto',
            price: data.price,
            change24h: data.change24h ?? 0,
            volume24h: data.volume24h ?? 0,
            source: 'kraken'
          };
        })
        .filter(Boolean)
        // Sort by absolute 24h change (most volatile = trending)
        .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
        .slice(0, 10);
    } catch (error) {
      logger.error('Error fetching trending crypto:', error);
      return [];
    }
  }
```

---

## 6. `market_controller.js` — `getMarketSummary` hardcoded fallback + hardcoded `btcDominance`

**Problem**: `getMarketSummary` still has a massive hardcoded fallback price object AND `btcDominance: 42.8` is permanently hardcoded. Plan v1 only removed the fallback from `getMarketAssets`.

**File**: `src/api/controllers/market.controller.js`

**Find and replace the catch block inside `getMarketSummary`:**

```js
// ❌ BROKEN — hardcoded fallback inside getMarketSummary:
      } catch (error) {
        logger.warn('Failed to fetch live prices for market summary, using fallback data:', error.message);
        // Fallback data for testing
        prices = {
          'BTC': { price: 45000, change24h: 2.5, ... },
          ...
        };
      }
```

```js
// ✅ FIXED — fail with 503, no fake data:
      } catch (error) {
        logger.error('Failed to fetch live prices for market summary:', error.message);
        return res.status(503).json({
          status: 'error',
          message: 'Market summary temporarily unavailable.',
          code: 'MARKET_DATA_UNAVAILABLE'
        });
      }
```

**Also find and replace the hardcoded `btcDominance` line:**

```js
// ❌ BROKEN:
        btcDominance: 42.8, // This would need a separate calculation or API call
```

```js
// ✅ FIXED — calculate BTC dominance from the prices we already have:
        btcDominance: totalMarketCap > 0
          ? parseFloat(((prices['BTC']?.marketCap || 0) / totalMarketCap * 100).toFixed(1))
          : 0,
```

---

## 7. `trading_service.js` — `normalizeSymbolForExchange` uses flat exchange map

**Problem**: `normalizeSymbolForExchange` does `this.exchanges[exchangeId]` but the map is `this.exchanges.public[id]` / `this.exchanges.private[id]`. Result: `exchange` is always `undefined`, markets are never loaded, symbol normalization silently fails every time.

**File**: `src/services/trading.service.js`

**Find and replace:**

```js
// ❌ BROKEN inside normalizeSymbolForExchange:
    const exchange = this.exchanges[exchangeId];
    if (!exchange) {
      return normalized;
    }
```

```js
// ✅ FIXED:
    const exchange = this.exchanges.public[exchangeId] || this.exchanges.private[exchangeId];
    if (!exchange) {
      return normalized;
    }
```

---

## 8. `trading_service.js` — `getOpenOrders` N+1 problem

**Problem**: `getOpenOrders` calls `this.syncOrderStatus(order)` for every open order via `Promise.all`. If a user has 20 open orders, this fires 20 exchange API calls on every GET request. This will hit rate limits immediately in production.

**File**: `src/services/trading.service.js`

**Find and replace:**

```js
// ❌ BROKEN — N+1 exchange API calls on every request:
  async getOpenOrders(userId, symbol = null) {
    try {
      const query = {
        userId,
        status: { $in: ['open', 'partially_filled', 'partially-filled'] }
      };

      if (symbol) {
        query.symbol = symbol;
      }

      const orders = await Order.find(query).sort({ createdAt: -1 });

      // Update order statuses from exchange
      const updatedOrders = await Promise.all(
        orders.map(order => this.syncOrderStatus(order))
      );

      return updatedOrders;
    } catch (error) {
      logger.error('Error fetching open orders:', error);
      throw error;
    }
  }
```

```js
// ✅ FIXED — return DB state immediately; sync happens via Bull queue job only:
  async getOpenOrders(userId, symbol = null) {
    try {
      const query = {
        userId,
        status: { $in: ['open', 'partially_filled', 'partially-filled'] }
      };

      if (symbol) {
        query.symbol = symbol;
      }

      // Return current DB state — syncOrderStatus is handled asynchronously
      // by the orderSync Bull job, not inline on every GET request.
      return await Order.find(query).sort({ createdAt: -1 });
    } catch (error) {
      logger.error('Error fetching open orders:', error);
      throw error;
    }
  }
```

---

## 9. `paper-trading.service.js` — P&L percentage double-counts `investedAmount`

**Problem**: The `profitLossPercentage` denominator is:
```js
const totalInvested = portfolio.holdings.reduce(...h.quantity * h.avgPrice) + portfolio.investedAmount;
```
`portfolio.investedAmount` already includes the cost of all holdings. Adding holdings cost again produces a denominator roughly 2x too large, making the percentage always half of what it should be.

**File**: `src/services/paper-trading.service.js`

**Find and replace (appears twice — once in `placePaperTrade`, once in `getPaperPortfolio`):**

```js
// ❌ BROKEN (both occurrences):
      const totalInvested = portfolio.holdings.reduce((sum, h) => sum + (h.quantity * h.avgPrice), 0) + 
                           portfolio.investedAmount;
      portfolio.profitLossPercentage = totalInvested > 0 ? (portfolio.profitLoss / totalInvested) * 100 : 0;
```

```js
// ✅ FIXED — use INITIAL_BALANCE as the baseline (consistent and correct):
      portfolio.profitLossPercentage = this.INITIAL_BALANCE > 0
        ? (portfolio.profitLoss / this.INITIAL_BALANCE) * 100
        : 0;
```

---

## 10. `paper-trading.service.js` — fallback log says "CoinGecko"

**Problem**: Two places log `"falling back to CoinGecko"` but actually call `marketService.getLivePrices`. Misleading in logs — will cause confusion when debugging production issues.

**File**: `src/services/paper-trading.service.js`

**Find and replace (both occurrences):**

```js
// ❌ BROKEN — occurrence 1:
          logger.warn(`Kraken failed for ${symbol}, falling back to CoinGecko`, krakenError.message);
          const prices = await marketService.getLivePrices([symbol]);
```

```js
// ✅ FIXED:
          logger.warn(`Kraken failed for ${symbol}, falling back to marketService`, krakenError.message);
          const prices = await marketService.getLivePrices([symbol]);
```

```js
// ❌ BROKEN — occurrence 2:
        logger.warn('Kraken failed, falling back to CoinGecko');
        prices = await marketService.getLivePrices(symbols);
```

```js
// ✅ FIXED:
        logger.warn('Kraken failed for portfolio prices, falling back to marketService');
        prices = await marketService.getLivePrices(symbols);
```

---

## 11. `wallet_service.js` — ethers v5 API vs v6 conflict

**Problem**: `wallet_service.js` uses `ethers.utils.getAddress()`, `ethers.utils.verifyMessage()`, `ethers.utils.formatEther()` — these are **ethers v5** APIs. But `blockchain.js` uses `ethers.parseUnits()` (v6 API) and has a comment explicitly saying "ethers v6". Both files import from the same `ethers` package. One of them is wrong and will crash.

**Decision**: Standardize on ethers v6 throughout (since `blockchain.js` is already v6).

**File**: `src/services/wallet_service.js`

**Find and replace all three ethers.utils calls:**

```js
// ❌ BROKEN — verifyWalletOwnership (ethers v5):
    const normalizedAddress = ethers.utils.getAddress(address);
    const message = `Connect wallet ${normalizedAddress} to NeoFin`;
    const signerAddress = ethers.utils.verifyMessage(message, signature);
```

```js
// ✅ FIXED — ethers v6:
    const normalizedAddress = ethers.getAddress(address);
    const message = `Connect wallet ${normalizedAddress} to NeoFin`;
    const signerAddress = ethers.verifyMessage(message, signature);
```

```js
// ❌ BROKEN — updateDefiWalletBalances (ethers v5):
        amount: ethers.utils.formatEther(balance),
```

```js
// ✅ FIXED — ethers v6 (appears twice, in updateDefiWalletBalances AND updateExternalWalletBalances):
        amount: ethers.formatEther(balance),
```

---

## 12. `wallet_service.js` — `console.log` in production code

**Problem**: 12 `console.log` / `console.error` calls scattered through `wallet_service.js`. These leak sensitive data (wallet addresses, signatures) in production logs and bypass the structured logger.

**File**: `src/services/wallet_service.js`

**Find and replace every `console.log` / `console.error` with `logger` equivalents:**

```js
// ❌ REMOVE these lines entirely (lines 40-41, 75, 79, 235, 382-385, 389, 392-395, 399, 404):
      console.log('🔗 Connecting wallet for user:', userId);
      console.log('  Wallet data:', { ...walletData, signature: '...' });
      console.log('✅ Wallet connected successfully:', wallet.address, 'on network:', wallet.network);
      console.error('🔴 Connect wallet error:', error.message);
      console.log('FINAL TRANSACTIONS:', transactions.length, 'paginated:', paginatedTransactions.length);
      console.log('🔐 Verifying wallet ownership:');
      console.log('  Backend message:', message);
      console.log('  Signature:', signature);
      console.log('  Expected address:', normalizedAddress);
      console.log('  Recovered address:', signerAddress);
      console.log('❌ Address mismatch:', { expected, received });
      console.log('✅ Signature verified successfully');
      console.error('🔴 Wallet verification error:', error.message);
```

```js
// ✅ REPLACE WITH logger calls:
      logger.info(`Connecting wallet for user: ${userId}`);
      logger.debug(`Wallet data: address=${walletData.address}, type=${walletData.type}`);
      logger.info(`Wallet connected: ${wallet.address} on ${wallet.network}`);
      logger.error(`Connect wallet error: ${error.message}`);
      logger.debug(`Transactions fetched: total=${transactions.length}, paginated=${paginatedTransactions.length}`);
      logger.debug(`Verifying wallet ownership for: ${normalizedAddress}`);
      logger.debug(`Signature verified for: ${normalizedAddress}`);
      logger.warn(`Address mismatch: expected=${normalizedAddress.toLowerCase()}, received=${signerAddress.toLowerCase()}`);
      logger.info(`Wallet ownership verified: ${normalizedAddress}`);
      logger.error(`Wallet verification error: ${error.message}`);
```

---

## 13. `marketData_job.js` — duplicate repeat jobs on server restart

**Problem**: Every time the server starts and calls `scheduleMarketDataUpdates('BTC')`, Bull adds another repeat job on top of any existing ones in Redis. After 5 restarts you have 5x the update frequency. Eventually it saturates the queue.

**File**: `src/jobs/marketData_job.js`

**Find and replace `scheduleMarketDataUpdates`:**

```js
// ❌ BROKEN — adds new repeat jobs on every call without removing old ones:
const scheduleMarketDataUpdates = async (symbol) => {
  try {
    await marketDataQueue.add('orderbook', { symbol }, { repeat: { every: 5000 } });
    await marketDataQueue.add('trades', { symbol }, { repeat: { every: 10000 } });
  } catch (error) {
    logger.error('Error scheduling market data updates:', error);
    throw error;
  }
};
```

```js
// ✅ FIXED — remove existing repeat jobs first, then add fresh ones:
const scheduleMarketDataUpdates = async (symbol) => {
  try {
    // Remove any existing repeat jobs for this symbol to prevent accumulation on restart
    const repeatableJobs = await marketDataQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.name === 'orderbook' || job.name === 'trades') {
        await marketDataQueue.removeRepeatableByKey(job.key);
        logger.debug(`Removed existing repeat job: ${job.key}`);
      }
    }

    // Add fresh repeat jobs
    await marketDataQueue.add(
      'orderbook',
      { symbol },
      { repeat: { every: 5000 }, jobId: `orderbook-${symbol}` }
    );
    await marketDataQueue.add(
      'trades',
      { symbol },
      { repeat: { every: 10000 }, jobId: `trades-${symbol}` }
    );

    logger.info(`Scheduled market data updates for ${symbol}`);
  } catch (error) {
    logger.error('Error scheduling market data updates:', error);
    throw error;
  }
};
```

---

## 14. NEW FILE: `models/watchlist.model.js` — missing

**Problem**: `market_service.js` imports `const Watchlist = require('../models/watchlist.model')` but this file does not exist. Every watchlist route crashes with `Cannot find module`.

**Create new file**: `src/models/watchlist.model.js`

```js
// ✅ NEW FILE: src/models/watchlist.model.js
'use strict';
const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,   // one watchlist document per user
    index: true,
  },
  symbols: {
    type: [String],
    default: [],
    set: (arr) => arr.map(s => s.toUpperCase()), // always uppercase
  },
}, {
  timestamps: true,
});

watchlistSchema.index({ userId: 1 });

const Watchlist = mongoose.model('Watchlist', watchlistSchema);
module.exports = Watchlist;
```

---

## 15. `trading.service.ts` — `cancelOrder` missing entirely

**Problem**: `OrderHistory.tsx` (after Plan v1 fix #15) calls `tradingApi.cancelOrder(orderId)` but this function **does not exist** in `trading.service.ts`. This will be a TypeScript error and runtime crash.

**File**: `src/services/trading.service.ts`

**Add this function anywhere in the file:**

```ts
// ✅ ADD — cancel an order by ID:
export async function cancelOrder(orderId: string) {
  return apiFetch(`/api/trading/orders/${encodeURIComponent(orderId)}`, {
    method: 'DELETE'
  });
}
```

---

## 16. `trading.service.ts` — `placeOrder` missing `mode`, `stopLoss`, `takeProfit` fields

**Problem**: After Plan v1 fixes, `TradeForm.tsx` now sends `mode`, `stopLoss`, and `takeProfit` in the order object. But the `OrderPayload` interface in `trading.service.ts` doesn't include these fields, so TypeScript strips them before the API call.

**File**: `src/services/trading.service.ts`

**Find and replace the `OrderPayload` interface:**

```ts
// ❌ CURRENT — missing fields:
interface OrderPayload {
  symbol: string;
  exchange: string;
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  postOnly?: boolean;
  reduceOnly?: boolean;
  mode?: 'paper' | 'live';
}
```

```ts
// ✅ FIXED — add all fields:
interface OrderPayload {
  symbol: string;
  exchange: string;
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  postOnly?: boolean;
  reduceOnly?: boolean;
  mode?: 'paper' | 'live';
  stopLoss?: {
    price: number;
    triggerType?: 'mark' | 'last' | 'index';
  };
  takeProfit?: {
    price: number;
    triggerType?: 'mark' | 'last' | 'index';
  };
}
```

---

## 17. `index.tsx` — complete rewrite (trading page orchestrator)

**Problem**: The current `index.tsx` is missing all of the following which were built in Plan v1:
- No WebSocket price subscription (`useMarketSocket`)
- No open orders state or display (only `orderHistory`)
- No `availableBalance` or `availableAssetAmount` passed to `TradeForm`
- No `paperMode` toggle or state
- Watchlist toggle never calls the backend API
- `handlePlaceOrder` doesn't forward `mode`, `stopLoss`, `takeProfit`
- Uses `TradingView` component is not used (Plan v1 built it but index still uses raw components)
- No cancel order wiring
- Assets never auto-refresh (only fetch once)
- No `onIntervalChange` passed to `MarketChart`

**File**: `src/pages/trading/index.tsx`

**Replace entire file:**

```tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/common/Tabs';
import GlassCard from '../../components/common/GlassCard';
import MarketOverview from '../../components/trading/MarketOverview';
import MarketChart from '../../components/trading/MarketChart';
import OrderBook from '../../components/trading/OrderBook';
import TradeForm from '../../components/trading/TradeForm';
import OrderHistory from '../../components/trading/OrderHistory';
import Watchlist from '../../components/trading/Watchlist';
import DepositModal from '../../components/trading/DepositModal';
import PriceAlerts from '../../components/trading/PriceAlerts';
import { useMarketSocket } from '../../hooks/useMarketSocket';
import * as tradingApi from '../../services/trading.service';
import * as marketApi from '../../services/market.service';
import { Asset } from '../../types';
import { Search, Star, Filter, ArrowUpDown, Loader, RefreshCw } from 'lucide-react';

const ASSET_REFRESH_INTERVAL = 30000; // 30 seconds
const ORDER_REFRESH_INTERVAL = 15000; // 15 seconds

const Trading: React.FC = () => {
  const [activeTab, setActiveTab] = useState('market');
  const [searchTerm, setSearchTerm] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [orderBookData, setOrderBookData] = useState<{ asks: any[]; bids: any[] }>({ asks: [], bids: [] });
  const [chartData, setChartData] = useState<any[]>([]);
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [isAssetsLoading, setIsAssetsLoading] = useState(false);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isPaperMode, setIsPaperMode] = useState(false);
  const [chartInterval, setChartInterval] = useState('1d');
  const [portfolio, setPortfolio] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // ─── Live WebSocket price updates ───────────────────────────────────────
  useMarketSocket({
    symbols: assets.map(a => a.symbol),
    enabled: assets.length > 0,
    onPriceUpdate: ({ symbol, price }) => {
      setAssets(prev =>
        prev.map(a => a.symbol === symbol ? { ...a, price } : a)
      );
      // Keep selectedAsset price in sync
      setSelectedAsset(prev =>
        prev?.symbol === symbol ? { ...prev, price } : prev
      );
    },
  });

  // ─── Fetch market assets (with periodic refresh) ─────────────────────────
  const fetchMarketAssets = useCallback(async (silent = false) => {
    if (!silent) setIsAssetsLoading(true);
    setError(null);
    try {
      const response = await marketApi.getMarketAssets();
      const marketAssets = (response.data || []) as Asset[];
      setAssets(marketAssets);

      if (!selectedAsset && marketAssets.length > 0) {
        setSelectedAsset(marketAssets[0]);
      } else if (selectedAsset) {
        const updated = marketAssets.find(a => a.symbol === selectedAsset.symbol);
        if (updated) setSelectedAsset(updated);
      }
    } catch (err: any) {
      setError('Failed to load market data. Please try again.');
      console.error('Market assets error:', err);
    } finally {
      if (!silent) setIsAssetsLoading(false);
    }
  }, [selectedAsset]);

  useEffect(() => {
    fetchMarketAssets();
    const interval = window.setInterval(() => fetchMarketAssets(true), ASSET_REFRESH_INTERVAL);
    return () => window.clearInterval(interval);
  }, []);

  // ─── Fetch watchlist from backend ────────────────────────────────────────
  const fetchWatchlist = useCallback(async () => {
    try {
      const response = await marketApi.getWatchlist();
      setWatchlist(response.data || []);
    } catch (err) {
      console.error('Watchlist fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchWatchlist();
  }, []);

  // ─── Toggle watchlist (synced to backend) ────────────────────────────────
  const toggleWatchlist = useCallback(async (symbol: string) => {
    const upper = symbol.toUpperCase();
    const isInWatchlist = watchlist.includes(upper);
    // Optimistic update
    setWatchlist(prev =>
      isInWatchlist ? prev.filter(s => s !== upper) : [...prev, upper]
    );
    try {
      if (isInWatchlist) {
        await marketApi.removeFromWatchlist(upper);
      } else {
        await marketApi.addToWatchlist(upper);
      }
    } catch (err) {
      // Rollback on failure
      setWatchlist(prev =>
        isInWatchlist ? [...prev, upper] : prev.filter(s => s !== upper)
      );
      console.error('Watchlist update error:', err);
    }
  }, [watchlist]);

  // ─── Fetch chart data ─────────────────────────────────────────────────────
  const fetchChartData = useCallback(async (symbol: string, interval: string) => {
    setIsChartLoading(true);
    try {
      const response = await marketApi.getPriceHistory(symbol, interval);
      const prices = response.data?.prices || response.data || [];
      const candles = Array.isArray(prices)
        ? prices.map((p: any) => ({
            date: new Date(p.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            open: p.open,
            close: p.close,
            high: p.high,
            low: p.low,
            volume: p.volume || 0,
          }))
        : [];
      setChartData(candles);
    } catch (err) {
      console.error('Chart data error:', err);
      setChartData([]);
    } finally {
      setIsChartLoading(false);
    }
  }, []);

  // ─── Fetch order book ─────────────────────────────────────────────────────
  const fetchOrderBook = useCallback(async (symbol: string) => {
    try {
      const response = await tradingApi.getOrderBook(symbol, 20);
      const data = (response as any).data || response;
      setOrderBookData({
        asks: data.asks || [],
        bids: data.bids || [],
      });
    } catch (err) {
      console.error('Order book error:', err);
    }
  }, []);

  // ─── Fetch orders ─────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async (symbol?: string) => {
    try {
      const [openRes, histRes] = await Promise.all([
        tradingApi.getOpenOrders(symbol),
        tradingApi.getOrderHistory(undefined, undefined, undefined, 100),
      ]);
      setOpenOrders((openRes as any).data || []);
      setOrderHistory((histRes as any).data || []);
    } catch (err) {
      console.error('Orders fetch error:', err);
    }
  }, []);

  // ─── Fetch paper portfolio ────────────────────────────────────────────────
  const fetchPortfolio = useCallback(async () => {
    if (!isPaperMode) return;
    try {
      const response = await tradingApi.getPaperPortfolio();
      setPortfolio((response as any).data);
    } catch (err) {
      console.error('Portfolio fetch error:', err);
    }
  }, [isPaperMode]);

  // ─── Load data when selected asset changes ────────────────────────────────
  useEffect(() => {
    if (!selectedAsset) return;
    fetchChartData(selectedAsset.symbol, chartInterval);
    fetchOrderBook(selectedAsset.symbol);
    fetchOrders(selectedAsset.symbol);
  }, [selectedAsset?.symbol]);

  useEffect(() => {
    if (!selectedAsset) return;
    fetchChartData(selectedAsset.symbol, chartInterval);
  }, [chartInterval]);

  // ─── Auto-refresh order book every 10s ───────────────────────────────────
  useEffect(() => {
    if (!selectedAsset) return;
    const interval = window.setInterval(() => fetchOrderBook(selectedAsset.symbol), 10000);
    return () => window.clearInterval(interval);
  }, [selectedAsset?.symbol]);

  // ─── Auto-refresh orders every 15s ────────────────────────────────────────
  useEffect(() => {
    const interval = window.setInterval(() => fetchOrders(selectedAsset?.symbol), ORDER_REFRESH_INTERVAL);
    return () => window.clearInterval(interval);
  }, [selectedAsset?.symbol]);

  useEffect(() => {
    fetchPortfolio();
  }, [isPaperMode]);

  // ─── Compute available balance for TradeForm ──────────────────────────────
  const availableBalance = isPaperMode
    ? portfolio?.balance ?? 0
    : 0; // For live trading, pull from exchange balance (extend when exchange wallet is integrated)

  const availableAssetAmount = isPaperMode && selectedAsset
    ? portfolio?.holdings?.find((h: any) => h.symbol === selectedAsset.symbol)?.quantity ?? 0
    : 0;

  // ─── Place order ──────────────────────────────────────────────────────────
  const handlePlaceOrder = useCallback(async (order: any) => {
    if (!selectedAsset) return;
    setIsOrdersLoading(true);
    try {
      const payload = {
        symbol: selectedAsset.symbol,
        exchange: isPaperMode ? 'paper' : (order.exchange || 'binance'),
        type: order.type || 'market',
        side: order.side || 'buy',
        amount: order.amount || 0,
        price: order.price,
        stopPrice: order.stopPrice,
        timeInForce: order.timeInForce || 'GTC',
        postOnly: order.postOnly || false,
        reduceOnly: order.reduceOnly || false,
        mode: isPaperMode ? 'paper' : 'live',
        ...(order.stopLoss && { stopLoss: order.stopLoss }),
        ...(order.takeProfit && { takeProfit: order.takeProfit }),
      };

      if (isPaperMode) {
        await tradingApi.placePaperTrade({
          symbol: payload.symbol,
          side: payload.side,
          amount: payload.amount,
          price: payload.price,
          type: payload.type as 'market' | 'limit',
        });
        await fetchPortfolio();
      } else {
        await tradingApi.placeOrder(payload);
      }

      // Refresh orders after a short delay (exchange processing time)
      setTimeout(() => fetchOrders(selectedAsset.symbol), 1500);
    } catch (err: any) {
      console.error('Order placement error:', err?.message);
      setError(err?.message || 'Failed to place order. Please try again.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsOrdersLoading(false);
    }
  }, [selectedAsset, isPaperMode]);

  // ─── Cancel order ─────────────────────────────────────────────────────────
  const handleCancelOrder = useCallback(async (orderId: string) => {
    try {
      await tradingApi.cancelOrder(orderId);
      await fetchOrders(selectedAsset?.symbol);
    } catch (err: any) {
      console.error('Cancel order error:', err?.message);
    }
  }, [selectedAsset?.symbol]);

  // ─── Filter assets ────────────────────────────────────────────────────────
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = searchTerm === '' ||
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = assetTypeFilter === null || asset.type === assetTypeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Trading</h2>
        <div className="flex items-center space-x-2">
          {/* Paper / Live toggle */}
          <button
            onClick={() => setIsPaperMode(!isPaperMode)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
              isPaperMode
                ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                : 'bg-dark-800 border-dark-700 text-dark-400 hover:border-primary/50'
            }`}
          >
            {isPaperMode ? '📄 Paper Mode' : '💰 Live Mode'}
          </button>
          <button onClick={() => setActiveTab('orders')} className="btn-outline">
            Order History
          </button>
          <button onClick={() => setIsDepositModalOpen(true)} className="btn-primary">
            Deposit
          </button>
        </div>
      </div>

      {/* Global error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Paper mode portfolio summary */}
      {isPaperMode && portfolio && (
        <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <GlassCard className="p-3">
            <p className="text-xs text-dark-400">Cash Balance</p>
            <p className="text-lg font-semibold">${portfolio.balance?.toFixed(2) ?? '0.00'}</p>
          </GlassCard>
          <GlassCard className="p-3">
            <p className="text-xs text-dark-400">Invested</p>
            <p className="text-lg font-semibold">${portfolio.investedAmount?.toFixed(2) ?? '0.00'}</p>
          </GlassCard>
          <GlassCard className="p-3">
            <p className="text-xs text-dark-400">P&L</p>
            <p className={`text-lg font-semibold ${(portfolio.profitLoss ?? 0) >= 0 ? 'text-secondary' : 'text-red-500'}`}>
              {(portfolio.profitLoss ?? 0) >= 0 ? '+' : ''}${portfolio.profitLoss?.toFixed(2) ?? '0.00'}
            </p>
          </GlassCard>
          <GlassCard className="p-3">
            <p className="text-xs text-dark-400">Return</p>
            <p className={`text-lg font-semibold ${(portfolio.profitLossPercentage ?? 0) >= 0 ? 'text-secondary' : 'text-red-500'}`}>
              {(portfolio.profitLossPercentage ?? 0) >= 0 ? '+' : ''}{portfolio.profitLossPercentage?.toFixed(2) ?? '0.00'}%
            </p>
          </GlassCard>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="market">Market</TabsTrigger>
          <TabsTrigger value="trade">Trade</TabsTrigger>
          <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        {/* ── Market Overview ── */}
        <TabsContent value="market" className="pt-6">
          <MarketOverview
            assets={assets}
            watchlist={watchlist}
            onToggleWatchlist={toggleWatchlist}
          />
        </TabsContent>

        {/* ── Trade ── */}
        <TabsContent value="trade" className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Asset list */}
            <div className="lg:col-span-1">
              <GlassCard className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold">Assets</h3>
                  <button
                    onClick={() => fetchMarketAssets()}
                    className="p-1 rounded text-dark-400 hover:text-light"
                    title="Refresh"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="input-field pl-8 w-full text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
                  {['All','Crypto','Stock','Forex'].map(f => (
                    <button
                      key={f}
                      className={`px-2 py-1 text-xs rounded whitespace-nowrap ${
                        (f === 'All' ? assetTypeFilter === null : assetTypeFilter === f.toLowerCase())
                          ? 'bg-primary text-white'
                          : 'bg-dark-800 text-dark-400'
                      }`}
                      onClick={() => setAssetTypeFilter(f === 'All' ? null : f.toLowerCase())}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="max-h-[480px] overflow-y-auto space-y-1">
                  {isAssetsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader size={18} className="animate-spin text-primary mr-2" />
                      <span className="text-dark-400 text-sm">Loading...</span>
                    </div>
                  ) : filteredAssets.map(asset => (
                    <div
                      key={asset.id}
                      onClick={() => { setSelectedAsset(asset); setActiveTab('trade'); }}
                      className={`flex justify-between items-center p-2 rounded-lg cursor-pointer transition-all ${
                        selectedAsset?.id === asset.id
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-dark-800/70'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-dark-700 flex items-center justify-center text-xs font-medium">
                          {asset.symbol.substring(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-sm">{asset.symbol}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleWatchlist(asset.symbol); }}
                              className="text-dark-400 hover:text-amber-400"
                            >
                              <Star
                                size={11}
                                className={watchlist.includes(asset.symbol) ? 'text-amber-400 fill-amber-400' : ''}
                              />
                            </button>
                          </div>
                          <p className="text-dark-400 text-xs">{asset.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">${(asset.price ?? 0).toFixed(2)}</p>
                        <p className={`text-xs ${(asset.change24h ?? 0) >= 0 ? 'text-secondary' : 'text-red-500'}`}>
                          {(asset.change24h ?? 0) > 0 ? '+' : ''}{(asset.change24h ?? 0).toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>

            {/* Chart + Order Form + Order Book */}
            <div className="lg:col-span-3">
              {selectedAsset ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                      <MarketChart
                        asset={selectedAsset}
                        data={chartData}
                        onIntervalChange={(label) => {
                          const map: Record<string, string> = {
                            '1H': '1h', '4H': '4h', '1D': '1d', '1W': '1w', '1M': '1d'
                          };
                          setChartInterval(map[label] || '1d');
                        }}
                      />
                    </div>
                    <div>
                      <TradeForm
                        asset={selectedAsset}
                        onPlaceOrder={handlePlaceOrder}
                        loading={isOrdersLoading}
                        availableBalance={availableBalance}
                        availableAssetAmount={availableAssetAmount}
                        paperMode={isPaperMode}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div>
                      <OrderBook
                        asks={orderBookData.asks}
                        bids={orderBookData.bids}
                        currentPrice={selectedAsset.price}
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <GlassCard className="p-4">
                        <div className="flex gap-4 mb-4 border-b border-dark-700">
                          <button
                            onClick={() => setActiveTab('open-orders-tab')}
                            className="pb-3 text-sm font-medium text-primary border-b-2 border-primary"
                          >
                            Open Orders ({openOrders.length})
                          </button>
                        </div>
                        <OrderHistory
                          orders={openOrders}
                          showCancelButton={true}
                          onCancelOrder={handleCancelOrder}
                        />
                      </GlassCard>
                    </div>
                  </div>
                </div>
              ) : (
                <GlassCard className="p-6 h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-xl font-medium mb-2">Select an asset to trade</p>
                    <p className="text-dark-400">Choose from the list on the left</p>
                  </div>
                </GlassCard>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Watchlist ── */}
        <TabsContent value="watchlist" className="pt-6">
          <Watchlist
            assets={assets}
            watchlist={watchlist}
            onToggleWatchlist={(assetId) => {
              const asset = assets.find(a => a.id === assetId);
              if (asset) toggleWatchlist(asset.symbol);
            }}
            onSelectAsset={(asset) => {
              setSelectedAsset(asset);
              setActiveTab('trade');
            }}
          />
        </TabsContent>

        {/* ── Order History ── */}
        <TabsContent value="orders" className="pt-6">
          <OrderHistory
            orders={orderHistory}
            showCancelButton={false}
          />
        </TabsContent>

        {/* ── Price Alerts ── */}
        <TabsContent value="alerts" className="pt-6">
          <PriceAlerts assets={assets} />
        </TabsContent>
      </Tabs>

      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        assets={assets}
      />
    </div>
  );
};

export default Trading;
```

---

## 18. `market.service.ts` (frontend) — missing API functions

**Problem**: `index.tsx` now calls `marketApi.getWatchlist()`, `marketApi.addToWatchlist()`, `marketApi.removeFromWatchlist()` but none of these exist in `market.service.ts`. Also missing: `getPriceAlerts`, `createPriceAlert`, `deletePriceAlert`.

**File**: `src/services/market.service.ts`

**Add these functions at the bottom of the file:**

```ts
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
  type: 'above' | 'below';
  price: number;
  notificationTypes: string[];
  isTriggered: boolean;
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
```

---

## 19. `OrderBook.tsx` — asks render in wrong order

**Problem**: Asks (sell orders) render top-to-bottom as received from the API (lowest price first). In every trading interface, asks should render with the **highest** ask at top and the **lowest** ask at bottom — closest to the spread at the center. Currently the spread is at the bottom, not the middle.

**File**: `src/components/trading/OrderBook.tsx`

**Find and replace the asks section:**

```tsx
// ❌ BROKEN — asks in wrong order, no visual separation from spread:
      <div className="mb-4 max-h-40 overflow-y-auto">
        {asksWithTotal.map((ask, index) => (
```

```tsx
// ✅ FIXED — reverse asks so lowest price is nearest the spread:
      <div className="mb-4 max-h-40 overflow-y-auto flex flex-col-reverse">
        {[...asksWithTotal].reverse().map((ask, index) => (
```

---

## 20. `package.json` — add `socket.io-client` dependency

**Problem**: `useMarketSocket.ts` (from Plan v1) imports from `socket.io-client` but this package may not be installed. TypeScript will error and the app won't build.

**Action**: Run this command in your project root:

```bash
npm install socket.io-client
npm install --save-dev @types/socket.io-client
```

**Or add to `package.json` dependencies manually:**

```json
{
  "dependencies": {
    "socket.io-client": "^4.7.4"
  },
  "devDependencies": {
    "@types/socket.io-client": "^3.0.0"
  }
}
```

---

## 21. NEW COMPONENT: `PriceAlerts.tsx` — complete alerts UI

**Problem**: The backend has full alert CRUD (`/api/market/alerts`) with a model and routes. There is zero frontend UI for it. The "Alerts" tab in the updated `index.tsx` renders nothing without this component.

**Create new file**: `src/components/trading/PriceAlerts.tsx`

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Plus, Trash2, Loader, AlertCircle } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import * as marketApi from '../../services/market.service';
import { Asset } from '../../types';

interface PriceAlertsProps {
  assets: Asset[];
}

const PriceAlerts: React.FC<PriceAlertsProps> = ({ assets }) => {
  const [alerts, setAlerts] = useState<marketApi.PriceAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [symbol, setSymbol] = useState('BTC');
  const [alertType, setAlertType] = useState<'above' | 'below'>('above');
  const [price, setPrice] = useState('');
  const [notifTypes, setNotifTypes] = useState<string[]>(['email']);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await marketApi.getPriceAlerts();
      setAlerts(response.data || []);
    } catch (err: any) {
      setError('Failed to load alerts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = parseFloat(price);
    if (!symbol || !parsedPrice || parsedPrice <= 0) {
      setError('Please enter a valid symbol and price.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await marketApi.createPriceAlert({
        symbol,
        type: alertType,
        price: parsedPrice,
        notificationTypes: notifTypes,
      });
      setPrice('');
      setShowForm(false);
      await fetchAlerts();
    } catch (err: any) {
      setError(err?.message || 'Failed to create alert.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (alertId: string) => {
    setDeletingId(alertId);
    try {
      await marketApi.deletePriceAlert(alertId);
      setAlerts(prev => prev.filter(a => a._id !== alertId));
    } catch (err: any) {
      setError('Failed to delete alert.');
    } finally {
      setDeletingId(null);
    }
  };

  const currentPrice = assets.find(a => a.symbol === symbol)?.price;

  return (
    <GlassCard className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-primary" />
          <h3 className="text-xl font-semibold">Price Alerts</h3>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all"
        >
          <Plus size={16} />
          New Alert
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Create Alert Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-dark-800/50 rounded-lg border border-dark-700 space-y-4">
          <h4 className="font-medium text-sm text-dark-400 uppercase tracking-wide">Create Alert</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-dark-400 mb-1">Asset</label>
              <select
                value={symbol}
                onChange={e => setSymbol(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-light text-sm"
              >
                {assets.map(a => (
                  <option key={a.id} value={a.symbol}>{a.symbol} — {a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-dark-400 mb-1">Condition</label>
              <div className="flex">
                <button
                  type="button"
                  onClick={() => setAlertType('above')}
                  className={`flex-1 py-2 rounded-l-lg text-sm font-medium transition-all ${alertType === 'above' ? 'bg-secondary text-dark-900' : 'bg-dark-800 text-dark-400'}`}
                >
                  Above
                </button>
                <button
                  type="button"
                  onClick={() => setAlertType('below')}
                  className={`flex-1 py-2 rounded-r-lg text-sm font-medium transition-all ${alertType === 'below' ? 'bg-red-500 text-white' : 'bg-dark-800 text-dark-400'}`}
                >
                  Below
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-dark-400 mb-1">
                Price (USD)
                {currentPrice && (
                  <span className="ml-2 text-primary">Current: ${currentPrice.toFixed(2)}</span>
                )}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-light text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-2">Notify via</label>
            <div className="flex gap-3">
              {['email', 'push', 'sms'].map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifTypes.includes(t)}
                    onChange={e => {
                      if (e.target.checked) setNotifTypes(prev => [...prev, t]);
                      else setNotifTypes(prev => prev.filter(x => x !== t));
                    }}
                    className="accent-primary"
                  />
                  <span className="text-sm capitalize text-light">{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Alert'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-2 bg-dark-800 text-light rounded-lg text-sm hover:bg-dark-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Alert list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader size={24} className="animate-spin text-primary" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12">
          <BellOff size={36} className="mx-auto text-dark-400 mb-3" />
          <p className="text-dark-400 font-medium">No active alerts</p>
          <p className="text-dark-500 text-sm mt-1">Create an alert to get notified when prices move</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => {
            const asset = assets.find(a => a.symbol === alert.symbol);
            const currentP = asset?.price ?? 0;
            const diff = currentP > 0
              ? ((alert.price - currentP) / currentP * 100).toFixed(2)
              : null;

            return (
              <div
                key={alert._id}
                className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg border border-dark-700"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${alert.type === 'above' ? 'bg-secondary/20' : 'bg-red-500/20'}`}>
                    <Bell size={16} className={alert.type === 'above' ? 'text-secondary' : 'text-red-400'} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{alert.symbol}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${alert.type === 'above' ? 'bg-secondary/20 text-secondary' : 'bg-red-500/20 text-red-400'}`}>
                        {alert.type === 'above' ? '↑ Above' : '↓ Below'}
                      </span>
                    </div>
                    <div className="text-sm text-dark-400 mt-0.5">
                      Target: <span className="text-light font-medium">${alert.price.toLocaleString()}</span>
                      {currentP > 0 && diff !== null && (
                        <span className="ml-2 text-xs">
                          ({parseFloat(diff) >= 0 ? '+' : ''}{diff}% away)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-dark-500 mt-0.5">
                      Notify: {alert.notificationTypes.join(', ')}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(alert._id)}
                  disabled={deletingId === alert._id}
                  className="p-2 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                >
                  {deletingId === alert._id
                    ? <Loader size={16} className="animate-spin" />
                    : <Trash2 size={16} />
                  }
                </button>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
};

export default PriceAlerts;
```

---

## Final Production Checklist

After applying Plan v1 + Plan v2, run this checklist before deploying:

### Environment Variables Required
```env
# Kraken (public, no key needed)
KRAKEN_API_URL=https://api.kraken.com/0/public

# Binance (for live order book + trading)
BINANCE_API_KEY=your_key
BINANCE_API_SECRET=your_secret

# Yahoo Finance (for stock prices/history)
# No key required for basic usage

# Alpha Vantage (for forex history)
ALPHA_VANTAGE_URL=https://www.alphavantage.co
ALPHA_VANTAGE_API_KEY=your_key

# Redis
REDIS_URL=redis://localhost:6379
# OR
REDIS_HOST=localhost
REDIS_PORT=6379

# Paper trading
PAPER_TRADING_INITIAL_BALANCE=10000

# Ethereum RPC (for wallet balance fetching)
ETH_RPC_URL=https://mainnet.infura.io/v3/your_key
```

### npm packages to install
```bash
npm install socket.io-client
npm install --save-dev @types/socket.io-client
```

### New files created by Plan v1 + v2 (must exist)
```
src/models/paper-portfolio.model.js     ← Plan v1 #14
src/models/watchlist.model.js           ← Plan v2 #14
src/config/bullRedis.js                 ← Plan v1 #12
src/hooks/useMarketSocket.ts            ← Plan v1 #13
src/components/trading/PriceAlerts.tsx  ← Plan v2 #21
```

### Summary table

| # | File | Category | Severity |
|---|------|----------|----------|
| 1 | `market_service.js` | 6 missing service methods | 🔴 Critical |
| 2 | `market_service.js` | fetchStockHistory crash | 🔴 Critical |
| 3 | `market_service.js` | fetchCryptoDetails throws | 🔴 Critical |
| 4 | `market_service.js` | searchCrypto always empty | 🟡 Major |
| 5 | `market_service.js` | fetchTrendingCrypto empty | 🟡 Major |
| 6 | `market_controller.js` | hardcoded summary fallback + btcDominance | 🔴 Critical |
| 7 | `trading_service.js` | normalizeSymbol wrong map | 🔴 Critical |
| 8 | `trading_service.js` | N+1 syncOrderStatus on GET | 🟡 Major |
| 9 | `paper-trading.service.js` | P&L double-count | 🟡 Major |
| 10 | `paper-trading.service.js` | wrong log label | 🔵 Minor |
| 11 | `wallet_service.js` | ethers v5/v6 conflict | 🔴 Critical |
| 12 | `wallet_service.js` | console.log in prod | 🟡 Major |
| 13 | `marketData_job.js` | duplicate repeat jobs | 🟡 Major |
| 14 | `watchlist.model.js` | missing model file | 🔴 Critical |
| 15 | `trading.service.ts` | cancelOrder missing | 🔴 Critical |
| 16 | `trading.service.ts` | placeOrder missing fields | 🔴 Critical |
| 17 | `index.tsx` | full rewrite — 10 missing features | 🔴 Critical |
| 18 | `market.service.ts` | 6 missing frontend functions | 🔴 Critical |
| 19 | `OrderBook.tsx` | asks wrong order | 🟡 Major |
| 20 | `package.json` | socket.io-client missing | 🔴 Critical |
| 21 | `PriceAlerts.tsx` | new component | 🟢 Feature |
ENDOFFILE
echo "Done writing plan"
Output

Done writing plan
