const marketService = require('../../services/market.service');
const { logger } = require('../middlewares/logger.middleware');

const POPULAR_ASSETS = [
  'BTC', 'ETH', 'USDT', 'BNB', 'USDC', 'XRP', 'ADA', 'SOL', 'DOT', 'DOGE',
  'AVAX', 'POL', 'LTC', 'ETC', 'LINK', 'UNI', 'ALGO', 'ICP', 'FIL', 'TRX',
];

const ASSET_NAMES = {
  BTC: 'Bitcoin', ETH: 'Ethereum', USDT: 'Tether', BNB: 'Binance Coin',
  USDC: 'USD Coin', XRP: 'Ripple', ADA: 'Cardano', SOL: 'Solana',
  DOT: 'Polkadot', DOGE: 'Dogecoin', AVAX: 'Avalanche', POL: 'Polygon',
  MATIC: 'Polygon', LTC: 'Litecoin', ETC: 'Ethereum Classic',
  LINK: 'Chainlink', UNI: 'Uniswap', ALGO: 'Algorand',
  ICP: 'Internet Computer', FIL: 'Filecoin', TRX: 'TRON',
};

const CIRCULATING_SUPPLY = {
  BTC: 19_700_000, ETH: 120_000_000, USDT: 110_000_000_000,
  BNB: 147_000_000, USDC: 35_000_000_000, XRP: 57_000_000_000,
  ADA: 35_000_000_000, SOL: 460_000_000, DOT: 1_400_000_000,
  DOGE: 145_000_000_000, AVAX: 410_000_000, POL: 9_300_000_000,
  LTC: 74_000_000, ETC: 140_000_000, LINK: 600_000_000,
  UNI: 600_000_000, ALGO: 8_000_000_000, ICP: 500_000_000,
  FIL: 500_000_000, TRX: 87_000_000_000,
};

const getAssetName = (symbol) => ASSET_NAMES[symbol] || symbol;

class MarketController {
  async getMarketAssets(req, res, next) {
    try {
      const { timeframe = '24h' } = req.query || {};

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

      // Multipliers to estimate change for timeframes when only change24h is available
      const TIMEFRAME_MULTIPLIERS = {
        '1h':  1 / 24,
        '24h': 1,
        '7d':  3.5,
        '30d': 12,
      };
      const multiplier = TIMEFRAME_MULTIPLIERS[timeframe] ?? 1;

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
          changeValue = typeof data[`change${timeframe}`] === 'number'
            ? Number(data[`change${timeframe}`])
            : Number(data.change24h || 0) * multiplier;
          volume24h   = data.volume24h ?? null;
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

      logger.info(`Market assets sent (timeframe=${timeframe}): ` + assets.map(a => `${a.symbol}:${a.price}`).join(', '));
      return res.json({ status: 'success', data: assets });
    } catch (error) {
      next(error);
    }
  }

  async getMarketSummary(req, res, next) {
    try {
      // Try to get live prices to compute a real summary
      let prices = {};
      try {
        prices = await marketService.getMarketPrices(POPULAR_ASSETS);
      } catch (err) {
        logger.warn('getMarketSummary: price fetch failed, returning partial summary:', err.message);
      }

      let totalMarketCap = 0;
      let volume24h = 0;
      let btcDominance = 0;
      let topGainer = { name: 'N/A', symbol: 'N/A', change: 0 };
      let topLoser = { name: 'N/A', symbol: 'N/A', change: 0 };

      const assetList = [];

      for (const symbol of POPULAR_ASSETS) {
        const data = prices[symbol];
        if (!data || typeof data !== 'object') continue;

        const price = Number(data.price) || 0;
        const change = Number(data.change24h) || 0;
        const vol = Number(data.volume24h) || 0;
        let cap = Number(data.marketCap) || 0;
        if (cap === 0 && price > 0 && CIRCULATING_SUPPLY[symbol]) {
          cap = price * CIRCULATING_SUPPLY[symbol];
        }

        totalMarketCap += cap;
        volume24h += vol;
        assetList.push({ symbol, name: getAssetName(symbol), change, marketCap: cap });
      }

      // BTC dominance
      const btcData = assetList.find(a => a.symbol === 'BTC');
      if (btcData && totalMarketCap > 0) {
        btcDominance = (btcData.marketCap / totalMarketCap) * 100;
      }

      // Top gainer / loser from the live data
      const sorted = [...assetList].sort((a, b) => b.change - a.change);
      if (sorted.length > 0) {
        topGainer = { name: sorted[0].name, symbol: sorted[0].symbol, change: sorted[0].change };
        topLoser  = { name: sorted[sorted.length - 1].name, symbol: sorted[sorted.length - 1].symbol, change: sorted[sorted.length - 1].change };
      }

      // Fear & Greed: simple heuristic based on average positive/negative assets
      const positive = assetList.filter(a => a.change > 0).length;
      const fearGreedIndex = assetList.length > 0 ? Math.round((positive / assetList.length) * 100) : 50;

      return res.json({
        status: 'success',
        data: {
          totalMarketCap,
          volume24h,
          btcDominance: parseFloat(btcDominance.toFixed(2)),
          fearGreedIndex,
          topGainer,
          topLoser,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getPrices(req, res, next) {
    try {
      const { symbols } = req.validatedData.query || {};
      const prices = await marketService.getMarketPrices(symbols);
      res.json({ status: 'success', data: prices });
    } catch (error) { next(error); }
  }

  async getSymbolPrice(req, res, next) {
    try {
      const { symbol } = req.validatedData.params;
      const price = await marketService.getSymbolPrice(symbol);
      res.json({ status: 'success', data: price });
    } catch (error) { next(error); }
  }

  async getPriceHistory(req, res, next) {
    try {
      const { symbol } = req.validatedData.params;
      const { interval, from, to } = req.validatedData.query || {};
      const history = await marketService.getPriceHistory(symbol, interval, from, to);
      res.json({ status: 'success', data: history });
    } catch (error) { next(error); }
  }

  async getTrendingAssets(req, res, next) {
    try {
      const trending = await marketService.getTrendingAssets();
      res.json({ status: 'success', data: trending });
    } catch (error) { next(error); }
  }

  async searchAssets(req, res, next) {
    try {
      const { query } = req.validatedData.query || {};
      const results = await marketService.searchAssets(query);
      res.json({ status: 'success', data: results });
    } catch (error) { next(error); }
  }

  async getAssetDetails(req, res, next) {
    try {
      const { symbol } = req.validatedData.params;
      const details = await marketService.getAssetDetails(symbol);
      res.json({ status: 'success', data: details });
    } catch (error) { next(error); }
  }

  async getAvailableAssets(req, res, next) {
    try {
      const assets = await marketService.getAvailableAssets();
      res.json({ status: 'success', data: assets });
    } catch (error) { next(error); }
  }

  async getWatchlist(req, res, next) {
    try {
      const watchlist = await marketService.getWatchlist(req.user.userId);
      res.json({ status: 'success', data: watchlist });
    } catch (error) { next(error); }
  }

  async addToWatchlist(req, res, next) {
    try {
      const { symbol } = req.validatedData.params;
      await marketService.addToWatchlist(req.user.userId, symbol);
      res.json({ status: 'success', message: `${symbol} added to watchlist` });
    } catch (error) { next(error); }
  }

  async removeFromWatchlist(req, res, next) {
    try {
      const { symbol } = req.validatedData.params;
      await marketService.removeFromWatchlist(req.user.userId, symbol);
      res.json({ status: 'success', message: `${symbol} removed from watchlist` });
    } catch (error) { next(error); }
  }

  async createPriceAlert(req, res, next) {
    try {
      const alert = await marketService.createPriceAlert(req.user.userId, req.validatedData.body);
      res.status(201).json({ status: 'success', data: alert });
    } catch (error) { next(error); }
  }

  async getPriceAlerts(req, res, next) {
    try {
      const alerts = await marketService.getPriceAlerts(req.user.userId);
      res.json({ status: 'success', data: alerts });
    } catch (error) { next(error); }
  }

  async deletePriceAlert(req, res, next) {
    try {
      const { id } = req.validatedData.params;
      await marketService.deletePriceAlert(req.user.userId, id);
      res.json({ status: 'success', message: 'Alert deleted' });
    } catch (error) { next(error); }
  }
}

module.exports = new MarketController();
