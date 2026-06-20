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
exports.handleWebhook = async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).json({ error: 'Webhook secret not configured' });
  }

  let event;
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    const paymentService = require('../../services/payment.service');
    await paymentService.handleWebhookEvent(event);
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
};
