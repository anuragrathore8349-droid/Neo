'use strict';

const {
  calculateTechnicalIndicators,
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
} = require('../../utils/indicators');

// ─── helpers ─────────────────────────────────────────────────────────────────
const makePrices = (n = 30, start = 100, step = 1) =>
  Array.from({ length: n }, (_, i) => start + i * step);

// ─── calculateSMA ────────────────────────────────────────────────────────────
describe('calculateSMA', () => {
  test('returns empty array if prices length < period', () => {
    expect(calculateSMA([1, 2, 3], 14)).toEqual([]);
  });

  test('returns correct SMA values for period 3', () => {
    const prices = [1, 2, 3, 4, 5];
    const sma = calculateSMA(prices, 3);
    expect(sma).toHaveLength(3);
    expect(sma[0]).toBeCloseTo(2, 4); // (1+2+3)/3
    expect(sma[1]).toBeCloseTo(3, 4); // (2+3+4)/3
    expect(sma[2]).toBeCloseTo(4, 4); // (3+4+5)/3
  });

  test('default period is 14', () => {
    const prices = makePrices(20);
    const sma = calculateSMA(prices);
    expect(sma).toHaveLength(7); // 20 - 14 + 1
  });

  test('linear increasing prices produce linear SMA', () => {
    const prices = makePrices(20, 1, 1);
    const sma = calculateSMA(prices, 5);
    // All SMA values should be the average of 5 consecutive integers
    expect(sma[0]).toBeCloseTo(3, 4); // avg(1..5)
    expect(sma[1]).toBeCloseTo(4, 4); // avg(2..6)
  });
});

// ─── calculateEMA ─────────────────────────────────────────────────────────────
describe('calculateEMA', () => {
  test('returns array starting from SMA of first period elements', () => {
    const prices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const ema = calculateEMA(prices, 14);
    // First EMA value should equal SMA(1..14) = 7.5
    expect(ema[0]).toBeCloseTo(7.5, 4);
  });

  test('has length (n - period + 1)', () => {
    const prices = makePrices(30);
    const ema = calculateEMA(prices, 10);
    expect(ema).toHaveLength(21); // 30 - 10 + 1
  });

  test('converges toward a constant price', () => {
    // All prices are 100 after warm-up period; EMA should approach 100
    const prices = [...makePrices(14, 50, 3), ...Array(20).fill(100)];
    const ema = calculateEMA(prices, 14);
    const lastEma = ema[ema.length - 1];
    expect(Math.abs(lastEma - 100)).toBeLessThan(5);
  });

  test('is always a number for valid inputs', () => {
    const prices = makePrices(50, 100, 0.5);
    calculateEMA(prices, 14).forEach(v => expect(typeof v).toBe('number'));
  });
});

// ─── calculateRSI ─────────────────────────────────────────────────────────────
describe('calculateRSI', () => {
  test('returns empty array for insufficient data', () => {
    expect(calculateRSI([1, 2, 3])).toEqual([]);
  });

  test('RSI values are in range 0-100', () => {
    const prices = makePrices(30, 100, 1).map((p, i) => p + (i % 2 === 0 ? 2 : -1));
    const rsi = calculateRSI(prices, 14);
    rsi.forEach(r => {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(100);
    });
  });

  test('all-rising prices push RSI toward 100', () => {
    const prices = makePrices(30, 100, 2);
    const rsi = calculateRSI(prices, 14);
    expect(rsi[rsi.length - 1]).toBeGreaterThan(70);
  });

  test('all-falling prices push RSI toward 0', () => {
    const prices = makePrices(30, 200, -2);
    const rsi = calculateRSI(prices, 14);
    expect(rsi[rsi.length - 1]).toBeLessThan(30);
  });
});

// ─── calculateMACD ───────────────────────────────────────────────────────────
describe('calculateMACD', () => {
  const prices = makePrices(60, 100, 1);

  test('returns object with macdLine, signalLine, histogram', () => {
    const result = calculateMACD(prices);
    expect(result).toHaveProperty('macdLine');
    expect(result).toHaveProperty('signalLine');
    expect(result).toHaveProperty('histogram');
  });

  test('macdLine has expected length relative to slow period', () => {
    const result = calculateMACD(prices, 12, 26, 9);
    // fastEMA length: 60-12+1=49; slowEMA length: 60-26+1=35
    // macdLine: min(49,35)=35
    expect(result.macdLine.length).toBe(35);
  });

  test('signalLine length is (macdLine - signalPeriod + 1)', () => {
    const result = calculateMACD(prices, 12, 26, 9);
    expect(result.signalLine.length).toBe(result.macdLine.length - 9 + 1);
  });

  test('histogram values correspond to macd - signal', () => {
    const result = calculateMACD(prices, 12, 26, 9);
    const { macdLine, signalLine, histogram } = result;
    for (let i = 0; i < signalLine.length; i++) {
      expect(histogram[i]).toBeCloseTo(macdLine[i] - signalLine[i], 8);
    }
  });

  test('histogram nulls for indexes beyond signalLine', () => {
    const result = calculateMACD(prices, 12, 26, 9);
    const nulls = result.histogram.filter(h => h === null);
    const expectedNulls = result.macdLine.length - result.signalLine.length;
    expect(nulls.length).toBe(expectedNulls);
  });
});

// ─── calculateTechnicalIndicators ────────────────────────────────────────────
describe('calculateTechnicalIndicators', () => {
  test('returns all four indicators', () => {
    const prices = makePrices(60, 100, 1);
    const result = calculateTechnicalIndicators(prices);
    expect(result).toHaveProperty('sma');
    expect(result).toHaveProperty('ema');
    expect(result).toHaveProperty('rsi');
    expect(result).toHaveProperty('macd');
  });

  test('all arrays contain numeric values', () => {
    const prices = makePrices(60, 150, 0.5);
    const { sma, ema, rsi, macd } = calculateTechnicalIndicators(prices);
    sma.forEach(v => expect(typeof v).toBe('number'));
    ema.forEach(v => expect(typeof v).toBe('number'));
    rsi.forEach(v => expect(typeof v).toBe('number'));
    macd.macdLine.forEach(v => expect(typeof v).toBe('number'));
  });
});
