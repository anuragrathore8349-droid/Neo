'use strict';

const paymentService = require('../../services/payment.service');

/**
 * Get all available plans
 */
exports.getAvailablePlans = async (req, res) => {
  try {
    const plans = paymentService.getAvailablePlans();
    res.json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get user's current subscription
 */
exports.getUserSubscription = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const data = await paymentService.getUserSubscription(userId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create Stripe Checkout Session
 */
exports.createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { planId, successUrl, cancelUrl } = req.body;
    if (!planId) return res.status(400).json({ success: false, message: 'planId is required' });

    const session = await paymentService.createCheckoutSession(userId, planId, successUrl, cancelUrl);
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Cancel subscription
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const result = await paymentService.cancelSubscription(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update payment method
 */
exports.updatePaymentMethod = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { paymentMethodId } = req.body;
    if (!paymentMethodId) return res.status(400).json({ success: false, message: 'paymentMethodId is required' });

    const result = await paymentService.updatePaymentMethod(userId, paymentMethodId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get billing history
 */
exports.getBillingHistory = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const history = await paymentService.getBillingHistory(userId);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Stripe Webhook — MUST use express.raw body (already set in routes)
 */
exports.handleStripeWebhook = async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).json({ error: 'Missing stripe-signature header' });

    const result = await paymentService.handleWebhook(req.body, signature);
    res.json(result);
  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(400).json({ error: error.message });
  }
};
