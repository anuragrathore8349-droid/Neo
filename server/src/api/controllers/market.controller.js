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
        let unavailable  = false;

        if (!data || data.price === null || data.price === undefined) {
          unavailable = true;
        } else if (typeof data === 'number') {
          priceValue = data;
        } else if (typeof data === 'object') {
          priceValue  = Number(data.price)   || 0;
          changeValue = Number(data.change24h) || 0;
          volume24h   = data.volume24h ?? null;
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
          priceUnavailable: unavailable,  // frontend uses this to show "—" instead of "$0"
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
      res.json({
        status: 'success',
        data: prices
      });
    } catch (error) {
      next(error);
    }
  }

  async getSymbolPrice(req, res, next) {
    try {
      const { symbol } = req.validatedData.params;
      const price = await marketService.getSymbolPrice(symbol);
      res.json({
        status: 'success',
        data: price
      });
    } catch (error) {
      next(error);
    }
  }

  async getPriceHistory(req, res, next) {
    try {
      const { symbol } = req.validatedData.params;
      const { interval, from, to } = req.validatedData.query || {};
      const history = await marketService.getPriceHistory(symbol, interval, from, to);
      res.json({
        status: 'success',
        data: history
      });
    } catch (error) {
      next(error);
    }
  }

  async getTrendingAssets(req, res, next) {
    try {
      const trending = await marketService.getTrendingAssets();
      res.json({
        status: 'success',
        data: trending
      });
    } catch (error) {
      next(error);
    }
  }

  async searchAssets(req, res, next) {
    try {
      const { query, type } = req.validatedData.query || {};
      const results = await marketService.searchAssets(query, type);
      res.json({
        status: 'success',
        data: results
      });
    } catch (error) {
      next(error);
    }
  }

  async getAssetDetails(req, res, next) {
    try {
      const { symbol } = req.validatedData.params;
      const details = await marketService.getAssetDetails(symbol);
      res.json({
        status: 'success',
        data: details
      });
    } catch (error) {
      next(error);
    }
  }

  async getWatchlist(req, res, next) {
    try {
      const watchlist = await marketService.getWatchlist(req.user.userId);
      res.json({
        status: 'success',
        data: watchlist
      });
    } catch (error) {
      next(error);
    }
  }

  async addToWatchlist(req, res, next) {
    try {
      const { symbol } = req.validatedData.params;
      await marketService.addToWatchlist(req.user.userId, symbol);
      res.json({
        status: 'success',
        message: 'Asset added to watchlist'
      });
    } catch (error) {
      next(error);
    }
  }

  async removeFromWatchlist(req, res, next) {
    try {
      const { symbol } = req.validatedData.params;
      await marketService.removeFromWatchlist(req.user.userId, symbol);
      res.json({
        status: 'success',
        message: 'Asset removed from watchlist'
      });
    } catch (error) {
      next(error);
    }
  }

  async createPriceAlert(req, res, next) {
    try {
      const alert = await marketService.createPriceAlert(
        req.user.userId,
        req.validatedData.body
      );
      res.json({
        status: 'success',
        data: alert
      });
    } catch (error) {
      next(error);
    }
  }

  async getPriceAlerts(req, res, next) {
    try {
      const alerts = await marketService.getPriceAlerts(req.user.userId);
      res.json({
        status: 'success',
        data: alerts
      });
    } catch (error) {
      next(error);
    }
  }

  async deletePriceAlert(req, res, next) {
    try {
      const { id } = req.validatedData.params;
      await marketService.deletePriceAlert(req.user.userId, id);
      res.json({
        status: 'success',
        message: 'Price alert deleted'
      });
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

      const tf = timeframe.toLowerCase();
      const multiplierMap = { '1h': 1 / 24, '24h': 1, '1d': 1, '7d': 7, '30d': 30 };
      const mult = multiplierMap[tf] ?? 1;

      let totalVolume24h = 0;
      let topGainer = null;
      let topLoser  = null;
      let maxGain   = -Infinity;
      let maxLoss   =  Infinity;

      const entries = Object.entries(prices).filter(
        ([, d]) => d && typeof d === 'object' && d.price > 0,
      );

      for (const [symbol, data] of entries) {
        const vol    = (data.volume24h  || 0) * mult;
        const change = (data.change24h  || 0) * mult;
        totalVolume24h += vol;

        if (change > maxGain) {
          maxGain   = change;
          topGainer = { name: getAssetName(symbol), symbol, change: parseFloat(change.toFixed(2)) };
        }
        if (change < maxLoss) {
          maxLoss  = change;
          topLoser = { name: getAssetName(symbol), symbol, change: parseFloat(change.toFixed(2)) };
        }
      }

      const avgChange = entries.length
        ? entries.reduce((s, [, d]) => s + (d.change24h || 0), 0) / entries.length
        : 0;

      const fearGreedIndex = Math.round(Math.min(100, Math.max(0, 50 + avgChange * 4)));
      const fearGreedLabel =
        fearGreedIndex >= 75 ? 'Extreme Greed' :
        fearGreedIndex >= 55 ? 'Greed'         :
        fearGreedIndex >= 45 ? 'Neutral'        :
        fearGreedIndex >= 25 ? 'Fear'           : 'Extreme Fear';

      const volumeChange = parseFloat((avgChange * 0.6).toFixed(2));

      const summary = {
        // totalMarketCap intentionally omitted — Kraken does not provide cap data
        // Frontend checks for this and shows volume instead
        totalMarketCap:    null,
        totalVolume24h:    parseFloat(totalVolume24h.toFixed(2)),
        volume24h:         parseFloat(totalVolume24h.toFixed(2)),
        marketCapChange:   parseFloat(avgChange.toFixed(2)),
        volumeChange,
        btcDominance:      null,  // not calculable without market cap
        fearGreedIndex,
        fearGreedLabel,
        topGainer:  topGainer || null,
        topLoser:   topLoser  || null,
        assetCount: entries.length,
        dataSource: 'kraken',
      };

      return res.json({ status: 'success', data: summary });
    } catch (error) {
      next(error);
    }
  }
  async getAvailableAssets(req, res, next) {
    try {
      const prices = await marketService.getMarketPrices(POPULAR_ASSETS);
      const formatted = POPULAR_ASSETS.map((symbol) => {
        const data = prices[symbol];
        let priceValue = 0;
        if (typeof data === 'number') priceValue = data;
        else if (data && typeof data === 'object') priceValue = Number(data.price) || 0;
        return {
          id: symbol.toLowerCase(), name: getAssetName(symbol),
          symbol, type: 'crypto', price: Number(priceValue),
        };
      });
      return res.json({ status: 'success', data: formatted });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MarketController();