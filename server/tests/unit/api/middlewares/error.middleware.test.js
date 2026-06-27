'use strict';

// Mock winston and Sentry before requiring the module
jest.mock('winston', () => ({
  error: jest.fn(),
}));

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

const { errorMiddleware } = require('../../api/middlewares/error.middleware');

// ─── helpers ─────────────────────────────────────────────────────────────────
const makeReq = (overrides = {}) => ({
  path: '/test',
  method: 'GET',
  ...overrides,
});

const makeRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

// ─── errorMiddleware ──────────────────────────────────────────────────────────
describe('errorMiddleware', () => {
  const next = jest.fn();
  const OLD_ENV = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = OLD_ENV;
  });

  test('responds 500 for generic error', () => {
    const err = new Error('Unexpected failure');
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' })
    );
  });

  test('uses err.status when set', () => {
    const err = Object.assign(new Error('Not found'), { status: 404 });
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('uses err.statusCode when set', () => {
    const err = Object.assign(new Error('Forbidden'), { statusCode: 403 });
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 403 for CSRF error (EBADCSRFTOKEN)', () => {
    const err = Object.assign(new Error('CSRF'), { code: 'EBADCSRFTOKEN' });
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('CSRF') })
    );
  });

  test('returns 400 for ValidationError', () => {
    const err = Object.assign(new Error('Validation'), {
      name: 'ValidationError',
      errors: { field: 'required' },
    });
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', errors: { field: 'required' } })
    );
  });

  test('returns 401 for UnauthorizedError', () => {
    const err = Object.assign(new Error('Unauth'), { name: 'UnauthorizedError' });
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 409 for MongoDB duplicate key error (code 11000)', () => {
    const err = Object.assign(new Error('Duplicate'), {
      code: 11000,
      keyPattern: { email: 1 },
    });
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'DUPLICATE_KEY_ERROR' })
    );
  });

  test('returns 409 for MongoServerError', () => {
    const err = Object.assign(new Error('Mongo'), {
      name: 'MongoServerError',
      keyPattern: { username: 1 },
    });
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('in production, hides 500 message', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('Internal secret');
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, next);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Internal Server Error');
  });

  test('in production, exposes non-500 message', () => {
    process.env.NODE_ENV = 'production';
    const err = Object.assign(new Error('Bad request detail'), { status: 400 });
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, next);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Bad request detail');
  });

  test('includes err.code in response when set', () => {
    const err = Object.assign(new Error('Custom'), { status: 400, code: 'CUSTOM_CODE' });
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, next);
    expect(res.json.mock.calls[0][0]).toHaveProperty('code', 'CUSTOM_CODE');
  });
});
