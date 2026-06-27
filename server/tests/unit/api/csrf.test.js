'use strict';

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const responseNormaliser = require('../../src/utils/responseNormaliser');

describe('CSRF token endpoint', () => {
  test('returns a csrf token inside the standard success envelope', () => {
    const app = express();
    app.use(cookieParser());
    app.use((req, res, next) => {
      const oldJson = res.json.bind(res);
      res.json = (body) => {
        if (body && (body.status === 'success' || body.status === 'error')) {
          return oldJson(body);
        }
        return oldJson(responseNormaliser.success(body));
      };
      next();
    });

    const csrfProtection = csurf({
      cookie: { httpOnly: true, sameSite: 'lax' },
    });

    app.get('/csrf-token', csrfProtection, (req, res) => {
      res.json({ csrfToken: req.csrfToken() });
    });

    return request(app)
      .get('/csrf-token')
      .expect(200)
      .then((response) => {
        expect(response.body.status).toBe('success');
        expect(response.body.data).toEqual(expect.objectContaining({ csrfToken: expect.any(String) }));
      });
  });
});
