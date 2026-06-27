'use strict';

const { portfolioSchemas } = require('../../api/validators/portfolio.validator');

const parse = (schema, data) => schema.safeParse(data);

// ─── getAllAssets ─────────────────────────────────────────────────────────────
describe('portfolioSchemas.getAllAssets', () => {
  test('accepts empty query (uses defaults)', () => {
    expect(parse(portfolioSchemas.getAllAssets, { query: {} }).success).toBe(true);
  });

  test('accepts limit and skip', () => {
    const result = parse(portfolioSchemas.getAllAssets, { query: { limit: '10', skip: '5' } });
    expect(result.success).toBe(true);
    expect(result.data.query.limit).toBe(10);
    expect(result.data.query.skip).toBe(5);
  });

  test('rejects limit > 100', () => {
    expect(parse(portfolioSchemas.getAllAssets, { query: { limit: '101' } }).success).toBe(false);
  });

  test('rejects negative skip', () => {
    expect(parse(portfolioSchemas.getAllAssets, { query: { skip: '-1' } }).success).toBe(false);
  });
});

// ─── addAsset ─────────────────────────────────────────────────────────────────
describe('portfolioSchemas.addAsset', () => {
  const valid = {
    body: {
      symbol: 'BTC',
      name: 'Bitcoin',
      type: 'crypto',
      amount: 0.5,
      costBasis: 45000,
    },
  };

  test('accepts valid asset data', () => {
    expect(parse(portfolioSchemas.addAsset, valid).success).toBe(true);
  });

  test('accepts without optional name field', () => {
    const { name, ...noName } = valid.body;
    expect(parse(portfolioSchemas.addAsset, { body: noName }).success).toBe(true);
  });

  test('rejects missing symbol', () => {
    const { symbol, ...noSymbol } = valid.body;
    expect(parse(portfolioSchemas.addAsset, { body: noSymbol }).success).toBe(false);
  });

  test('rejects invalid type', () => {
    const data = { body: { ...valid.body, type: 'magic' } };
    expect(parse(portfolioSchemas.addAsset, data).success).toBe(false);
  });

  test('accepts all valid types', () => {
    ['crypto', 'stock', 'forex', 'commodity'].forEach(type => {
      const data = { body: { ...valid.body, type } };
      expect(parse(portfolioSchemas.addAsset, data).success).toBe(true);
    });
  });

  test('rejects non-positive amount', () => {
    const data = { body: { ...valid.body, amount: 0 } };
    expect(parse(portfolioSchemas.addAsset, data).success).toBe(false);
  });

  test('rejects non-positive costBasis', () => {
    const data = { body: { ...valid.body, costBasis: -100 } };
    expect(parse(portfolioSchemas.addAsset, data).success).toBe(false);
  });

  test('accepts valid purchaseDate in YYYY-MM-DD format', () => {
    const data = { body: { ...valid.body, purchaseDate: '2024-01-15' } };
    expect(parse(portfolioSchemas.addAsset, data).success).toBe(true);
  });

  test('rejects invalid purchaseDate format', () => {
    const data = { body: { ...valid.body, purchaseDate: '15-01-2024' } };
    expect(parse(portfolioSchemas.addAsset, data).success).toBe(false);
  });

  test('rejects symbol longer than 20 chars', () => {
    const data = { body: { ...valid.body, symbol: 'A'.repeat(21) } };
    expect(parse(portfolioSchemas.addAsset, data).success).toBe(false);
  });
});

// ─── updateAsset ─────────────────────────────────────────────────────────────
describe('portfolioSchemas.updateAsset', () => {
  const valid = {
    body: { amount: 1.5, costBasis: 50000 },
    params: { id: 'asset123' },
  };

  test('accepts valid update data', () => {
    expect(parse(portfolioSchemas.updateAsset, valid).success).toBe(true);
  });

  test('accepts partial updates (only amount)', () => {
    const data = { body: { amount: 2 }, params: { id: 'abc' } };
    expect(parse(portfolioSchemas.updateAsset, data).success).toBe(true);
  });

  test('accepts partial updates (only costBasis)', () => {
    const data = { body: { costBasis: 60000 }, params: { id: 'abc' } };
    expect(parse(portfolioSchemas.updateAsset, data).success).toBe(true);
  });

  test('requires id in params', () => {
    expect(parse(portfolioSchemas.updateAsset, { body: valid.body, params: {} }).success).toBe(false);
  });

  test('rejects negative amount', () => {
    const data = { body: { amount: -1 }, params: { id: 'abc' } };
    expect(parse(portfolioSchemas.updateAsset, data).success).toBe(false);
  });
});
