const axios = require('axios');
const ccxt = require('ccxt');
const yahooFinance = require('yahoo-finance2').default || require('yahoo-finance2');
const { redisClient } = require('../config/database');
const MarketAlert = require('../models/market-alert.model');
const Watchlist = require('../models/watchlist.model');
const { logger } = require('../api/middlewares/logger.middleware');
const { calculateTechnicalIndicators } = require('../utils/indicators');
const krakenService = require('./kraken.service');

class MarketService {
  constructor() {
    this.CACHE_DURATION = {
      PRICE: 60,      // 60 seconds
      HISTORY: 300,   // 5 minutes
      DETAILS: 3600,  // 1 hour
      TRENDING: 300   // 5 minutes
    };

    // Kraken is the single crypto market data source. No CoinGecko usage.
    
    // Initialize exchange clients safely
    this.exchanges = {};

    try {
      this.exchanges.binance = new ccxt.binance({
        apiKey: process.env.BINANCE_API_KEY || '',
        secret: process.env.BINANCE_API_SECRET || '',
        enableRateLimit: true
      });
    } catch (error) {
      logger.error('Failed to initialize Binance exchange:', error);
    }

    // FIXED: coinbasepro -> coinbase
    try {
      this.exchanges.coinbase = new ccxt.coinbase({
        apiKey: process.env.COINBASE_API_KEY || '',
        secret: process.env.COINBASE_API_SECRET || '',
        password: process.env.COINBASE_PASSPHRASE || '',
        enableRateLimit: true
      });
    } catch (error) {
      logger.error('Failed to initialize Coinbase exchange:', error);
    }
  }

  // Get live prices from Kraken only. No fallbacks.
  async getLivePrices(symbols = []) {
    try {
      if (!Array.isArray(symbols) || symbols.length === 0) {
        return {};
      }

      const results = {};

      // Use Kraken only
      try {
        logger.debug(`Attempting to fetch prices from Kraken for: ${symbols.join(', ')}`);
        const krakenPrices = await krakenService.getLivePrices(symbols);

        for (const symbol of symbols) {
          const priceData = krakenPrices?.[symbol];
          if (priceData && (typeof priceData.price === 'number' || typeof priceData.price === 'string')) {
            const numericPrice = typeof priceData.price === 'number' ? priceData.price : Number(priceData.price);
            results[symbol] = {
              price: isNaN(numericPrice) ? null : numericPrice,
              change24h: priceData.change24h ?? null,
              volume24h: priceData.volume24h ?? null,
              marketCap: priceData.marketCap ?? null,
              lastUpdated: priceData.lastUpdated ?? new Date().toISOString(),
              source: 'kraken'
            };
          } else {
            // Kraken did not return pricing for this symbol
              results[symbol] = {
                price: null,
                error: 'Price unavailable from Kraken',
                reason: 'not_supported'
              };
              logger.warn(`Kraken price not available for ${symbol}`);
          }
        }

        const successCount = Object.values(results).filter(r => r && r.price !== null).length;
        logger.info(`Kraken: fetched ${successCount}/${symbols.length} prices`);
        return results;
      } catch (krakenError) {
        logger.error('Kraken API failed:', krakenError?.message || krakenError);
        // If Kraken entirely fails, return all symbols as unavailable
        const fallback = {};
        for (const symbol of symbols) {
          fallback[symbol] = { price: null, error: 'Price unavailable from Kraken', reason: 'api_error' };
        }
        return fallback;
      }
    } catch (error) {
      logger.error('Error fetching live prices:', error);
      return {};
    }
  }

  // Map common symbols to CoinGecko IDs
  mapSymbolToCoinGeckoId(symbol) {
      throw new Error('CoinGecko integration removed: use Kraken-only pricing');
  }

  // Reverse mapping
  mapCoinGeckoIdToSymbol(coinGeckoId) {
      throw new Error('CoinGecko integration removed: use Kraken-only pricing');
  }

  async getMarketPrices(symbols = []) {
    try {
      if (!Array.isArray(symbols) || symbols.length === 0) {
        return {};
      }

      // Use Kraken for crypto prices
const cryptoSymbols = symbols.filter(symbol => {
  return this.getAssetType(symbol) === 'crypto';
});
      // Use Yahoo Finance for stocks
      const stockSymbols = symbols.filter(symbol =>
        !cryptoSymbols.includes(symbol) && symbol.includes('/') === false
      );

      // Use forex for currency pairs
      const forexSymbols = symbols.filter(symbol =>
        symbol.includes('/') && !stockSymbols.includes(symbol)
      );

      const results = {};

      // Fetch crypto prices from Kraken
      if (cryptoSymbols.length > 0) {
        const cryptoPrices = await this.getLivePrices(cryptoSymbols);
        Object.assign(results, cryptoPrices);
      }

      // Fetch stock prices from Yahoo Finance
      if (stockSymbols.length > 0) {
        const stockPrices = await this.getStockPrices(stockSymbols);
        Object.assign(results, stockPrices);
      }

      // Fetch forex prices
      if (forexSymbols.length > 0) {
        const forexPrices = await this.getForexPrices(forexSymbols);
        Object.assign(results, forexPrices);
      }

      return results;
    } catch (error) {
      logger.error('Error fetching market prices:', error);
      throw new Error('Failed to fetch market prices');
    }
  }

  // Get stock prices from Yahoo Finance
  async getStockPrices(symbols = []) {
    try {
      const results = {};

      for (const symbol of symbols) {
        try {
          const cacheKey = `stock:price:${symbol}`;

          // Check cache first
          let cachedData = null;
          try {
            if (redisClient && redisClient.isOpen && typeof redisClient.get === 'function') {
              cachedData = await redisClient.get(cacheKey);
              if (cachedData) {
                results[symbol] = JSON.parse(cachedData);
                continue;
              }
            }
          } catch (cacheError) {
            logger.warn('Redis cache unavailable, fetching from API:', cacheError.message);
          }

          // Fetch from Yahoo Finance
          const quote = await yahooFinance.quote(symbol);
          if (quote && quote.regularMarketPrice) {
            const priceData = {
              price: quote.regularMarketPrice,
              change24h: quote.regularMarketChangePercent || 0,
              volume24h: quote.regularMarketVolume || 0,
              marketCap: quote.marketCap || 0,
              lastUpdated: new Date().toISOString()
            };

            results[symbol] = priceData;

            // Cache the result
            try {
              if (redisClient && redisClient.isOpen && typeof redisClient.setEx === 'function') {
                await redisClient.setEx(cacheKey, this.CACHE_DURATION.PRICE, JSON.stringify(priceData));
              }
            } catch (cacheError) {
              logger.warn('Redis cache write failed:', cacheError.message);
            }
          }
        } catch (error) {
          logger.warn(`Failed to fetch stock price for ${symbol}:`, error.message);
        }
      }

      return results;
    } catch (error) {
      logger.error('Error fetching stock prices:', error);
      return {};
    }
  }

  // Get forex prices
  async getForexPrices(symbols = []) {
    try {
      // Use exchangerate.host as the forex provider (no mock data)
      const results = {};

      for (const symbol of symbols) {
        try {
          const cacheKey = `forex:price:${symbol}`;

          // Check cache first
          let cachedData = null;
          try {
            if (redisClient && redisClient.isOpen && typeof redisClient.get === 'function') {
              cachedData = await redisClient.get(cacheKey);
              if (cachedData) {
                results[symbol] = JSON.parse(cachedData);
                continue;
              }
            }
          } catch (cacheError) {
            logger.warn('Redis cache unavailable, fetching from API:', cacheError.message);
          }

          const [base, quote] = symbol.split('/');
          if (!base || !quote) {
            results[symbol] = { price: null, error: 'Invalid forex symbol' };
            continue;
          }

          const url = `https://api.exchangerate.host/convert`;
          const resp = await axios.get(url, {
            params: { from: base, to: quote }
          });

          const rate = resp?.data?.result ?? null;
          if (rate === null || rate === undefined) {
            results[symbol] = { price: null, error: 'Forex rate unavailable' };
          } else {
            // Fetch yesterday's rate to compute change24h
            let change24h = null;
            try {
              const yesterday = new Date(Date.now() - 86400000);
              const yDate = yesterday.toISOString().split('T')[0];
              const yResp = await axios.get('https://api.exchangerate.host/convert', {
                params: { from: base, to: quote, date: yDate }
              });
              const yRate = yResp?.data?.result;
              if (yRate && yRate !== 0) {
                change24h = parseFloat((((Number(rate) - yRate) / yRate) * 100).toFixed(4));
              }
            } catch (_) { /* non-critical */ }

            const priceData = {
              price: Number(rate),
              change24h,
              volume24h: null,
              marketCap: null,
              lastUpdated: new Date().toISOString()
            };

            results[symbol] = priceData;

            // Cache the result
            try {
              if (redisClient && redisClient.isOpen && typeof redisClient.setEx === 'function') {
                await redisClient.setEx(cacheKey, this.CACHE_DURATION.PRICE, JSON.stringify(priceData));
              }
            } catch (cacheError) {
              logger.warn('Redis cache write failed:', cacheError.message);
            }
          }
        } catch (error) {
          logger.warn(`Failed to fetch forex price for ${symbol}:`, error?.message || error);
          results[symbol] = { price: null, error: 'Forex rate unavailable' };
        }
      }

      return results;
    } catch (error) {
      logger.error('Error fetching forex prices:', error);
      return {};
    }
  }

  // getMockForexPrice removed: exchangerate.host is used instead

  async getSymbolPrice(symbol) {
    try {
      const cachedPrice = await this.getCachedPrice(symbol);
      if (cachedPrice !== null) {
        return { symbol, price: cachedPrice };
      }

      const prices = await this.fetchPrices([symbol]);
      return { symbol, price: prices[symbol] ?? null };
    } catch (error) {
      logger.error(`Error fetching price for ${symbol}:`, error);
      throw new Error(`Failed to fetch price for ${symbol}`);
    }
  }

  async getPriceHistory(symbol, interval, from, to) {
    try {
      const cacheKey = `history:${symbol}:${interval}:${from}:${to}`;

      if (redisClient && redisClient.isOpen && typeof redisClient.get === 'function') {
        try {
          const cachedHistory = await redisClient.get(cacheKey);
          if (cachedHistory) {
            logger.debug(`Cache HIT for ${symbol} price history`);
            return JSON.parse(cachedHistory);
          }
        } catch (error) {
          logger.warn('Redis cache read failed:', error.message);
        }
      }

      logger.debug(`Cache MISS for ${symbol}, fetching from API...`);
      const history = await this.fetchPriceHistory(symbol, interval, from, to);
      const indicators = calculateTechnicalIndicators(
        Array.isArray(history) ? history.map(h => h.close) : []
      );

      const enrichedHistory = {
        prices: history,
        indicators
      };

      if (redisClient && typeof redisClient.setEx === 'function') {
        try {
          await redisClient.setEx(
            cacheKey,
            this.CACHE_DURATION.HISTORY,
            JSON.stringify(enrichedHistory)
          );
        } catch (error) {
          logger.warn('Redis cache write failed:', error.message);
        }
      }

      return enrichedHistory;
    } catch (error) {
      logger.error(`Error fetching price history for ${symbol}:`, {
        message: error.message,
        symbol,
        interval,
        from,
        to,
        stack: error.stack
      });
      throw new Error(`Failed to fetch price history for ${symbol}: ${error.message}`);
    }
  }

  async getTrendingAssets() {
    try {
      const cacheKey = 'trending:assets';

      if (redisClient && typeof redisClient.get === 'function') {
        const cachedTrending = await redisClient.get(cacheKey);
        if (cachedTrending) {
          return JSON.parse(cachedTrending);
        }
      }

      const trending = await this.fetchTrendingAssets();

      if (redisClient && typeof redisClient.setEx === 'function') {
        await redisClient.setEx(
          cacheKey,
          this.CACHE_DURATION.TRENDING,
          JSON.stringify(trending)
        );
      }

      return trending;
    } catch (error) {
      logger.error('Error fetching trending assets:', error);
      throw new Error('Failed to fetch trending assets');
    }
  }

  async searchAssets(query, type) {
    try {
      let results = [];

      switch (type) {
        case 'crypto':
          results = await this.searchCryptoAssets(query);
          break;
        case 'stock':
          results = await this.searchStockAssets(query);
          break;
        case 'forex':
          results = await this.searchForexAssets(query);
          break;
        case 'commodity':
          results = await this.searchCommodityAssets(query);
          break;
        default: {
          const [crypto, stocks, forex, commodities] = await Promise.all([
            this.searchCryptoAssets(query),
            this.searchStockAssets(query),
            this.searchForexAssets(query),
            this.searchCommodityAssets(query)
          ]);
          results = [...crypto, ...stocks, ...forex, ...commodities];
        }
      }

      return results;
    } catch (error) {
      logger.error('Error searching assets:', error);
      throw new Error('Failed to search assets');
    }
  }

  async getAssetDetails(symbol) {
    try {
      const cacheKey = `details:${symbol}`;

      if (redisClient && typeof redisClient.get === 'function') {
        const cachedDetails = await redisClient.get(cacheKey);
        if (cachedDetails) {
          return JSON.parse(cachedDetails);
        }
      }

      const details = await this.fetchAssetDetails(symbol);

      if (redisClient && typeof redisClient.setEx === 'function') {
        await redisClient.setEx(
          cacheKey,
          this.CACHE_DURATION.DETAILS,
          JSON.stringify(details)
        );
      }

      return details;
    } catch (error) {
      logger.error(`Error fetching details for ${symbol}:`, error);
      throw new Error(`Failed to fetch details for ${symbol}`);
    }
  }

  // ------------------------------------------------
  // Private helper methods
  // ------------------------------------------------

  async getCachedPrice(symbol) {
    try {
      const cacheKey = `price:${symbol}`;

      if (!redisClient || !redisClient.isOpen || typeof redisClient.get !== 'function') {
        return null;
      }

      const cachedPrice = await redisClient.get(cacheKey);
      return cachedPrice ? parseFloat(cachedPrice) : null;
    } catch (error) {
      logger.error(`Error getting cached price for ${symbol}:`, error);
      return null;
    }
  }

  async fetchPrices(symbols) {
    try {
      const prices = {};

      // Group symbols by asset type
      const symbolsByType = this.categorizeSymbols(symbols);

      // Fetch crypto prices
      if (symbolsByType.crypto.length > 0) {
        const cryptoPrices = await this.fetchCryptoPrices(symbolsByType.crypto);
        Object.assign(prices, cryptoPrices);
      }

      // Fetch stock prices
      if (symbolsByType.stocks.length > 0) {
        const stockPrices = await this.fetchStockPrices(symbolsByType.stocks);
        Object.assign(prices, stockPrices);
      }

      // Fetch forex prices
      if (symbolsByType.forex.length > 0) {
        const forexPrices = await this.fetchForexPrices(symbolsByType.forex);
        Object.assign(prices, forexPrices);
      }

      // Cache the prices
      for (const [symbol, price] of Object.entries(prices)) {
        if (price !== null && price !== undefined && !Number.isNaN(Number(price))) {
          await this.cachePrice(symbol, Number(price));
        }
      }

      return prices;
    } catch (error) {
      logger.error('Error fetching prices:', error);
      throw new Error('Failed to fetch prices');
    }
  }

  async fetchCryptoPrices(symbols) {
    // Delegate to Kraken-only pricing
    const krakenResults = await this.getLivePrices(symbols);
    // Return flat price map (symbol -> number) for backward compatibility
    const prices = {};
    for (const [symbol, data] of Object.entries(krakenResults)) {
      prices[symbol] = data?.price ?? null;
    }
    return prices;
  }

  async fetchStockPrices(symbols) {
    try {
      if (!Array.isArray(symbols) || symbols.length === 0) {
        return {};
      }

      const quotes = await yahooFinance.quote(symbols);

      if (Array.isArray(quotes)) {
        return Object.fromEntries(
          quotes.map(quote => [quote.symbol, quote.regularMarketPrice ?? null])
        );
      }

      return {
        [quotes.symbol]: quotes.regularMarketPrice ?? null
      };
    } catch (error) {
      logger.error('Error fetching stock prices:', error);
      throw error;
    }
  }

  async fetchForexPrices(symbols) {
    try {
      if (!process.env.ALPHA_VANTAGE_URL) {
        throw new Error('ALPHA_VANTAGE_URL is not configured');
      }

      const prices = {};

      for (const symbol of symbols) {
        const [fromCurrency, toCurrency] = symbol.split('/');

        const response = await axios.get(`${process.env.ALPHA_VANTAGE_URL}/query`, {
          params: {
            function: 'CURRENCY_EXCHANGE_RATE',
            from_currency: fromCurrency,
            to_currency: toCurrency,
            apikey: process.env.ALPHA_VANTAGE_API_KEY
          }
        });

        const rate =
          response.data?.['Realtime Currency Exchange Rate']?.['5. Exchange Rate'];

        prices[symbol] = rate ? parseFloat(rate) : null;
      }

      return prices;
    } catch (error) {
      logger.error('Error fetching forex prices:', error);
      throw error;
    }
  }

  async fetchPriceHistory(symbol, interval, from, to) {
    try {
      const assetType = this.getAssetType(symbol);
      let history;

      switch (assetType) {
        case 'crypto':
          history = await this.fetchCryptoHistory(symbol, interval, from, to);
          break;
        case 'stock':
          history = await this.fetchStockHistory(symbol, interval, from, to);
          break;
        case 'forex':
          history = await this.fetchForexHistory(symbol, interval, from, to);
          break;
        default:
          throw new Error(`Unsupported asset type for ${symbol}`);
      }

      return (history || []).map(candle => ({
        timestamp: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      }));
    } catch (error) {
      logger.error(`Error fetching price history for ${symbol}:`, error);
      throw error;
    }
  }

  async fetchCryptoHistory(symbol, interval, from, to) {
    try {
      // Check if symbol is supported by Kraken
      const supportsKraken = krakenService.isSymbolSupported(symbol);
      
      logger.debug(`Checking Kraken support for ${symbol}: ${supportsKraken}`);
      // Kraken-only: if supported, return Kraken data; otherwise signal unsupported.
      if (supportsKraken) {
        logger.info(`Fetching crypto history for ${symbol} from Kraken`);
        const krakenData = await this.fetchFromKraken(symbol, interval, from, to);
        logger.info(`✓ Kraken succeeded: fetched ${krakenData.length} candles for ${symbol}`);
        return krakenData;
      }

      logger.warn(`Symbol ${symbol} not supported on Kraken. Crypto history unavailable.`);
      throw new Error('Price unavailable from Kraken');
    } catch (error) {
      logger.error(`Error fetching crypto history for ${symbol}:`, error.message);
      logger.error(`Full error details:`, {
        symbol,
        interval,
        from,
        to,
        errorName: error.name,
        errorStack: error.stack
      });
      throw error;
    }
  }

  async fetchFromKraken(symbol, interval, from, to) {
    try {
      logger.debug(`fetchFromKraken: symbol=${symbol}, interval=${interval}, from=${from}, to=${to}`);
      
      // Get historical data from Kraken service
      const candles = await krakenService.getHistoricalData(symbol, interval, from);

      logger.debug(`Kraken returned ${candles.length} candles for ${symbol}`);
      
      if (!Array.isArray(candles) || candles.length === 0) {
        throw new Error(`No OHLCV data returned for ${symbol} from Kraken`);
      }

      // Filter by "to" date manually
      let result = candles;
      if (to) {
        const toMs = new Date(to).getTime();
        result = candles.filter(c => c.timestamp <= toMs);
        logger.debug(`After filtering by "to" date: ${result.length} candles`);
      }

      logger.info(`✓ Successfully fetched ${result.length} candles for ${symbol} from Kraken`);
      return result;
    } catch (error) {
      logger.error(`Error fetching from Kraken for ${symbol}:`, {
        message: error.message,
        name: error.name,
        code: error.code
      });
      throw error;
    }
  }

  async fetchFromBinance(symbol, interval, from, to) {
    const exchange = this.exchanges.binance;
    if (!exchange) {
      throw new Error('Binance exchange is not initialized');
    }

    // Convert symbol to trading pair format for Binance
    // BTC -> BTC/USDT, ETH -> ETH/USDT, SOL -> SOL/USDT
    let tradingPair = symbol;
    if (!symbol.includes('/')) {
      tradingPair = `${symbol}/USDT`;
    }

    const timeframes = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d',
      '1w': '1w'
    };

    const timeframe = timeframes[interval] || '1d';
    const since = from ? new Date(from).getTime() : undefined;

    logger.debug(`Fetching from Binance: pair=${tradingPair}, timeframe=${timeframe}, since=${since}`);

    const ohlcv = await exchange.fetchOHLCV(
      tradingPair,
      timeframe,
      since,
      500
    );

    if (!Array.isArray(ohlcv) || ohlcv.length === 0) {
      throw new Error(`No OHLCV data returned for ${tradingPair}`);
    }

    let candles = ohlcv.map(([timestamp, open, high, low, close, volume]) => ({
      timestamp,
      open,
      high,
      low,
      close,
      volume
    }));

    // Filter by "to" manually
    if (to) {
      const toMs = new Date(to).getTime();
      candles = candles.filter(c => c.timestamp <= toMs);
    }

    logger.debug(`Successfully fetched ${candles.length} candles for ${tradingPair} from Binance`);
    return candles;
  }

  async fetchFromCoinGecko(symbol, interval, from, to) {
    throw new Error('fetchFromCoinGecko removed: Kraken-only policy in effect');
  }

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

      const result = await yahooFinance.historical(symbol, queryOptions);

      return (result || []).map(candle => ({
        timestamp: candle.date?.getTime?.() || null,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || 0
      }));
    } catch (error) {
      logger.error(`Error fetching stock history for ${symbol}:`, error);
      throw error;
    }
  }

  async fetchForexHistory(symbol, interval, from, to) {
    try {
      if (!process.env.ALPHA_VANTAGE_URL) {
        throw new Error('ALPHA_VANTAGE_URL is not configured');
      }

      const [fromSymbol, toSymbol] = symbol.split('/');

      const avInterval = this.convertIntervalForAlphaVantage(interval);

      const response = await axios.get(`${process.env.ALPHA_VANTAGE_URL}/query`, {
        params: {
          function: 'FX_INTRADAY',
          from_symbol: fromSymbol,
          to_symbol: toSymbol,
          interval: avInterval,
          outputsize: 'full',
          apikey: process.env.ALPHA_VANTAGE_API_KEY
        }
      });

      const timeSeriesKey = `Time Series FX (${avInterval})`;
      const timeSeries = response.data?.[timeSeriesKey] || {};

      let candles = Object.entries(timeSeries).map(([timestamp, data]) => ({
        timestamp: new Date(timestamp).getTime(),
        open: parseFloat(data['1. open']),
        high: parseFloat(data['2. high']),
        low: parseFloat(data['3. low']),
        close: parseFloat(data['4. close']),
        volume: 0
      }));

      if (from) {
        const fromMs = new Date(from).getTime();
        candles = candles.filter(c => c.timestamp >= fromMs);
      }

      if (to) {
        const toMs = new Date(to).getTime();
        candles = candles.filter(c => c.timestamp <= toMs);
      }

      // Oldest -> newest
      candles.sort((a, b) => a.timestamp - b.timestamp);

      return candles;
    } catch (error) {
      logger.error(`Error fetching forex history for ${symbol}:`, error);
      throw error;
    }
  }

  async fetchTrendingAssets() {
    try {
      const [cryptoTrending, stockTrending] = await Promise.all([
        this.fetchTrendingCrypto(),
        this.fetchTrendingStocks()
      ]);

      return {
        crypto: cryptoTrending,
        stocks: stockTrending
      };
    } catch (error) {
      logger.error('Error fetching trending assets:', error);
      throw error;
    }
  }

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

  async fetchTrendingStocks() {
    try {
      const result = await yahooFinance.trendingSymbols('US', { count: 10 });
      const symbols = (result?.quotes || []).map(q => q.symbol).filter(Boolean);
      if (!symbols.length) return [];

      const quotes = await yahooFinance.quote(symbols);
      const quotesArr = Array.isArray(quotes) ? quotes : [quotes];

      return quotesArr.map(q => ({
        symbol: q.symbol,
        name: q.shortName || q.symbol,
        type: 'stock',
        price: q.regularMarketPrice ?? null,
        priceChange24h: q.regularMarketChangePercent ?? null,
        volume24h: q.regularMarketVolume ?? null,
        marketCap: q.marketCap ?? null
      }));
    } catch (error) {
      logger.warn('Trending stocks fetch failed (non-critical):', error.message);
      return [];
    }
  }

  async fetchAssetDetails(symbol) {
    try {
      const assetType = this.getAssetType(symbol);
      let details;

      switch (assetType) {
        case 'crypto':
          details = await this.fetchCryptoDetails(symbol);
          break;
        case 'stock':
          details = await this.fetchStockDetails(symbol);
          break;
        case 'forex':
          details = await this.fetchForexDetails(symbol);
          break;
        default:
          throw new Error(`Unsupported asset type for ${symbol}`);
      }

      return details;
    } catch (error) {
      logger.error(`Error fetching asset details for ${symbol}:`, error);
      throw error;
    }
  }

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

  async fetchStockDetails(symbol) {
    try {
      const [quote, profile] = await Promise.all([
        yahooFinance.quote(symbol),
        yahooFinance.quoteSummary(symbol, {
          modules: ['summaryProfile', 'financialData', 'defaultKeyStatistics']
        })
      ]);

      return {
        symbol: quote.symbol,
        name: quote.shortName,
        type: 'stock',
        description: profile?.summaryProfile?.longBusinessSummary || '',
        marketData: {
          currentPrice: quote.regularMarketPrice ?? null,
          marketCap: quote.marketCap ?? null,
          volume24h: quote.regularMarketVolume ?? null,
          priceChange24h: quote.regularMarketChangePercent ?? null,
          high52w: quote.fiftyTwoWeekHigh ?? null,
          low52w: quote.fiftyTwoWeekLow ?? null
        },
        financialData: {
          revenue: profile?.financialData?.totalRevenue ?? null,
          grossProfits: profile?.financialData?.grossProfits ?? null,
          revenueGrowth: profile?.financialData?.revenueGrowth ?? null,
          earningsGrowth: profile?.financialData?.earningsGrowth ?? null
        },
        keyStats: {
          beta: profile?.defaultKeyStatistics?.beta ?? null,
          peRatio: profile?.defaultKeyStatistics?.forwardPE ?? null,
          eps: profile?.defaultKeyStatistics?.forwardEps ?? null,
          dividendYield: profile?.defaultKeyStatistics?.dividendYield ?? null
        }
      };
    } catch (error) {
      logger.error(`Error fetching stock details for ${symbol}:`, error);
      throw error;
    }
  }

  async fetchForexDetails(symbol) {
    try {
      if (!process.env.ALPHA_VANTAGE_URL) {
        throw new Error('ALPHA_VANTAGE_URL is not configured');
      }

      const [fromCurrency, toCurrency] = symbol.split('/');

      const response = await axios.get(`${process.env.ALPHA_VANTAGE_URL}/query`, {
        params: {
          function: 'CURRENCY_EXCHANGE_RATE',
          from_currency: fromCurrency,
          to_currency: toCurrency,
          apikey: process.env.ALPHA_VANTAGE_API_KEY
        }
      });

      const data = response.data?.['Realtime Currency Exchange Rate'];

      if (!data) {
        throw new Error('Invalid forex details response');
      }

      return {
        symbol,
        type: 'forex',
        fromCurrency: {
          code: data['1. From_Currency Code'],
          name: data['2. From_Currency Name']
        },
        toCurrency: {
          code: data['3. To_Currency Code'],
          name: data['4. To_Currency Name']
        },
        exchangeRate: parseFloat(data['5. Exchange Rate']),
        lastRefreshed: data['6. Last Refreshed'],
        timeZone: data['7. Time Zone']
      };
    } catch (error) {
      logger.error(`Error fetching forex details for ${symbol}:`, error);
      throw error;
    }
  }

  // ------------------------------------------------
  // Search helpers (added because your original file calls them)
  // ------------------------------------------------

  async searchCryptoAssets(query) {
    try {
      if (!query || query.length < 1) return [];

      const q = query.toUpperCase();

      // All symbols Kraken supports (from kraken.service.js symbolMap + common extras)
      const knownCryptoSymbols = [
        'BTC','ETH','SOL','XRP','ADA','DOGE','DOT','MATIC','POL','LINK','AVAX',
        'LTC','USDT','USDC','BNB','XLM','TRX','ETC','UNI','ALGO','ICP',
        'NEAR','ATOM','ARB','OP','APT','SUI','PEPE','MKR','AAVE','SNX',
        'CRV','COMP','YFI','SUSHI','BAL','REN','KNC','ZRX','BAT','ENJ',
        'MANA','SAND','AXS','CHZ','FLOW','HBAR','VET','THETA','FTM','RUNE'
      ];

      const nameMap = {
        'BTC': 'Bitcoin', 'ETH': 'Ethereum', 'SOL': 'Solana', 'XRP': 'Ripple',
        'ADA': 'Cardano', 'DOGE': 'Dogecoin', 'DOT': 'Polkadot', 'MATIC': 'Polygon', 'POL': 'Polygon',
        'LINK': 'Chainlink', 'AVAX': 'Avalanche', 'LTC': 'Litecoin', 'USDT': 'Tether',
        'USDC': 'USD Coin', 'BNB': 'Binance Coin', 'XLM': 'Stellar', 'TRX': 'TRON',
        'ETC': 'Ethereum Classic', 'UNI': 'Uniswap', 'ALGO': 'Algorand',
        'ICP': 'Internet Computer', 'NEAR': 'NEAR Protocol', 'ATOM': 'Cosmos',
        'ARB': 'Arbitrum', 'OP': 'Optimism', 'APT': 'Aptos', 'SUI': 'Sui',
        'PEPE': 'Pepe', 'MKR': 'Maker', 'AAVE': 'Aave'
      };

      // CoinGecko ID mapping for image URLs
      const coinGeckoIdMap = {
        'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'XRP': 'ripple',
        'ADA': 'cardano', 'DOGE': 'dogecoin', 'DOT': 'polkadot', 'MATIC': 'matic-network',
        'LINK': 'chainlink', 'AVAX': 'avalanche-2', 'LTC': 'litecoin', 'USDT': 'tether',
        'USDC': 'usd-coin', 'BNB': 'binancecoin', 'XLM': 'stellar', 'TRX': 'tron',
        'ETC': 'ethereum-classic', 'UNI': 'uniswap', 'ALGO': 'algorand', 'ICP': 'internet-computer',
        'NEAR': 'near', 'ATOM': 'cosmos', 'ARB': 'arbitrum', 'OP': 'optimism', 'APT': 'aptos',
        'SUI': 'sui', 'PEPE': 'pepe', 'MKR': 'maker', 'AAVE': 'aave'
      };

      return knownCryptoSymbols
        .filter(sym =>
          sym.includes(q) || (nameMap[sym] || '').toUpperCase().includes(q)
        )
        .slice(0, 20)
        .map(sym => ({
          id: coinGeckoIdMap[sym] || sym.toLowerCase(),
          symbol: sym,
          name: nameMap[sym] || sym,
          type: 'crypto',
          image: `https://assets.coingecko.com/coins/images/1/${coinGeckoIdMap[sym] || sym.toLowerCase()}.png`,
          source: 'kraken'
        }));
    } catch (error) {
      logger.error('Error searching crypto assets:', error);
      return [];
    }
  }

  async searchStockAssets(query) {
    try {
      if (!query || query.length < 2) return [];
      
      const results = await yahooFinance.search(query);
      return (results?.quotes || [])
        .filter(q => q.isYahooFinance && q.quoteType === 'EQUITY')
        .slice(0, 10)
        .map(q => ({
          symbol: q.symbol,
          name: q.shortname || q.longname || q.symbol,
          type: 'stock',
          exchange: q.exchange || ''
        }));
    } catch (error) {
      logger.warn('Stock asset search failed:', error.message);
      return [];
    }
  }

  async searchForexAssets(query) {
    try {
      if (!query) return [];

      const normalized = query.toUpperCase().replace('-', '/').replace(/\s+/g, '');
      return [
        {
          symbol: normalized.includes('/') ? normalized : `${normalized}/USD`,
          name: `Forex Pair ${normalized}`,
          type: 'forex'
        }
      ];
    } catch (error) {
      logger.error('Error searching forex assets:', error);
      return [];
    }
  }

  async searchCommodityAssets(query) {
    try {
      return [];
    } catch (error) {
      logger.error('Error searching commodity assets:', error);
      return [];
    }
  }

  // ------------------------------------------------
  // Utility methods
  // ------------------------------------------------

  getAssetType(symbol) {
    // Forex pairs like EUR/USD
    if (symbol.includes('/')) {
      const parts = symbol.split('/');
      const knownFiat = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF', 'NZD'];
      if (parts.length === 2 && knownFiat.includes(parts[0]) && knownFiat.includes(parts[1])) {
        return 'forex';
      }

      // Otherwise treat slash-based crypto pairs like BTC/USDT as crypto
      return 'crypto';
    }

    // FIXED: Check for known crypto symbols BEFORE checking for stock patterns
    // This prevents BTC, ETH, SOL from being classified as stocks
    const cryptoSymbols = new Set([
      'BTC', 'ETH', 'USDT', 'BNB', 'USDC', 'XRP', 'ADA', 'SOL', 'DOT', 'DOGE',
      'AVAX', 'MATIC', 'POL', 'LTC', 'ETC', 'LINK', 'UNI', 'ALGO', 'ICP', 'FIL', 'TRX',
      'VET', 'THETA', 'FTT', 'HBAR', 'NEAR', 'FLOW', 'MANA', 'SAND', 'AXS', 'CHZ',
      'ENJ', 'BAT', 'OMG', 'ZRX', 'REP', 'GNT', 'STORJ', 'ANT', 'MKR', 'KNC'
    ]);

    if (cryptoSymbols.has(symbol)) {
      return 'crypto';
    }

    // Simple stock symbols like AAPL, TSLA, MSFT
    if (/^[A-Z.]{1,5}$/.test(symbol)) {
      return 'stock';
    }

    // Otherwise assume crypto id/symbol
    return 'crypto';
  }

  categorizeSymbols(symbols) {
    return symbols.reduce(
      (acc, symbol) => {
        const type = this.getAssetType(symbol);

        if (type === 'stock') {
          acc.stocks.push(symbol); // FIXED
        } else if (type === 'crypto') {
          acc.crypto.push(symbol);
        } else if (type === 'forex') {
          acc.forex.push(symbol);
        }

        return acc;
      },
      { crypto: [], stocks: [], forex: [] }
    );
  }

  convertIntervalForYahoo(interval) {
    const mapping = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '1d': '1d',
      '1w': '1wk'
    };

    // Yahoo usually does NOT support 4h directly
    return mapping[interval] || '1d';
  }

  convertIntervalForAlphaVantage(interval) {
    const mapping = {
      '1m': '1min',
      '5m': '5min',
      '15m': '15min',
      '30m': '30min',
      '1h': '60min'
    };

    // FIXED: 4h is not valid in Alpha Vantage FX intraday
    return mapping[interval] || '60min';
  }

  async cachePrice(symbol, price) {
    try {
      if (!redisClient || typeof redisClient.setEx !== 'function') {
        return;
      }

      const cacheKey = `price:${symbol}`;
      await redisClient.setEx(
        cacheKey,
        this.CACHE_DURATION.PRICE,
        price.toString()
      );
    } catch (error) {
      logger.error(`Error caching price for ${symbol}:`, error);
    }
  }

  /**
   * Enforce rate limit for CoinGecko FREE tier (50 calls/minute)
   * Uses a queue to handle concurrent requests properly
   */
  async queueCoingeckoRequest(requestFn) {
    throw new Error('queueCoingeckoRequest removed: CoinGecko integration disabled');
  }

  /**
   * Process CoinGecko request queue with rate limiting
   */
  async processCoingeckoQueue() {
    throw new Error('processCoingeckoQueue removed: CoinGecko integration disabled');
  }

  // ============================================================
  // WATCHLIST METHODS
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
  // PRICE ALERT METHODS
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

  /**
   * Returns a flat list of tradeable assets with live prices.
   * Called by GET /api/market/assets → frontend BrowseMarket + Trading page.
   */
  async getMarketAssets() {
    const cacheKey = 'market:assets:v1';
    try {
      if (redisClient?.isOpen) {
        const hit = await redisClient.get(cacheKey).catch(() => null);
        if (hit) return JSON.parse(hit);
      }
    } catch { /* cache miss */ }

    const symbols = [
      'BTC','ETH','SOL','XRP','ADA','DOGE','DOT','MATIC',
      'LINK','AVAX','LTC','UNI','ALGO','NEAR','ATOM','ARB',
    ];
    const nameMap = {
      BTC:'Bitcoin',ETH:'Ethereum',SOL:'Solana',XRP:'Ripple',
      ADA:'Cardano',DOGE:'Dogecoin',DOT:'Polkadot',MATIC:'Polygon',
      LINK:'Chainlink',AVAX:'Avalanche',LTC:'Litecoin',UNI:'Uniswap',
      ALGO:'Algorand',NEAR:'NEAR Protocol',ATOM:'Cosmos',ARB:'Arbitrum',
    };

    let prices = {};
    try { prices = await krakenService.getLivePrices(symbols); }
    catch (e) { logger.error('getMarketAssets: Kraken failed', e.message); }

    const assets = symbols.map(symbol => {
      const d = prices[symbol];
      return {
        id:              symbol.toLowerCase(),
        symbol,
        name:            nameMap[symbol] || symbol,
        type:            'crypto',
        price:           d?.price    ?? null,
        change24h:       d?.change24h ?? null,
        volume24h:       d?.volume24h ?? null,
        marketCap:       d?.marketCap ?? null,
        priceUnavailable: !d || d.price === null,
      };
    });

    try {
      if (redisClient?.isOpen) {
        await redisClient.setEx(cacheKey, 30, JSON.stringify(assets)).catch(() => {});
      }
    } catch { /* non-critical */ }

    return assets;
  }

  /**
   * Get live market summary with Fear & Greed index, top movers, BTC dominance.
   */
  async getMarketSummary() {
    const cacheKey = 'market:summary:v2';
    try {
      if (redisClient?.isOpen) {
        const hit = await redisClient.get(cacheKey).catch(() => null);
        if (hit) return JSON.parse(hit);
      }
    } catch { /* miss */ }

    // Fear & Greed (free, no key)
    let fearGreedIndex = 50;
    try {
      const fng = await axios.get('https://api.alternative.me/fng/?limit=1', { timeout: 5000 });
      fearGreedIndex = parseInt(fng.data?.data?.[0]?.value ?? '50', 10);
    } catch { /* use 50 */ }

    // CoinGecko global (free tier — no key needed for this endpoint)
    let totalMarketCap = null, volume24h = null, btcDominance = null;
    try {
      const g = await axios.get('https://api.coingecko.com/api/v3/global', { timeout: 8000 });
      const d = g.data?.data;
      totalMarketCap = d?.total_market_cap?.usd  ?? null;
      volume24h      = d?.total_volume?.usd       ?? null;
      btcDominance   = d?.market_cap_percentage?.btc ?? null;
    } catch { /* non-critical */ }

    // Top movers from Kraken
    const topSyms = ['BTC','ETH','SOL','XRP','ADA','AVAX','DOGE','LINK','DOT','MATIC'];
    const nameMap = {
      BTC:'Bitcoin',ETH:'Ethereum',SOL:'Solana',XRP:'Ripple',
      ADA:'Cardano',AVAX:'Avalanche',DOGE:'Dogecoin',LINK:'Chainlink',
      DOT:'Polkadot',MATIC:'Polygon',
    };
    let movers = [];
    try {
      const prices = await krakenService.getLivePrices(topSyms);
      movers = topSyms
        .map(s => ({ symbol: s, name: nameMap[s] || s, change: prices[s]?.change24h ?? null }))
        .filter(m => m.change !== null)
        .sort((a, b) => b.change - a.change);
    } catch { /* non-critical */ }

    const topGainer = movers[0]                  ? { ...movers[0],                  change: +movers[0].change.toFixed(2) }                  : null;
    const topLoser  = movers[movers.length - 1]  ? { ...movers[movers.length - 1],  change: +movers[movers.length - 1].change.toFixed(2) }  : null;

    const summary = {
      timestamp: new Date().toISOString(),
      totalMarketCap, volume24h, btcDominance, fearGreedIndex,
      topGainer, topLoser,
      source: 'kraken+coingecko+alternative.me',
    };

    try {
      if (redisClient?.isOpen) {
        await redisClient.setEx(cacheKey, 120, JSON.stringify(summary)).catch(() => {});
      }
    } catch { /* non-critical */ }

    return summary;
  }
}

module.exports = new MarketService();
