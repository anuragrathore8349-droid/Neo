const marketService = require('../../services/market.service');
const { logger } = require('../middlewares/logger.middleware');

const POPULAR_ASSETS = [
  'BTC', 'ETH', 'USDT', 'BNB', 'USDC', 'XRP', 'ADA', 'SOL', 'DOT', 'DOGE',
  'AVAX', 'POL', 'LTC', 'ETC', 'LINK', 'UNI', 'ALGO', 'ICP', 'FIL', 'TRX',
];

const ASSET_NAMES = {
  'BTC':  'Bitcoin',           'ETH':  'Ethereum',        'USDT': 'Tether',
  'BNB':  'Binance Coin',      'USDC': 'USD Coin',        'XRP':  'Ripple',
  'ADA':  'Cardano',           'SOL':  'Solana',          'DOT':  'Polkadot',
  'DOGE': 'Dogecoin',          'AVAX': 'Avalanche',       'POL':  'Polygon',
  'MATIC':'Polygon',           'LTC':  'Litecoin',        'ETC':  'Ethereum Classic',
  'LINK': 'Chainlink',         'UNI':  'Uniswap',         'ALGO': 'Algorand',
  'ICP':  'Internet Computer', 'FIL':  'Filecoin',        'TRX':  'TRON',
};

// Approximate circulating supply for market-cap estimation when exchange doesn't provide it
const CIRCULATING_SUPPLY = {
  BTC:  19_700_000,   ETH:   120_000_000,  USDT: 110_000_000_000,
  BNB:   147_000_000, USDC:   35_000_000_000, XRP: 57_000_000_000,
  ADA:  35_000_000_000, SOL: 460_000_000,   DOT: 1_400_000_000,
  DOGE: 145_000_000_000, AVAX: 410_000_000, POL: 9_300_000_000,
  LTC:   74_000_000,  ETC:   140_000_000,  LINK: 600_000_000,
  UNI:   600_000_000, ALGO: 8_000_000_000, ICP:  500_000_000,
  FIL:   500_000_000, TRX:  87_000_000_000,
};

const getAssetName = (symbol) => ASSET_NAMES[symbol] || symbol;

class MarketController {
  async getMarketAssets(req, res, next) {
    try {
      let prices = {};
      try {
        prices = await marketService.getMarketPrices(POPULAR_ASSETS);
      } catch (error) {
        logger.error('Failed to fetch live prices:', error.message);
        return res.status(503).json({
          status: 'error',
          message: 'Market data temporarily unavailable. Please try again shortly.',
          code: 'MARKET_DATA_UNAVAILABLE',
        });
      }

      const assets = POPULAR_ASSETS.map((symbol) => {
        const data = prices[symbol];
        let priceValue   = 0;
        let changeValue  = 0;
        let volume24h    = null;
        let marketCap    = null;
        let unavailable  = false;

        if (!data || data.price === null || data.price === undefined) {
          unavailable = true;
        } else if (typeof data === 'number') {
          priceValue = data;
        } else if (typeof data === 'object') {
          priceValue  = Number(data.price)    || 0;
          changeValue = Number(data.change24h) || 0;
          volume24h   = data.volume24h ?? null;
          // Compute market cap: use exchange value if present, else supply * price
          if (data.marketCap && data.marketCap > 0) {
            marketCap = data.marketCap;
          } else if (priceValue > 0 && CIRCULATING_SUPPLY[symbol]) {
            marketCap = priceValue * CIRCULATING_SUPPLY[symbol];
          }
          if (data.error) unavailable = true;
        }

        if (isNaN(priceValue)) { priceValue = 0; unavailable = true; }

        return {
          id:               symbol.toLowerCase(),
          name:             getAssetName(symbol),
          symbol,
          type:             'crypto',
          price:            priceValue,
          change24h:        changeValue,
          volume24h,
          marketCap,
          priceUnavailable: unavailable,
        };
      });

      logger.info('Market assets sent: ' + assets.map(a => `${a.symbol}:${a.price}`).join(', '));
      return res.json({ status: 'success', data: assets });
    } catch (error) {
      next(error);
    }
  }

  async getPrices(req, res, next) {
    try {
      const { symbols } = req.validatedData.query || {};
      const prices = await marketService.getMarketPrices(symbols);
      res.json({ status: 'success', data: prices });
    } catch (error) {
      next(error);
    }
  }

  async getSymbolPrice(req, res, next) {
    try {
      const { symbol } = req.validatedData.params;
      const price = await marketService.getSymbolPrice(symbol);
      res.json({ status: 'success', data: price });
    } catch (error) {
      next(error);
    }
  }

  async getPriceHistory(req, res, next) {
    try {
      const { symbol } = req.validatedData.params;
      const { interval, from, to } = req.validatedData.query || {};
      const history = await marketService.getPriceHistory(symbol, interval, from, to);
      res.json({ status: 'success', data: history });
    } catch (error) {
      next(error);
    }
  }

  async getTrendingAssets(req, res, next) {
    try {
      const trending = await marketService.getTrendingAssets();
      res.json({ status: 'success', data: trending });
    } catch (error) {
      next(error);
    }
  }

  async searchAssets(req, res, next) {
    try {
      const { query, type } = req.validatedData.query || {};
      const results = await marketService.searchAssets(query, type);
      res.json({ status: 'success', data: results });
    } catch (error) {
      next(error);
    }
  }

  async getAssetDetails(req, res, next) {
    try {
      const { symbol } = req.validatedData.params;
      const details = await marketService.getAssetDetails(symbol);
      res.json({ status: 'success', data: details });
    } catch (error) {
      next(error);
    }
  }

  async getMarketSummary(req, res, next) {
    try {
      const { timeframe = '24h' } = req.query || {};

      let prices = {};
      try {
        prices = await marketService.getMarketPrices(POPULAR_ASSETS);
      } catch (error) {
        logger.error('Market summary price fetch failed:', error.message);
        return res.status(503).json({
          status: 'error',
          message: 'Market summary temporarily unavailable.',
          code: 'MARKET_DATA_UNAVAILABLE',
        });
      }

      let totalVolume24h = 0;
      let topGainer = null;
      let topLoser  = null;
      let maxGain   = -Infinity;
      let maxLoss   =  Infinity;

      const entries = Object.entries(prices).filter(
        ([, d]) => d && typeof d === 'object' && d.price > 0,
      );

      // ─── THIS LOOP WAS MISSING — now populates topGainer, topLoser, totalVolume ───
      entries.forEach(([symbol, d]) => {
        const change = typeof d.change24h === 'number' ? d.change24h : 0;
        const vol    = typeof d.volume24h === 'number' ? d.volume24h : 0;
        totalVolume24h += vol;

        if (change > maxGain) {
          maxGain   = change;
          topGainer = { symbol, name: getAssetName(symbol), change: parseFloat(change.toFixed(2)) };
        }
        if (change < maxLoss) {
          maxLoss  = change;
          topLoser = { symbol, name: getAssetName(symbol), change: parseFloat(change.toFixed(2)) };
        }
      });

      const btcData = prices['BTC'] || {};
      const ethData = prices['ETH'] || {};

      // Market cap: use real supply-based estimates
      const totalMarketCap = entries.reduce((s, [sym, d]) => {
        const price = d.price || 0;
        const mc    = (d.marketCap && d.marketCap > 0)
          ? d.marketCap
          : price * (CIRCULATING_SUPPLY[sym] || 0);
        return s + mc;
      }, 0);

      const btcMarketCap = (btcData.marketCap && btcData.marketCap > 0)
        ? btcData.marketCap
        : (btcData.price || 0) * CIRCULATING_SUPPLY['BTC'];
      const ethMarketCap = (ethData.marketCap && ethData.marketCap > 0)
        ? ethData.marketCap
        : (ethData.price || 0) * CIRCULATING_SUPPLY['ETH'];

      const btcDominance = totalMarketCap > 0
        ? parseFloat(((btcMarketCap / totalMarketCap) * 100).toFixed(1)) : 0;
      const ethDominance = totalMarketCap > 0
        ? parseFloat(((ethMarketCap / totalMarketCap) * 100).toFixed(1)) : 0;

      const btcChange      = btcData.change24h || 0;
      const fearGreedIndex = Math.min(100, Math.max(0, Math.round(50 + btcChange * 2)));
      const fearGreedLabel =
        fearGreedIndex >= 75 ? 'Extreme Greed' :
        fearGreedIndex >= 55 ? 'Greed' :
        fearGreedIndex >= 45 ? 'Neutral' :
        fearGreedIndex >= 25 ? 'Fear' : 'Extreme Fear';

      return res.json({
        status: 'success',
        data: {
          totalMarketCap,
          volume24h:       totalVolume24h,
          topGainer:       topGainer || { symbol: 'N/A', name: 'N/A', change: 0 },
          topLoser:        topLoser  || { symbol: 'N/A', name: 'N/A', change: 0 },
          fearGreedIndex,
          fearGreedLabel,
          btcDominance,
          ethDominance,
          altcoinDominance: parseFloat((100 - btcDominance - ethDominance).toFixed(1)),
          timeframe,
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAvailableAssets(req, res, next) {
    try {
      const assets = await marketService.getMarketAssets();
      const stockSymbols = ['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'NFLX'];
      const stockPrices  = await marketService.getStockPrices(stockSymbols);
      const stocks = stockSymbols.map(sym => ({
        id: sym.toLowerCase(), symbol: sym, name: sym, type: 'stock',
        price:    stockPrices[sym]?.price    ?? null,
        change24h: stockPrices[sym]?.change24h ?? null,
      }));
      res.json({ status: 'success', data: { crypto: assets, stocks } });
    } catch (error) {
      next(error);
    }
  }

  async getWatchlist(req, res, next) {
    try {
      const userId = req.user.id;
      const watchlist = await marketService.getWatchlist(userId);
      res.json({ status: 'success', data: watchlist });
    } catch (error) {
      next(error);
    }
  }

  async addToWatchlist(req, res, next) {
    try {
      const userId = req.user.id;
      const { symbol } = req.params;
      const result = await marketService.addToWatchlist(userId, symbol);
      res.json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  async removeFromWatchlist(req, res, next) {
    try {
      const userId = req.user.id;
      const { symbol } = req.params;
      const result = await marketService.removeFromWatchlist(userId, symbol);
      res.json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  async createPriceAlert(req, res, next) {
    try {
      const userId = req.user.id;
      const result = await marketService.createPriceAlert(userId, req.body);
      res.json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  async getPriceAlerts(req, res, next) {
    try {
      const userId = req.user.id;
      const alerts = await marketService.getPriceAlerts(userId);
      res.json({ status: 'success', data: alerts });
    } catch (error) {
      next(error);
    }
  }

  async deletePriceAlert(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const result = await marketService.deletePriceAlert(userId, id);
      res.json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MarketController();
