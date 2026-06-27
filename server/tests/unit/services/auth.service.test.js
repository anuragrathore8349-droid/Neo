'use strict';

// All external dependencies mocked
jest.mock('../../models/user.model', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../../models/activity-log.model', () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../../services/email.service', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../config', () => ({
  jwt: {
    secret: 'test-secret',
    refreshSecret: 'refresh-secret',
    expiresIn: '15m',
    refreshExpiresIn: '7d',
  },
  appUrl: 'http://localhost:3000',
}));
jest.mock('crypto-random-string', () => jest.fn().mockReturnValue('random-token-32chars'));
jest.mock('speakeasy');

const User = require('../../models/user.model');
const emailService = require('../../services/email.service');
const speakeasy = require('speakeasy');
const AuthService = require('../../services/auth.service');

const authService = new AuthService();

// ─── helpers ─────────────────────────────────────────────────────────────────
const mockUser = (overrides = {}) => ({
  _id: 'user123',
  email: 'test@example.com',
  firstName: 'Test',
  isEmailVerified: false,
  isTwoFactorEnabled: false,
  twoFactorSecret: null,
  refreshTokens: [],
  isLocked: jest.fn().mockReturnValue(false),
  comparePassword: jest.fn().mockResolvedValue(true),
  incrementLoginAttempts: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
  toObject: jest.fn().mockReturnValue({}),
  ...overrides,
});

// ─── register ────────────────────────────────────────────────────────────────
describe('AuthService.register', () => {
  beforeEach(() => jest.clearAllMocks());

  test('throws 409 when email already exists', async () => {
    User.findOne = jest.fn().mockResolvedValue(mockUser());

    await expect(authService.register({ email: 'test@example.com' }))
      .rejects.toMatchObject({ status: 409 });
  });

  test('creates and saves new user when email is new', async () => {
    User.findOne = jest.fn().mockResolvedValue(null);
    const savedUser = mockUser();
    User.mockImplementation(() => savedUser);

    const result = await authService.register({
      email: 'new@example.com',
      password: 'Password1!',
      firstName: 'Alice',
      lastName: 'Smith',
    });

    expect(savedUser.save).toHaveBeenCalled();
    expect(result).toHaveProperty('userId');
    expect(result).toHaveProperty('email');
  });

  test('sends verification email after registration', async () => {
    User.findOne = jest.fn().mockResolvedValue(null);
    const savedUser = mockUser();
    User.mockImplementation(() => savedUser);

    await authService.register({ email: 'new@example.com', firstName: 'Test' });
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'emailVerification' })
    );
  });

  test('still returns result even when email service fails', async () => {
    User.findOne = jest.fn().mockResolvedValue(null);
    emailService.sendEmail = jest.fn().mockRejectedValue(new Error('SMTP error'));
    const savedUser = mockUser();
    User.mockImplementation(() => savedUser);

    const result = await authService.register({ email: 'new@example.com' });
    expect(result).toHaveProperty('userId');
  });
});

// ─── login ───────────────────────────────────────────────────────────────────
describe('AuthService.login', () => {
  beforeEach(() => jest.clearAllMocks());

  test('throws 401 when user not found', async () => {
    User.findOne = jest.fn().mockResolvedValue(null);
    await expect(authService.login('bad@example.com', 'pw'))
      .rejects.toMatchObject({ status: 401 });
  });

  test('throws 423 when account is locked', async () => {
    const lockedUser = mockUser({ isLocked: jest.fn().mockReturnValue(true) });
    User.findOne = jest.fn().mockResolvedValue(lockedUser);
    await expect(authService.login('test@example.com', 'pw'))
      .rejects.toMatchObject({ status: 423 });
  });

  test('throws 401 with wrong password and increments attempts', async () => {
    const user = mockUser({ comparePassword: jest.fn().mockResolvedValue(false) });
    User.findOne = jest.fn().mockResolvedValue(user);
    User.findByIdAndUpdate = jest.fn().mockResolvedValue(user);

    await expect(authService.login('test@example.com', 'wrongpw'))
      .rejects.toMatchObject({ status: 401 });
    expect(user.incrementLoginAttempts).toHaveBeenCalled();
  });

  test('throws 401 with code TWO_FACTOR_REQUIRED when 2FA enabled but no code provided', async () => {
    const user = mockUser({ isTwoFactorEnabled: true, twoFactorSecret: 'secret' });
    User.findOne = jest.fn().mockResolvedValue(user);

    await expect(authService.login('test@example.com', 'Password1!'))
      .rejects.toMatchObject({ code: 'TWO_FACTOR_REQUIRED' });
  });

  test('throws 401 when 2FA code is invalid', async () => {
    const user = mockUser({ isTwoFactorEnabled: true, twoFactorSecret: 'secret' });
    User.findOne = jest.fn().mockResolvedValue(user);
    User.findByIdAndUpdate = jest.fn().mockResolvedValue(user);
    speakeasy.totp = { verify: jest.fn().mockReturnValue(false) };

    await expect(authService.login('test@example.com', 'Password1!', '000000'))
      .rejects.toMatchObject({ status: 401 });
  });

  test('returns tokens on successful login', async () => {
    const user = mockUser();
    User.findOne = jest.fn().mockResolvedValue(user);
    User.findByIdAndUpdate = jest.fn().mockResolvedValue(user);

    const result = await authService.login('test@example.com', 'Password1!');
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result).toHaveProperty('user');
  });

  test('returns tokens when 2FA code is valid', async () => {
    const user = mockUser({ isTwoFactorEnabled: true, twoFactorSecret: 'secret' });
    User.findOne = jest.fn().mockResolvedValue(user);
    User.findByIdAndUpdate = jest.fn().mockResolvedValue(user);
    speakeasy.totp = { verify: jest.fn().mockReturnValue(true) };

    const result = await authService.login('test@example.com', 'Password1!', '123456');
    expect(result).toHaveProperty('accessToken');
  });
});

// ─── generateAccessToken / generateRefreshToken ───────────────────────────────
describe('AuthService token generation', () => {
  test('generates a string access token', () => {
    const user = mockUser({ plan: 'pro', role: 'user' });
    const token = authService.generateAccessToken(user);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT format
  });

  test('generates a string refresh token', () => {
    const user = mockUser();
    const token = authService.generateRefreshToken(user);
    expect(typeof token).toBe('string');
  });
});
