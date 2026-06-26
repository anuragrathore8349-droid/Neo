const paymentService = require('../../services/payment.service');
const { logger }     = require('../middlewares/logger.middleware');

class PaymentController {
  getPlans(req, res, next) {
    try {
      const plans = paymentService.getAvailablePlans();
      res.json({ status: 'success', data: plans });
    } catch (error) { next(error); }
  }

  async getSubscription(req, res, next) {
    try {
      const data = await paymentService.getUserSubscription(req.user.userId);
      res.json({ status: 'success', data });
    } catch (error) { next(error); }
  }

  async createCheckout(req, res, next) {
    try {
      const { planId, successUrl, cancelUrl } = req.body;
      const session = await paymentService.createCheckoutSession(
        req.user.userId, planId, successUrl, cancelUrl
      );
      res.json({ status: 'success', data: session });
    } catch (error) { next(error); }
  }

  async cancelSubscription(req, res, next) {
    try {
      const result = await paymentService.cancelSubscription(req.user.userId);
      res.json({ status: 'success', data: result });
    } catch (error) { next(error); }
  }

  async createPortalSession(req, res, next) {
    try {
      const { returnUrl } = req.body;
      const session = await paymentService.createPortalSession(req.user.userId, returnUrl);
      res.json({ status: 'success', data: session });
    } catch (error) { next(error); }
  }

  async getBillingHistory(req, res, next) {
    try {
      const history = await paymentService.getBillingHistory(req.user.userId);
      res.json({ status: 'success', data: history });
    } catch (error) { next(error); }
  }

  // ── Stripe Webhook ────────────────────────────────────────────────────────
  async handleWebhook(req, res, next) {
    const sig = req.headers['stripe-signature'];
    try {
      const result = await paymentService.handleWebhook(req.body, sig);
      res.json(result);
    } catch (error) {
      logger.error('Stripe webhook error:', error.message);
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new PaymentController();
