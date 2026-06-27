'use strict';

const { authSchemas } = require('../../api/validators/auth.validator');

// ─── helper: parse a schema safely ───────────────────────────────────────────
const parse = (schema, data) => schema.safeParse(data);

// ─── register schema ─────────────────────────────────────────────────────────
describe('authSchemas.register', () => {
  const valid = {
    body: {
      email: 'alice@example.com',
      password: 'Password1!',
      firstName: 'Alice',
      lastName: 'Smith',
    },
  };

  test('accepts valid registration data', () => {
    expect(parse(authSchemas.register, valid).success).toBe(true);
  });

  test('rejects invalid email', () => {
    const data = { ...valid, body: { ...valid.body, email: 'not-an-email' } };
    expect(parse(authSchemas.register, data).success).toBe(false);
  });

  test('rejects password shorter than 8 characters', () => {
    const data = { ...valid, body: { ...valid.body, password: 'Ab1!' } };
    expect(parse(authSchemas.register, data).success).toBe(false);
  });

  test('rejects weak password missing special character', () => {
    const data = { ...valid, body: { ...valid.body, password: 'Password1' } };
    expect(parse(authSchemas.register, data).success).toBe(false);
  });

  test('rejects weak password missing uppercase letter', () => {
    const data = { ...valid, body: { ...valid.body, password: 'password1!' } };
    expect(parse(authSchemas.register, data).success).toBe(false);
  });

  test('rejects firstName shorter than 2 characters', () => {
    const data = { ...valid, body: { ...valid.body, firstName: 'A' } };
    expect(parse(authSchemas.register, data).success).toBe(false);
  });

  test('rejects lastName shorter than 2 characters', () => {
    const data = { ...valid, body: { ...valid.body, lastName: 'S' } };
    expect(parse(authSchemas.register, data).success).toBe(false);
  });

  test('rejects missing email', () => {
    const { email, ...noEmail } = valid.body;
    expect(parse(authSchemas.register, { body: noEmail }).success).toBe(false);
  });
});

// ─── login schema ─────────────────────────────────────────────────────────────
describe('authSchemas.login', () => {
  const valid = {
    body: { email: 'bob@example.com', password: 'anyPassword' },
  };

  test('accepts valid login data', () => {
    expect(parse(authSchemas.login, valid).success).toBe(true);
  });

  test('accepts optional twoFactorCode', () => {
    const data = { body: { ...valid.body, twoFactorCode: '123456' } };
    expect(parse(authSchemas.login, data).success).toBe(true);
  });

  test('rejects invalid email', () => {
    const data = { body: { ...valid.body, email: 'bad' } };
    expect(parse(authSchemas.login, data).success).toBe(false);
  });

  test('rejects missing password', () => {
    expect(parse(authSchemas.login, { body: { email: 'bob@example.com' } }).success).toBe(false);
  });
});

// ─── forgotPassword schema ───────────────────────────────────────────────────
describe('authSchemas.forgotPassword', () => {
  test('accepts valid email', () => {
    expect(parse(authSchemas.forgotPassword, { body: { email: 'a@b.com' } }).success).toBe(true);
  });

  test('rejects invalid email', () => {
    expect(parse(authSchemas.forgotPassword, { body: { email: 'invalid' } }).success).toBe(false);
  });

  test('rejects missing email', () => {
    expect(parse(authSchemas.forgotPassword, { body: {} }).success).toBe(false);
  });
});

// ─── resetPassword schema ────────────────────────────────────────────────────
describe('authSchemas.resetPassword', () => {
  const valid = {
    body: { token: 'some-token', newPassword: 'NewPass1!' },
  };

  test('accepts valid data', () => {
    expect(parse(authSchemas.resetPassword, valid).success).toBe(true);
  });

  test('rejects weak newPassword', () => {
    const data = { body: { ...valid.body, newPassword: 'weak' } };
    expect(parse(authSchemas.resetPassword, data).success).toBe(false);
  });

  test('rejects missing token', () => {
    expect(parse(authSchemas.resetPassword, { body: { newPassword: 'NewPass1!' } }).success).toBe(false);
  });
});

// ─── verifyEmail schema ───────────────────────────────────────────────────────
describe('authSchemas.verifyEmail', () => {
  test('accepts params with token', () => {
    expect(parse(authSchemas.verifyEmail, { params: { token: 'abc123' } }).success).toBe(true);
  });

  test('rejects missing token in params', () => {
    expect(parse(authSchemas.verifyEmail, { params: {} }).success).toBe(false);
  });
});

// ─── verify2FA schema ────────────────────────────────────────────────────────
describe('authSchemas.verify2FA', () => {
  test('accepts 6-digit token', () => {
    expect(parse(authSchemas.verify2FA, { body: { token: '123456' } }).success).toBe(true);
  });

  test('rejects token with wrong length', () => {
    expect(parse(authSchemas.verify2FA, { body: { token: '12345' } }).success).toBe(false);
    expect(parse(authSchemas.verify2FA, { body: { token: '1234567' } }).success).toBe(false);
  });

  test('rejects missing token', () => {
    expect(parse(authSchemas.verify2FA, { body: {} }).success).toBe(false);
  });
});

// ─── refreshToken schema ─────────────────────────────────────────────────────
describe('authSchemas.refreshToken', () => {
  test('accepts body with refreshToken', () => {
    expect(parse(authSchemas.refreshToken, { body: { refreshToken: 'tok' } }).success).toBe(true);
  });

  test('accepts body without refreshToken (optional)', () => {
    expect(parse(authSchemas.refreshToken, { body: {} }).success).toBe(true);
  });
});
