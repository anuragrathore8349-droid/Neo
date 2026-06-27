'use strict';

// Mock all dependencies before requiring the controller
jest.mock('../../services/auth.service', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../../models/user.model', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../../config', () => ({
  jwt: { secret: 'test', refreshSecret: 'test', expiresIn: '15m', refreshExpiresIn: '7d' },
  appUrl: 'http://localhost:3000',
}));

const authService = require('../../services/auth.service');
const User = require('../../models/user.model');
const AuthController = require('../../api/controllers/auth.controller');

const controller = new AuthController();

// ─── helpers ─────────────────────────────────────────────────────────────────
const makeReq = (overrides = {}) => ({
  validatedData: { body: {}, query: {}, params: {} },
  cookies: {},
  body: {},
  user: null,
  ...overrides,
});

const makeRes = () => {
  const res = { status: jest.fn(), json: jest.fn(), cookie: jest.fn(), clearCookie: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

// ─── register ────────────────────────────────────────────────────────────────
describe('AuthController.register', () => {
  beforeEach(() => jest.clearAllMocks());

  test('responds 201 with success on valid registration', async () => {
    authService.register = jest.fn().mockResolvedValue({ userId: 'u1', email: 'a@b.com' });
    const req = makeReq({ validatedData: { body: { email: 'a@b.com', password: 'Password1!' } } });
    const res = makeRes();
    const next = jest.fn();

    await controller.register(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
  });

  test('calls next(error) when authService.register throws', async () => {
    const err = new Error('Email taken');
    authService.register = jest.fn().mockRejectedValue(err);
    const req = makeReq({ validatedData: { body: {} } });
    const res = makeRes();
    const next = jest.fn();

    await controller.register(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─── login ───────────────────────────────────────────────────────────────────
describe('AuthController.login', () => {
  const mockResult = {
    accessToken: 'access.token',
    refreshToken: 'refresh.token',
    user: { id: 'u1', email: 'a@b.com' },
  };

  beforeEach(() => jest.clearAllMocks());

  test('responds 200 with tokens on valid login', async () => {
    authService.login = jest.fn().mockResolvedValue(mockResult);
    const req = makeReq({
      validatedData: { body: { email: 'a@b.com', password: 'pw' } },
    });
    const res = makeRes();
    await controller.login(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', data: expect.objectContaining({ accessToken: 'access.token' }) })
    );
  });

  test('sets refresh token cookie on login', async () => {
    authService.login = jest.fn().mockResolvedValue(mockResult);
    const req = makeReq({ validatedData: { body: { email: 'a@b.com', password: 'pw' } } });
    const res = makeRes();
    await controller.login(req, res, jest.fn());
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'refresh.token', expect.any(Object));
  });

  test('calls next(error) when login throws', async () => {
    authService.login = jest.fn().mockRejectedValue(new Error('Bad creds'));
    const req = makeReq({ validatedData: { body: {} } });
    const res = makeRes();
    const next = jest.fn();
    await controller.login(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────
describe('AuthController.logout', () => {
  beforeEach(() => jest.clearAllMocks());

  test('clears refresh token cookie', async () => {
    authService.logout = jest.fn().mockResolvedValue(undefined);
    const req = makeReq({ cookies: { refreshToken: 'tok' }, body: {} });
    const res = makeRes();
    await controller.logout(req, res, jest.fn());
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken');
  });

  test('responds with success', async () => {
    authService.logout = jest.fn().mockResolvedValue(undefined);
    const req = makeReq({ cookies: {}, body: {} });
    const res = makeRes();
    await controller.logout(req, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
  });

  test('still succeeds even if logout service throws', async () => {
    authService.logout = jest.fn().mockRejectedValue(new Error('Token not found'));
    const req = makeReq({ cookies: {}, body: {} });
    const res = makeRes();
    await controller.logout(req, res, jest.fn());
    expect(res.clearCookie).toHaveBeenCalled();
  });
});

// ─── refreshToken ─────────────────────────────────────────────────────────────
describe('AuthController.refreshToken', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns new tokens on valid refresh', async () => {
    authService.refreshToken = jest.fn().mockResolvedValue({
      accessToken: 'new.access',
      refreshToken: 'new.refresh',
    });
    const req = makeReq({
      validatedData: { body: { refreshToken: 'old.refresh' } },
      cookies: {},
    });
    const res = makeRes();
    await controller.refreshToken(req, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ accessToken: 'new.access' }) })
    );
  });

  test('clears cookie and calls next on invalid refresh token', async () => {
    const err = Object.assign(new Error('Invalid refresh token'), { status: 401 });
    authService.refreshToken = jest.fn().mockRejectedValue(err);
    const req = makeReq({
      validatedData: { body: {} },
      cookies: { refreshToken: 'bad' },
    });
    const res = makeRes();
    const next = jest.fn();
    await controller.refreshToken(req, res, next);
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken');
    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─── resendVerification ──────────────────────────────────────────────────────
describe('AuthController.resendVerification', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 404 when user not found', async () => {
    User.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    const req = makeReq({ user: { userId: 'u1' } });
    const res = makeRes();
    await controller.resendVerification(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns success if already verified', async () => {
    User.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ email: 'a@b.com', isEmailVerified: true }),
    });
    const req = makeReq({ user: { userId: 'u1' } });
    const res = makeRes();
    await controller.resendVerification(req, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('already verified') })
    );
  });
});
