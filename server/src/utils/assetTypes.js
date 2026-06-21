const CRYPTO_SYMBOLS = new Set([
  'BTC','ETH','SOL','ADA','BNB','XRP','DOGE','AVAX','MATIC','DOT',
  'LINK','UNI','ATOM','LTC','BCH','ALGO','VET','FIL','TRX','NEAR',
  'USDC','USDT','DAI','BUSD'
]);

const COMMODITY_SYMBOLS = new Set(['GOLD','SILVER','OIL','GAS','WHEAT','COPPER']);

/**
 * Infer asset type from symbol string
 * @param {string} symbol
 * @returns {'crypto'|'stock'|'commodity'|'forex'}
 */
const inferAssetType = (symbol) => {
  const s = symbol?.toUpperCase();
  if (!s) return 'stock';
  if (CRYPTO_SYMBOLS.has(s)) return 'crypto';
  if (COMMODITY_SYMBOLS.has(s)) return 'commodity';
  if (s.includes('/')) return 'forex';
  return 'stock';
};

module.exports = { inferAssetType, CRYPTO_SYMBOLS, COMMODITY_SYMBOLS };
