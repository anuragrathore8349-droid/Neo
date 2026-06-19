'use strict';

const Subscription = require('../models/subscription.model');
const User = require('../models/user.model');
const { PLANS, getPlanById } = require('../config/plans.config');
const { logger } = require('../api/middlewares/logger.middleware');

const stripe = process.env.STRIPE_SECRET_KEY
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

class PaymentService {
  /**
   * Get all available subscription plans
   */
  getAvailablePlans() {
    return Object.values(PLANS);
  }

  /**
   * Get a user's current subscription from DB
   */
  async getUserSubscription(userId) {
    const subscription = await Subscription.findOne({ userId });
    const user = await User.findById(userId).select('plan subscription');
    return {
      subscription,
      currentPlan: user?.plan || 'basic',
      features: user?.subscription || {},
    };
  }

  /**
   * Create a Stripe Checkout Session for a plan upgrade
   */
  async createCheckoutSession(userId, planId, successUrl, cancelUrl) {
    if (!stripe) throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');

    const plan = getPlanById(planId);
    if (!plan) throw new Error(`Unknown plan: ${planId}`);
    if (!plan.stripePriceId) throw new Error(`Plan "${planId}" has no Stripe price ID.`);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: successUrl || `${process.env.APP_URL}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.APP_URL}/subscription-cancelled`,
      metadata: { userId: userId.toString(), planId },
    });

    return { sessionId: session.id, url: session.url };
  }

  /**
   * Cancel a user's active Stripe subscription at period end
   */
  async cancelSubscription(userId) {
    if (!stripe) throw new Error('Stripe is not configured.');

    const subscription = await Subscription.findOne({ userId, status: 'active' });
    if (!subscription?.stripeSubscriptionId) {
      throw new Error('No active subscription found.');
    }

    const updated = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    subscription.cancelAtPeriodEnd = true;
    subscription.cancelAt = new Date(updated.cancel_at * 1000);
    await subscription.save();

    return { message: 'Subscription will cancel at period end', cancelAt: subscription.cancelAt };
  }

  /**
   * Update default payment method on Stripe customer
   */
  async updatePaymentMethod(userId, paymentMethodId) {
    if (!stripe) throw new Error('Stripe is not configured.');

    const subscription = await Subscription.findOne({ userId });
    if (!subscription?.stripeCustomerId) throw new Error('No Stripe customer found.');

    await stripe.customers.update(subscription.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: subscription.stripeCustomerId,
    });

    return { message: 'Payment method updated successfully.' };
  }

  /**
   * Get billing history (invoices) from Stripe
   */
  async getBillingHistory(userId) {
    if (!stripe) throw new Error('Stripe is not configured.');

    const subscription = await Subscription.findOne({ userId });
    if (!subscription?.stripeCustomerId) return [];

    const invoices = await stripe.invoices.list({
      customer: subscription.stripeCustomerId,
      limit: 24,
    });

    return invoices.data.map(inv => ({
      id: inv.id,
      amount: inv.amount_paid / 100,
      currency: inv.currency.toUpperCase(),
      status: inv.status,
      date: new Date(inv.created * 1000).toISOString(),
      pdf: inv.invoice_pdf,
      description: inv.lines?.data?.[0]?.description || '',
    }));
  }

  /**
   * Handle Stripe webhook events — call this from the controller
   * @param {Buffer} rawBody  - raw request body (express.raw middleware)
   * @param {string} signature - stripe-signature header
   */
  async handleWebhook(rawBody, signature) {
    if (!stripe) throw new Error('Stripe is not configured.');

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not set.');

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      logger.error('Stripe webhook signature verification failed:', err.message);
      throw new Error(`Webhook signature invalid: ${err.message}`);
    }

    logger.info(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await this._handleCheckoutComplete(session);
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        await this._handlePaymentSucceeded(invoice);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await this._handlePaymentFailed(invoice);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await this._handleSubscriptionDeleted(sub);
        break;
      }
      default:
        logger.debug(`Unhandled Stripe event: ${event.type}`);
    }

    return { received: true };
  }

  // ── Private webhook handlers ──────────────────────────────────────────────

  async _handleCheckoutComplete(session) {
    const { userId, planId } = session.metadata || {};
    if (!userId || !planId) return;

    const plan = getPlanById(planId);
    if (!plan) return;

    // Upsert subscription record
    await Subscription.findOneAndUpdate(
      { userId },
      {
        userId,
        planId,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
      },
      { upsert: true, new: true }
    );

    // Update user's plan
    await User.findByIdAndUpdate(userId, {
      plan: planId,
      'subscription.features': plan.features,
    });

    logger.info(`Subscription activated: user=${userId} plan=${planId}`);
  }

  async _handlePaymentSucceeded(invoice) {
    if (!invoice.subscription) return;

    const sub = await stripe.subscriptions.retrieve(invoice.subscription);
    const userId = sub.metadata?.userId;
    if (!userId) return;

    await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: invoice.subscription },
      {
        status: 'active',
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      }
    );
    logger.info(`Payment succeeded for subscription ${invoice.subscription}`);
  }

  async _handlePaymentFailed(invoice) {
    const sub = await stripe.subscriptions.retrieve(invoice.subscription);
    const userId = sub.metadata?.userId;
    if (!userId) return;

    await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: invoice.subscription },
      { status: 'past_due' }
    );
    logger.warn(`Payment failed for user ${userId}`);
  }

  async _handleSubscriptionDeleted(stripeSub) {
    const userId = stripeSub.metadata?.userId;

    await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: stripeSub.id },
      { status: 'cancelled' }
    );

    if (userId) {
      await User.findByIdAndUpdate(userId, { plan: 'basic' });
    }
    logger.info(`Subscription cancelled: ${stripeSub.id}`);
  }
}

module.exports = new PaymentService();
