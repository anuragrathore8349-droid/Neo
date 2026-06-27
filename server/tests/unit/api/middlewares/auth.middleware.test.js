'use strict';

jest.mock('../../config', () => ({
  jwt: { secret: 'test-secret-key' },
}));

jest.mock('../../models/activity-log.model', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

const jwt = require('jsonwebtoken');
const { authMiddleware } = require('../../api/middlewares/auth.middleware');

// ─── helpers ─────────────────────────────────────────────────────────────────
const makeReq = (overrides = {}) => ({
  headers: {},
  method: 'GET',
  path: '/test',
  originalUrl: '/test',
  ip: '127.0.0.1',
  ...overrides,
});

const makeRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

const makeValidToken = (payload = { userId: 'user123', plan: 'basic' }) =>
  jwt.sign(payload, 'test-secret-key');

// ─── authMiddleware ───────────────────────────────────────────────────────────
describe('authMiddleware', () => {
  let next;

  beforeEach(() => {
    next = jest.fn();
    jest.clearAllMocks();
  });

  test('calls next() when token is valid', async () => {
    const token = makeValidToken();
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();

    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // no error
  });

  test('attaches decoded payload to req.user', async () => {
    const token = makeValidToken({ userId: 'u1', plan: 'pro' });
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();

    await authMiddleware(req, res, next);
    expect(req.user.userId).toBe('u1');
    expect(req.user.plan).toBe('pro');
  });

  test('returns 401 when no authorization header', async () => {
    const req = makeReq();
    const res = makeRes();

    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Authentication required' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 for invalid token', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer invalid.token.here' } });
    const res = makeRes();

    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 for expired token', async () => {
    const token = jwt.sign({ userId: 'u1' }, 'test-secret-key', { expiresIn: '-1s' });
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();

    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when token signed with wrong secret', async () => {
    const token = jwt.sign({ userId: 'u1' }, 'wrong-secret');
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const res = makeRes();

    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('logs write operations (POST/PUT/PATCH/DELETE)', async () => {
    const ActivityLog = require('../../models/activity-log.model');
    const token = makeValidToken();
    const req = makeReq({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
    });
    const res = makeRes();

    await authMiddleware(req, res, next);
    expect(ActivityLog.create).toHaveBeenCalled();
  });

  test('does NOT log read operations (GET)', async () => {
    const ActivityLog = require('../../models/activity-log.model');
    const token = makeValidToken();
    const req = makeReq({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
    });
    const res = makeRes();

    await authMiddleware(req, res, next);
    expect(ActivityLog.create).not.toHaveBeenCalled();
  });
});
