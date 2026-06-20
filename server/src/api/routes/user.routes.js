const express = require('express');
const { validateRequest } = require('../middlewares/validator.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');
const userController = require('../controllers/user.controller');
const { avatarUpload } = require('../controllers/user.controller');
const { userSchemas } = require('../validators/user.validator');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Profile routes
router.get('/profile',
  userController.getProfile
);

router.put('/profile',
  validateRequest(userSchemas.updateProfile),
  userController.updateProfile
);

// Avatar upload route
router.post('/avatar',
  avatarUpload,
  userController.uploadAvatar
);

// Password routes
router.put('/password',
  validateRequest(userSchemas.changePassword),
  userController.changePassword
);

// Notification settings routes
router.get('/notifications',
  userController.getNotificationSettings
);

router.put('/notifications',
  validateRequest(userSchemas.updateNotifications),
  userController.updateNotificationSettings
);

// API key routes
router.get('/api-keys',
  userController.getApiKeys
);

router.post('/api-keys',
  validateRequest(userSchemas.createApiKey),
  userController.saveApiKey
);

router.delete('/api-keys/:id',
  validateRequest(userSchemas.deleteApiKey),
  userController.deleteApiKey
);

// Security status route
router.get('/security-status',
  userController.getSecurityStatus
);

// Session management routes
router.get('/sessions', userController.getSessions);
router.delete('/sessions/:id', userController.removeSession);

// Device management routes
router.get('/devices', userController.getDevices);
router.delete('/devices/:id', userController.revokeDevice);

// Activity log routes
router.get('/activity', userController.getActivityLog);

// Delete account
router.delete('/account', userController.deleteAccount);

module.exports = router;
