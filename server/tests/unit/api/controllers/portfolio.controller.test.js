'use strict';

jest.mock('../../api/middlewares/logger.middleware', () => require('../__mocks__/logger.mock'));
jest.mock('../../services/portfolio.service', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const portfolioService = require('../../services/portfolio.service');
const PortfolioController = require('../../api/controllers/portfolio.controller');

const controller = new PortfolioController();

// ─── helpers ─────────────────────────────────────────────────────────────────
const makeReq = (overrides = {}) => ({
  user: { userId: 'user123' },
  query: {},
  params: {},
  body: {},
  validatedData: {},
  ...overrides,
});

const makeRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

// ─── getPortfolioSummary ──────────────────────────────────────────────────────
describe('PortfolioController.getPortfolioSummary', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns success with summary data', async () => {
    portfolioService.getPortfolioSummary = jest.fn().mockResolvedValue({ totalValue: 50000 });
    const res = makeRes();
    await controller.getPortfolioSummary(makeReq(), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', data: { totalValue: 50000 } })
    );
  });

  test('calls next(error) on service failure', async () => {
    portfolioService.getPortfolioSummary = jest.fn().mockRejectedValue(new Error('DB error'));
    const next = jest.fn();
    await controller.getPortfolioSummary(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

// ─── getAllAssets ─────────────────────────────────────────────────────────────
describe('PortfolioController.getAllAssets', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns assets with pagination', async () => {
    portfolioService.getAllAssets = jest.fn().mockResolvedValue({
      items: [{ symbol: 'BTC' }],
      total: 1,
    });
    const req = makeReq({ validatedData: { query: { limit: 10, skip: 0 } } });
    const res = makeRes();

    await controller.getAllAssets(req, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        data: [{ symbol: 'BTC' }],
        pagination: { limit: 10, skip: 0, total: 1 },
      })
    );
  });

  test('uses default pagination when validatedData.query missing', async () => {
    portfolioService.getAllAssets = jest.fn().mockResolvedValue({ items: [], total: 0 });
    const req = makeReq({ validatedData: {} });
    const res = makeRes();

    await controller.getAllAssets(req, res, jest.fn());
    expect(portfolioService.getAllAssets).toHaveBeenCalledWith('user123', { limit: 50, skip: 0 });
  });
});

// ─── getAssetDetails ─────────────────────────────────────────────────────────
describe('PortfolioController.getAssetDetails', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns asset detail', async () => {
    portfolioService.getAssetDetails = jest.fn().mockResolvedValue({ symbol: 'ETH', amount: 2 });
    const req = makeReq({ params: { id: 'asset1' } });
    const res = makeRes();

    await controller.getAssetDetails(req, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { symbol: 'ETH', amount: 2 } })
    );
  });
});

// ─── getPortfolioHistory ──────────────────────────────────────────────────────
describe('PortfolioController.getPortfolioHistory', () => {
  test('calls service with timeframe from query', async () => {
    portfolioService.getPortfolioHistory = jest.fn().mockResolvedValue([]);
    const req = makeReq({ query: { timeframe: '3m' } });
    const res = makeRes();

    await controller.getPortfolioHistory(req, res, jest.fn());
    expect(portfolioService.getPortfolioHistory).toHaveBeenCalledWith('user123', '3m');
  });
});

// ─── getPerformanceMetrics ────────────────────────────────────────────────────
describe('PortfolioController.getPerformanceMetrics', () => {
  test('responds with metrics', async () => {
    portfolioService.getPerformanceMetrics = jest.fn().mockResolvedValue({ sharpeRatio: 1.2 });
    const req = makeReq({ query: { timeframe: '1y' } });
    const res = makeRes();

    await controller.getPerformanceMetrics(req, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { sharpeRatio: 1.2 } })
    );
  });
});

// ─── getAssetAllocation ───────────────────────────────────────────────────────
describe('PortfolioController.getAssetAllocation', () => {
  test('responds with allocation data', async () => {
    portfolioService.getAssetAllocation = jest.fn().mockResolvedValue([
      { symbol: 'BTC', weight: 60 },
    ]);
    const res = makeRes();
    await controller.getAssetAllocation(makeReq(), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
  });
});

// ─── rebalancePortfolio ───────────────────────────────────────────────────────
describe('PortfolioController.rebalancePortfolio', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 400 when portfolioId missing', async () => {
    const req = makeReq({ params: {}, body: {} });
    const res = makeRes();
    await controller.rebalancePortfolio(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('portfolioId') })
    );
  });

  test('returns rebalance result for valid portfolioId', async () => {
    portfolioService.rebalancePortfolio = jest.fn().mockResolvedValue({
      status: 'preview',
      allocation: [],
    });
    const req = makeReq({
      params: { portfolioId: 'p1' },
      body: { objective: 'sharpe', dryRun: true },
    });
    const res = makeRes();
    await controller.rebalancePortfolio(req, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'preview' }));
  });

  test('calls next(error) on service error', async () => {
    portfolioService.rebalancePortfolio = jest.fn().mockRejectedValue(new Error('Fail'));
    const req = makeReq({ params: { portfolioId: 'p1' }, body: {} });
    const next = jest.fn();
    await controller.rebalancePortfolio(req, makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

// ─── getRebalanceSuggestions ──────────────────────────────────────────────────
describe('PortfolioController.getRebalanceSuggestions', () => {
  test('returns suggestions', async () => {
    portfolioService.getRebalanceSuggestions = jest.fn().mockResolvedValue([]);
    const res = makeRes();
    await controller.getRebalanceSuggestions(makeReq(), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
  });
});
