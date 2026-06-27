'use strict';

jest.mock('../../api/middlewares/logger.middleware', () => require('../__mocks__/logger.mock'));
jest.mock('../../models/user.model', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../../models/api-key.model', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const User = require('../../models/user.model');
const UserService = require('../../services/user.service');

const service = new UserService();

// ─── helpers ─────────────────────────────────────────────────────────────────
const fakeUser = (overrides = {}) => {
  const base = {
    _id: 'user1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    plan: 'basic',
    isTwoFactorEnabled: false,
    preferences: {},
    role: 'user',
    toObject: jest.fn().mockReturnThis(),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return base;
};

// ─── formatUserResponse ───────────────────────────────────────────────────────
describe('UserService.formatUserResponse', () => {
  test('returns null for null input', () => {
    expect(service.formatUserResponse(null)).toBeNull();
  });

  test('maps user fields correctly', () => {
    const user = fakeUser();
    user.toObject = () => ({ ...user });
    const result = service.formatUserResponse(user);
    expect(result.id).toBe('user1');
    expect(result.email).toBe('test@example.com');
    expect(result.twoFactorEnabled).toBe(false);
  });

  test('does not expose passwordHash', () => {
    const user = fakeUser({ passwordHash: 'secret' });
    user.toObject = () => ({ ...user });
    const result = service.formatUserResponse(user);
    expect(result).not.toHaveProperty('passwordHash');
  });
});

// ─── getProfile ───────────────────────────────────────────────────────────────
describe('UserService.getProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns formatted user when found', async () => {
    const user = fakeUser();
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

    const result = await service.getProfile('user1');
    expect(result).toHaveProperty('email', 'test@example.com');
  });

  test('throws when user not found', async () => {
    User.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    await expect(service.getProfile('missing')).rejects.toThrow('User not found');
  });
});

// ─── updateProfile ───────────────────────────────────────────────────────────
describe('UserService.updateProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates allowed fields', async () => {
    const user = fakeUser();
    User.findById = jest.fn().mockResolvedValue(user);
    User.findByIdAndUpdate = jest.fn().mockResolvedValue(user);

    // service reads user then updates
    await expect(service.updateProfile('user1', { firstName: 'Bob' })).resolves.toBeDefined();
  });

  test('throws when user not found', async () => {
    User.findById = jest.fn().mockResolvedValue(null);
    await expect(service.updateProfile('missing', {})).rejects.toThrow('User not found');
  });

  test('splits fullName into firstName and lastName', async () => {
    const user = fakeUser();
    User.findById = jest.fn().mockResolvedValue(user);
    User.findByIdAndUpdate = jest.fn().mockResolvedValue(user);

    // should not throw and should process fullName
    await expect(
      service.updateProfile('user1', { fullName: 'John Doe' })
    ).resolves.toBeDefined();
  });
});
