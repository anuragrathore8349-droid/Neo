const express = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const notificationController = require('../controllers/notification.controller');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET all notifications
router.get('/', notificationController.getNotifications);

// GET unread count (specific route before wildcard)
router.get('/unread/count', notificationController.getUnreadCount);

// GET single notification
router.get('/:id', notificationController.getNotification);

// PATCH mark all as read (specific route before wildcard)
router.patch('/mark-all/read', notificationController.markAllAsRead);

// PATCH mark as read
router.patch('/:id/read', notificationController.markAsRead);

// DELETE all notifications (specific route before wildcard)
router.delete('/', notificationController.deleteAllNotifications);

// DELETE single notification
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
