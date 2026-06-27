'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// assetTypes.js
// ─────────────────────────────────────────────────────────────────────────────
const {
  inferAssetType,
  CRYPTO_SYMBOLS,
  COMMODITY_SYMBOLS,
} = require('../../utils/assetTypes');

describe('inferAssetType', () => {
  test('identifies BTC as crypto', () => {
    expect(inferAssetType('BTC')).toBe('crypto');
  });

  test('identifies ETH as crypto (lowercase input)', () => {
    expect(inferAssetType('eth')).toBe('crypto');
  });

  test('identifies GOLD as commodity', () => {
    expect(inferAssetType('GOLD')).toBe('commodity');
  });

  test('identifies SILVER as commodity', () => {
    expect(inferAssetType('SILVER')).toBe('commodity');
  });

  test('identifies EUR/USD as forex (contains /)', () => {
    expect(inferAssetType('EUR/USD')).toBe('forex');
  });

  test('identifies AAPL as stock (default)', () => {
    expect(inferAssetType('AAPL')).toBe('stock');
  });

  test('returns stock for unknown symbol', () => {
    expect(inferAssetType('UNKNOWN_XYZ')).toBe('stock');
  });

  test('returns stock for null/undefined', () => {
    expect(inferAssetType(null)).toBe('stock');
    expect(inferAssetType(undefined)).toBe('stock');
  });

  test('returns stock for empty string', () => {
    expect(inferAssetType('')).toBe('stock');
  });

  test('CRYPTO_SYMBOLS Set contains expected tokens', () => {
    ['BTC', 'ETH', 'SOL', 'USDT', 'USDC'].forEach(s => {
      expect(CRYPTO_SYMBOLS.has(s)).toBe(true);
    });
  });

  test('COMMODITY_SYMBOLS Set contains expected commodities', () => {
    ['GOLD', 'SILVER', 'OIL', 'WHEAT'].forEach(s => {
      expect(COMMODITY_SYMBOLS.has(s)).toBe(true);
    });
  });

  test('identifies all crypto symbols in CRYPTO_SYMBOLS set', () => {
    CRYPTO_SYMBOLS.forEach(sym => {
      expect(inferAssetType(sym)).toBe('crypto');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// responseNormaliser.js
// ─────────────────────────────────────────────────────────────────────────────
const { success, error } = require('../../utils/responseNormaliser');

describe('responseNormaliser', () => {
  describe('success()', () => {
    test('wraps data in success envelope', () => {
      const result = success({ items: [] });
      expect(result.status).toBe('success');
      expect(result.data).toEqual({ items: [] });
    });

    test('includes a timestamp in meta', () => {
      const result = success({});
      expect(result.meta).toHaveProperty('timestamp');
      expect(new Date(result.meta.timestamp).getTime()).not.toBeNaN();
    });

    test('defaults dataSource to "live"', () => {
      const result = success({});
      expect(result.meta.dataSource).toBe('live');
    });

    test('defaults cached to false', () => {
      const result = success({});
      expect(result.meta.cached).toBe(false);
    });

    test('accepts custom meta fields', () => {
      const result = success({}, { dataSource: 'cache', cached: true, extra: 123 });
      expect(result.meta.dataSource).toBe('cache');
      expect(result.meta.cached).toBe(true);
      expect(result.meta.extra).toBe(123);
    });

    test('works with null data', () => {
      const result = success(null);
      expect(result.status).toBe('success');
      expect(result.data).toBeNull();
    });
  });

  describe('error()', () => {
    test('wraps message in error envelope', () => {
      const result = error('Something went wrong');
      expect(result.status).toBe('error');
      expect(result.message).toBe('Something went wrong');
    });

    test('defaults code to 500', () => {
      const result = error('Oops');
      expect(result.code).toBe(500);
    });

    test('accepts custom status code', () => {
      const result = error('Not found', 404);
      expect(result.code).toBe(404);
    });
  });
});
