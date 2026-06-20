const express = require('express');
const { validateRequest } = require('../middlewares/validator.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');
const authController = require('../controllers/auth.controller');
const { authSchemas } = require('../validators/auth.validator');

const router = express.Router();

router.post('/register',
  validateRequest(authSchemas.register),
  authController.register
);

router.post('/login',
  validateRequest(authSchemas.login),
  authController.login
);

router.post('/refresh-token',
  validateRequest(authSchemas.refreshToken),
  authController.refreshToken
);

router.post('/logout',
  authMiddleware,
  validateRequest(authSchemas.logout),
  authController.logout
);

router.post('/forgot-password',
  validateRequest(authSchemas.forgotPassword),
  authController.forgotPassword
);

router.post('/reset-password',
  validateRequest(authSchemas.resetPassword),
  authController.resetPassword
);

router.get('/verify-email/:token',
  validateRequest(authSchemas.verifyEmail),
  authController.verifyEmail
);

router.post('/2fa/setup',
  authMiddleware,
  authController.setup2FA
);

router.post('/2fa/verify',
  authMiddleware,
  validateRequest(authSchemas.verify2FA),
  authController.verify2FA
);

module.exports = router;