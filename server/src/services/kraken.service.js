const axios = require('axios');
const { logger } = require('../api/middlewares/logger.middleware');
const { redisClient } = require('../config/database');

/**
 * Kraken Service - Free real-time crypto prices without KYC
 * Uses only public endpoints (no API key required)
 */
class KrakenService {
  constructor() {
    this.baseUrl = process.env.KRAKEN_API_URL || 'https://api.kraken.com/0/public';
    this.CACHE_DURATION = {
      PRICE: 30,      // 30 seconds for real-time prices
      HISTORY: 300    // 5 minutes for historical data
    };

    this.symbolMap = {
      'BTC':   'XBT',   // Kraken uses XBT for Bitcoin
      'ETH':   'ETH',
      'SOL':   'SOL',
      'XRP':   'XRP',
      'ADA':   'ADA',
      'DOGE':  'DOGE',
      'DOT':   'DOT',
      'MATIC': 'POL',   // FIXED: Polygon rebranded; Kraken lists as POL
      'POL':   'POL',
      'LINK':  'LINK',
      'AVAX':  'AVAX',
      'LTC':   'LTC',
      'USDT':  'USDT',
      'USDC':  'USDC',
      'BNB':   'BNB',
      'XLM':   'XLM',
      'TRX':   'TRX',
      'ETC':   'ETC',
      'UNI':   'UNI',
      'ALGO':  'ALGO',
      'ICP':   'ICP',
      'NEAR':  'NEAR',
      'ATOM':  'ATOM',
      'ARB':   'ARB',
      'OP':    'OP',
      'APT':   'APT',
      'SUI':   'SUI',
      'PEPE':  'PEPE',
      'FIL':   'FIL',
      'HBAR':  'HBAR',
      'VET':   'VET',
      'FLOW':  'FLOW',
      'SAND':  'SAND',
      'MANA':  'MANA',
      'AXS':   'AXS',
      'CHZ':   'CHZ',
      'MKR':   'MKR',
      'AAVE':  'AAVE',
      'SNX':   'SNX',
      'COMP':  'COMP',
      'YFI':   'YFI',
      'BAT':   'BAT',
      'ENJ':   'ENJ',
    };

    // Tokens Kraken has delisted or never listed
    this.unsupportedSymbols = new Set([
      'CRV', 'FTM', 'CAKE', 'RUNE', 'SUSHI', 'BAL', 'REN', 'KNC',
      'ZRX', 'REP', 'GNT', 'STORJ', 'ANT', 'OMG', 'FTT',
    ]);
  }

  /**
   * Get live price from Kraken for a symbol
   * @param {String} symbol - Asset symbol (e.g., 'BTC', 'ETH')
   * @returns {Promise<Object>} Price data with OHLC
   */
  async getLivePrice(symbol) {
    try {
      const krakenSymbol = this.mapSymbolToKraken(symbol);
      if (!krakenSymbol) {
        throw new Error(`Symbol ${symbol} not supported on Kraken`);
      }

      const cacheKey = `kraken:price:${symbol}`;

      // Check cache
      if (redisClient && redisClient.isOpen) {
        try {
          const cached = await redisClient.get(cacheKey);
          if (cached) {
            logger.debug(`Cache HIT for Kraken ${symbol}`);
            return JSON.parse(cached);
          }
        } catch (error) {
          logger.warn('Redis cache read failed:', error.message);
        }
      }

      // Fetch from Kraken
      const pairName = `${krakenSymbol}USD`;
      const response = await axios.get(`${this.baseUrl}/Ticker`, {
        params: { pair: pairName },
        timeout: 10000
      });

      if (!response.data) {
        throw new Error(`No response from Kraken for ${pairName}`);
      }

      if (response.data.error && response.data.error.length > 0) {
        const errorMsg = response.data.error.join(', ');
        logger.warn(`Kraken Ticker API error for ${pairName}:`, errorMsg);
        throw new Error(`Kraken API error: ${errorMsg}`);
      }

      if (!response.data.result) {
        throw new Error(`No result data from Kraken for ${pairName}`);
      }

      // Extract price data from result - get first (and usually only) entry
      const result = Object.values(response.data.result)[0];
      if (!result) {
        logger.warn(`Kraken Ticker returned no data for ${pairName}. Available keys:`, Object.keys(response.data.result));
        throw new Error(`No data for ${pairName} from Kraken`);
      }

      const priceData = {
        symbol,
        price: parseFloat(result.c[0]),           // Last trade close price
        change24h: (parseFloat(result.o) > 0) ? 
          ((parseFloat(result.c[0]) - parseFloat(result.o)) / parseFloat(result.o) * 100) : 0,
        volume24h: parseFloat(result.v[1]) || 0, // Volume last 24h
        high24h: parseFloat(result.h[1]) || 0,
        low24h: parseFloat(result.l[1]) || 0,
        lastUpdated: new Date().toISOString(),
        source: 'kraken'
      };

      // Cache the result
      if (redisClient && redisClient.isOpen) {
        try {
          await redisClient.setEx(cacheKey, this.CACHE_DURATION.PRICE, JSON.stringify(priceData));
        } catch (error) {
          logger.warn('Redis cache write failed:', error.message);
        }
      }

      logger.debug(`Kraken price for ${symbol}: $${priceData.price}`);
      return priceData;
    } catch (error) {
      logger.error(`Error fetching Kraken price for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get multiple prices at once
   * @param {Array} symbols - Array of symbols
   * @returns {Promise<Object>} Map of symbol to price data
   */
  async getLivePrices(symbols) {
    try {
      const results = {};
      const failures = [];

      // Fetch prices in parallel
      const promises = symbols.map(async (symbol) => {
        try {
          const priceData = await this.getLivePrice(symbol);
          results[symbol] = priceData;
        } catch (error) {
          failures.push({ symbol, error: error.message });
        }
      });

      await Promise.all(promises);

      if (failures.length > 0) {
        logger.warn(`Kraken failed for symbols:`, failures);
      }

      return results;
    } catch (error) {
      logger.error('Error fetching Kraken prices:', error);
      throw error;
    }
  }

  /**
   * Get historical OHLC data from Kraken
   * @param {String} symbol - Asset symbol
   * @param {String} interval - Time interval ('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w')
   * @param {String} since - Start date (ISO string)
   * @returns {Promise<Array>} Array of OHLC candles
   */
  async getHistoricalData(symbol, interval = '1d', since = null) {
    try {
      const krakenSymbol = this.mapSymbolToKraken(symbol);
if (!krakenSymbol) {
  return {
    symbol,
    price: null,
    error: 'unsupported_on_kraken',
    source: 'kraken'
  };
}
      const cacheKey = `kraken:history:${symbol}:${interval}:${since || 'all'}`;

      // Check cache
      if (redisClient && redisClient.isOpen) {
        try {
          const cached = await redisClient.get(cacheKey);
          if (cached) {
            logger.debug(`Cache HIT for Kraken history ${symbol}`);
            return JSON.parse(cached);
          }
        } catch (error) {
          logger.warn('Redis cache read failed:', error.message);
        }
      }

      // Map interval to Kraken format
      const intervalMap = {
        '1m': 1,
        '5m': 5,
        '15m': 15,
        '30m': 30,
        '1h': 60,
        '4h': 240,
        '1d': 1440,
        '1w': 10080
      };

      const krakenInterval = intervalMap[interval] || 1440;
      const pairName = `${krakenSymbol}USD`;

      const params = {
        pair: pairName,
        interval: krakenInterval
      };

      if (since) {
        params.since = Math.floor(new Date(since).getTime() / 1000);
      }

      const response = await axios.get(`${this.baseUrl}/OHLC`, {
        params,
        timeout: 10000
      });

      if (!response.data) {
        throw new Error(`No response from Kraken for ${pairName}`);
      }

      if (response.data.error && response.data.error.length > 0) {
        const errorMsg = response.data.error.join(', ');
        logger.warn(`Kraken API error for ${pairName}:`, errorMsg);
        throw new Error(`Kraken API error: ${errorMsg}`);
      }

      // Extract OHLC data - result is an object where first key is the pair, last key is 'last'
      const result = response.data.result;
      if (!result) {
        throw new Error(`No result data from Kraken for ${pairName}`);
      }

      // Get the first key that is not 'last' - that's our OHLC data
      const ohlcData = result[Object.keys(result).find(key => key !== 'last')];
      
      if (!Array.isArray(ohlcData) || ohlcData.length === 0) {
        logger.warn(`Kraken returned empty OHLC array for ${pairName}. All keys:`, Object.keys(result));
        throw new Error(`No historical data returned from Kraken for ${pairName}`);
      }

      // Convert Kraken OHLC format to standard format
      const candles = ohlcData
        .filter(ohlc => Array.isArray(ohlc) && ohlc.length >= 6)
        .map(([time, open, high, low, close, vwap, volume, count]) => ({
          timestamp: parseInt(time) * 1000,  // Convert seconds to milliseconds
          open: parseFloat(open),
          high: parseFloat(high),
          low: parseFloat(low),
          close: parseFloat(close),
          volume: parseFloat(volume)
        }))
        .filter(c => c.timestamp && c.close > 0);  // Filter out invalid candles

      if (candles.length === 0) {
        throw new Error(`No valid candles extracted from Kraken for ${pairName}`);
      }

      // Cache the result
      if (redisClient && redisClient.isOpen) {
        try {
          await redisClient.setEx(cacheKey, this.CACHE_DURATION.HISTORY, JSON.stringify(candles));
        } catch (error) {
          logger.warn('Redis cache write failed:', error.message);
        }
      }

      logger.debug(`Kraken historical data for ${symbol}: ${candles.length} candles`);
      return candles;
    } catch (error) {
      logger.error(`Error fetching Kraken historical data for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Map common symbol names to Kraken asset names
   */
  mapSymbolToKraken(symbol) {
    if (!symbol) return null;
    const upper = symbol.toUpperCase();
    if (this.unsupportedSymbols && this.unsupportedSymbols.has(upper)) return null;
    return this.symbolMap[upper] || upper;
  }

  /**
   * Check if symbol is available on Kraken
   */
  isSymbolSupported(symbol) {
    if (!symbol) return false;
    const upper = symbol.toUpperCase();
    if (this.unsupportedSymbols && this.unsupportedSymbols.has(upper)) return false;
    if (upper in this.symbolMap) return true;
    return true; // allow unlisted symbols — Kraken may support them
  }
}

module.exports = new KrakenService();
