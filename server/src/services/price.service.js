// FILE: src/services/price.service.js
// REPLACE ENTIRE FILE

'use strict';

const axios = require('axios');
const { logger } = require('../api/middlewares/logger.middleware');

class PriceService {
  constructor () {
    this.cache   = new Map();
    this.cacheTTL = 60 * 1000; // 1 minute
    this.apiKey   = process.env.COINGECKO_API_KEY || '';
    this.baseUrl  = 'https://api.coingecko.com/api/v3';
  }

  get headers () {
    return this.apiKey ? { 'x-cg-demo-api-key': this.apiKey } : {};
  }

  // ─── Single price with in-memory cache ───────────────────────────────────
  async getPrice (coinId) {
    const cached = this.cache.get(coinId);
    if (cached && Date.now() - cached.ts < this.cacheTTL) return cached.price;

    const prices = await this.getPrices([coinId]);
    return prices[coinId]?.usd ?? null;
  }

  // ─── Batch fetch with retry + exponential backoff ─────────────────────────
  async getPrices (coinIds, retries = 3) {
    const ids = [...new Set(coinIds)].join(',');
    if (!ids) return {};

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const resp = await axios.get(`${this.baseUrl}/simple/price`, {
          params:  { ids, vs_currencies: 'usd', include_24hr_change: 'true', include_24hr_vol: 'true' },
          headers: this.headers,
          timeout: 8000
        });

        // Cache individual results
        for (const [id, data] of Object.entries(resp.data)) {
          this.cache.set(id, { price: data.usd, ts: Date.now() });
        }

        return resp.data;
      } catch (err) {
        if (err.response?.status === 429) {
          const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
          logger.warn(`CoinGecko rate limited. Retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          logger.error(`CoinGecko getPrices failed (attempt ${attempt + 1}):`, err.message);
          if (attempt === retries - 1) return {};
        }
      }
    }
    return {};
  }

  // ─── Convenience methods ──────────────────────────────────────────────────
  async getETHPrice   () { return this.getPrice('ethereum'); }
  async getAAVEPrice  () { return this.getPrice('aave'); }
  async getCRVPrice   () { return this.getPrice('curve-dao-token'); }
  async getMATICPrice () { return this.getPrice('matic-network'); }
  async getBTCPrice   () { return this.getPrice('bitcoin'); }
}

module.exports = new PriceService();