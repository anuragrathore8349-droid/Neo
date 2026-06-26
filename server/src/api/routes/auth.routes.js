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

router.post('/resend-verification',
  authMiddleware,
  authController.resendVerification
);

router.post('/login',
  validateRequest(authSchemas.login),
  authController.login
);

router.post('/refresh-token',
  validateRequest(authSchemas.refreshToken),
  authController.refreshToken
);

// NOTE: logout intentionally does NOT require authMiddleware.
// If the access token has already expired, the user must still be able
// to clear their session/refresh-token cookie. The refresh token itself
// (cookie or body) is what identifies the session to invalidate.
router.post('/logout',
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

router.post('/2fa/disable',
  authMiddleware,
  authController.disable2FA
);

module.exports = router;