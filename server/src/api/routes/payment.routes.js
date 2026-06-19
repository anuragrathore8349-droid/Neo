const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

/**
 * Public routes
 */
// Get all available plans
router.get('/plans', paymentController.getAvailablePlans);

// Stripe webhook (must be before authenticate middleware)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleStripeWebhook);

/**
 * Protected routes (require authentication)
 */

// Get user's current subscription
router.get('/subscription', authMiddleware, paymentController.getUserSubscription);

// Create checkout session for plan upgrade
router.post('/checkout', authMiddleware, paymentController.createCheckoutSession);

// Cancel subscription
router.post('/cancel', authMiddleware, paymentController.cancelSubscription);

// Update payment method
router.put('/payment-method', authMiddleware, paymentController.updatePaymentMethod);

// Get billing history
router.get('/billing-history', authMiddleware, paymentController.getBillingHistory);

module.exports = router;
