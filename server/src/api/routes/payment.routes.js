const express          = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const paymentController  = require('../controllers/payment.controller');

const router = express.Router();

// ── Public (no auth) ─────────────────────────────────────────────────────────
router.get('/plans', paymentController.getPlans);

// ── Stripe Webhook (raw body, no auth, no JSON parser) ───────────────────────
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentController.handleWebhook
);

// ── Protected ────────────────────────────────────────────────────────────────
router.use(authMiddleware);
router.get('/subscription',          paymentController.getSubscription);
router.post('/checkout',             paymentController.createCheckout);
router.post('/cancel',               paymentController.cancelSubscription);
router.post('/portal',               paymentController.createPortalSession);

module.exports = router;
