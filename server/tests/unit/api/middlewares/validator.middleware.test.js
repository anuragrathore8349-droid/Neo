'use strict';

const { z } = require('zod');
const Joi = require('joi');
const { validateRequest } = require('../../api/middlewares/validator.middleware');

// ─── helpers ─────────────────────────────────────────────────────────────────
const makeReq = (overrides = {}) => ({
  body: {},
  query: {},
  params: {},
  ...overrides,
});

const makeRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

// ─── Zod schema tests ────────────────────────────────────────────────────────
describe('validateRequest with Zod schema', () => {
  const schema = z.object({
    body: z.object({
      name: z.string().min(2),
      age: z.number().min(0),
    }),
  });

  test('calls next() when body is valid', () => {
    const mw = validateRequest(schema);
    const req = makeReq({ body: { name: 'Alice', age: 30 } });
    const res = makeRes();
    const next = jest.fn();

    mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.validatedData.body).toMatchObject({ name: 'Alice', age: 30 });
  });

  test('returns 422 when body fails Zod validation', () => {
    const mw = validateRequest(schema);
    const req = makeReq({ body: { name: 'A', age: -1 } }); // name too short, age negative
    const res = makeRes();
    const next = jest.fn();

    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', message: 'Validation failed' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('includes field-level details in 422 response', () => {
    const mw = validateRequest(schema);
    const req = makeReq({ body: { name: 'A' } }); // missing age
    const res = makeRes();
    mw(req, res, jest.fn());
    const call = res.json.mock.calls[0][0];
    expect(Array.isArray(call.details)).toBe(true);
    expect(call.details.length).toBeGreaterThan(0);
  });

  test('validates query params separately', () => {
    const s = z.object({ query: z.object({ limit: z.coerce.number().min(1) }) });
    const mw = validateRequest(s);
    const req = makeReq({ query: { limit: '10' } });
    const res = makeRes();
    const next = jest.fn();

    mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.validatedData.query.limit).toBe(10);
  });

  test('validates path params', () => {
    const s = z.object({ params: z.object({ id: z.string().uuid() }) });
    const mw = validateRequest(s);
    const req = makeReq({ params: { id: '00000000-0000-0000-0000-000000000000' } });
    const res = makeRes();
    const next = jest.fn();

    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('returns 422 for invalid UUID in params', () => {
    const s = z.object({ params: z.object({ id: z.string().uuid() }) });
    const mw = validateRequest(s);
    const req = makeReq({ params: { id: 'not-a-uuid' } });
    const res = makeRes();
    mw(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(422);
  });
});

// ─── Joi schema tests ────────────────────────────────────────────────────────
describe('validateRequest with Joi schema', () => {
  const schema = {
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
    }),
  };

  test('calls next() when Joi body is valid', () => {
    const mw = validateRequest(schema);
    const req = makeReq({ body: { email: 'test@example.com', password: 'secure123' } });
    const res = makeRes();
    const next = jest.fn();

    mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('returns 422 when Joi body is invalid', () => {
    const mw = validateRequest(schema);
    const req = makeReq({ body: { email: 'not-an-email', password: '123' } });
    const res = makeRes();
    const next = jest.fn();

    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(next).not.toHaveBeenCalled();
  });

  test('strips unknown fields from body', () => {
    const mw = validateRequest(schema);
    const req = makeReq({
      body: { email: 'test@example.com', password: 'secure123', evil: 'injection' },
    });
    const res = makeRes();
    const next = jest.fn();

    mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.validatedData.body).not.toHaveProperty('evil');
  });

  test('includes field details in error response', () => {
    const mw = validateRequest(schema);
    const req = makeReq({ body: {} });
    const res = makeRes();
    mw(req, res, jest.fn());
    const call = res.json.mock.calls[0][0];
    expect(Array.isArray(call.details)).toBe(true);
  });
});

// ─── edge cases ──────────────────────────────────────────────────────────────
describe('validateRequest edge cases', () => {
  test('skips validation when schema has no body/query/params', () => {
    const mw = validateRequest({});
    const req = makeReq({ body: { anything: true } });
    const res = makeRes();
    const next = jest.fn();

    mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('initializes req.validatedData as empty object', () => {
    const mw = validateRequest({});
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    mw(req, res, next);
    expect(req.validatedData).toEqual({});
  });
});
