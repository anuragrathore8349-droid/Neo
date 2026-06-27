// server/src/services/payment.service.js
'use strict';

const Subscription = require('../models/subscription.model');
const User = require('../models/user.model');
const { PLANS, getPlanById } = require('../config/plans.config');
const { logger } = require('../api/middlewares/logger.middleware');
const emailService = require('./email.service');

const stripe = process.env.STRIPE_SECRET_KEY
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

class PaymentService {
  getAvailablePlans() {
    return Object.values(PLANS);
  }

  async getUserSubscription(userId) {
    const subscription = await Subscription.findOne({ userId });
    const user = await User.findById(userId).select('plan subscription email firstName lastName');
    return {
      subscription,
      currentPlan: user?.plan || 'basic',
      features: user?.subscription || {},
    };
  }

  async selectFreePlan(userId) {
    const plan = getPlanById('basic');

    await Subscription.findOneAndUpdate(
      { userId },
      {
        userId,
        planId: 'basic',
        planName: plan.name,
        price: plan.price,
        billingCycle: 'monthly',
        status: 'active',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        features: {
          maxTransactions: typeof plan.features.maxTransactions === 'number' ? plan.features.maxTransactions : 0,
          advancedAnalytics: !!plan.features.advancedAnalytics,
          realTimeData: !!plan.features.realTimeData,
          aiInsights: !!plan.features.aiInsights,
          defiIntegration: !!plan.features.defiIntegration,
          customIntegrations: !!plan.features.customIntegrations,
          dedicatedSupport: !!plan.features.dedicatedSupport,
          apiAccess: !!plan.features.apiAccess,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await User.findByIdAndUpdate(userId, {
      plan: 'basic',
      'subscription.status': 'active',
    });

    return { planId: 'basic', status: 'active' };
  }

  async createCheckoutSession(userId, planId, successUrl, cancelUrl) {
    let plan;
    try {
      plan = getPlanById(planId);
    } catch (e) {
      throw httpError(`Unknown plan: ${planId}`, 400);
    }

    if (!plan.stripePriceId || plan.price === 0) {
      const result = await this.selectFreePlan(userId);
      return { free: true, ...result };
    }

    if (!stripe) throw httpError('Stripe is not configured. Set STRIPE_SECRET_KEY.', 503);

    const placeholderPrices = ['price_1234567890', 'price_0987654321'];
    if (placeholderPrices.includes(plan.stripePriceId)) {
      throw httpError(
        `Stripe price ID for "${plan.name}" plan is not configured. Please set STRIPE_PRICE_ID_${plan.id.toUpperCase()} env variable.`,
        503
      );
    }

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

  async cancelSubscription(userId) {
    const subscription = await Subscription.findOne({ userId, status: 'active' });

    if (!subscription) {
      throw httpError('No active subscription found.', 404);
    }

    if (!subscription.stripeSubscriptionId) {
      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date();
      await subscription.save();
      await User.findByIdAndUpdate(userId, {
        plan: 'basic',
        'subscription.status': 'cancelled',
      });
      return { message: 'Subscription cancelled', cancelAt: new Date() };
    }

    if (!stripe) throw httpError('Stripe is not configured.', 503);

    const updated = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    subscription.cancelAtPeriodEnd = true;
    subscription.cancelAt = new Date(updated.cancel_at * 1000);
    await subscription.save();

    return { message: 'Subscription will cancel at period end', cancelAt: subscription.cancelAt };
  }

  async updatePaymentMethod(userId, paymentMethodId) {
    if (!stripe) throw httpError('Stripe is not configured.', 503);

    const subscription = await Subscription.findOne({ userId });
    if (!subscription?.stripeCustomerId) throw httpError('No Stripe customer found.', 404);

    await stripe.customers.update(subscription.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: subscription.stripeCustomerId,
    });

    return { message: 'Payment method updated successfully.' };
  }

  async getBillingHistory(userId) {
    const subscription = await Subscription.findOne({ userId });

    if (!subscription?.stripeCustomerId || !stripe) {
      return [];
    }

    try {
      const invoices = await stripe.invoices.list({
        customer: subscription.stripeCustomerId,
        limit: 50,
      });

      return invoices.data.map(invoice => ({
        id: invoice.id,
        amount: invoice.amount_paid / 100,
        date: new Date(invoice.created * 1000).toISOString(),
        status: invoice.status === 'paid' ? 'succeeded' : invoice.status === 'open' ? 'pending' : 'failed',
        invoiceUrl: invoice.hosted_invoice_url,
        pdfUrl: invoice.invoice_pdf,
        period: {
          start: invoice.period_start,
          end: invoice.period_end,
        },
      }));
    } catch (error) {
      logger.error('Failed to fetch billing history:', error.message);
      return [];
    }
  }

  async handleWebhook(rawBody, signature) {
    if (!stripe) throw httpError('Stripe is not configured.', 503);

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw httpError('STRIPE_WEBHOOK_SECRET is not set.', 503);

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      logger.error('Stripe webhook signature verification failed:', err.message);
      throw httpError(`Webhook signature invalid: ${err.message}`, 400);
    }

    logger.info(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this._handleCheckoutComplete(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await this._handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await this._handlePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this._handleSubscriptionDeleted(event.data.object);
        break;
      default:
        logger.debug(`Unhandled Stripe event: ${event.type}`);
    }

    return { received: true };
  }

  async createPortalSession(userId, returnUrl) {
    if (!stripe) throw httpError('Stripe is not configured. Set STRIPE_SECRET_KEY.', 503);

    const subscription = await Subscription.findOne({ userId });
    if (!subscription?.stripeCustomerId) {
      throw httpError('No Stripe customer found for this user.', 404);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl || `${process.env.APP_URL}/billing`,
    });

    return { url: session.url };
  }

  // ── Private webhook handlers ──────────────────────────────────────────────

  async _handleCheckoutComplete(session) {
    const { userId, planId } = session.metadata || {};
    if (!userId || !planId) {
      logger.error('Webhook: missing userId or planId in session metadata');
      return;
    }

    let plan;
    try {
      plan = getPlanById(planId);
    } catch (e) {
      logger.error(`Webhook: unknown planId ${planId}`);
      return;
    }

    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // ✅ FIX: Upsert subscription record with ALL stripe fields
    await Subscription.findOneAndUpdate(
      { userId },
      {
        userId,
        planId,
        planName: plan.name,
        price: plan.price,
        billingCycle: 'monthly',
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        status: 'active',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        features: {
          maxTransactions: plan.features.maxTransactions === 'Unlimited' ? 999999 : (plan.features.maxTransactions || 0),
          advancedAnalytics: !!plan.features.advancedAnalytics,
          realTimeData: !!plan.features.realTimeData,
          aiInsights: !!plan.features.aiInsights,
          defiIntegration: !!plan.features.defiIntegration,
          customIntegrations: !!plan.features.customIntegrations,
          dedicatedSupport: !!plan.features.dedicatedSupport,
          apiAccess: !!plan.features.apiAccess,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // ✅ FIX: Fully update User document — plan AND subscription sub-doc
    await User.findByIdAndUpdate(userId, {
      plan: planId,
      'subscription.stripeCustomerId': session.customer,
      'subscription.stripeSubscriptionId': session.subscription,
      'subscription.planId': planId,
      'subscription.status': 'active',
      'subscription.currentPeriodStart': new Date(),
      'subscription.currentPeriodEnd': periodEnd,
    });

    logger.info(`✅ Subscription activated: user=${userId} plan=${planId}`);

    // ✅ FIX: Send upgrade confirmation email
    try {
      const user = await User.findById(userId).select('email firstName lastName');
      if (user?.email) {
        await emailService.sendSubscriptionUpgradeEmail({
          to: user.email,
          name: `${user.firstName} ${user.lastName}`.trim() || 'Valued Customer',
          planId,
          planName: plan.name,
          price: plan.price,
          nextBillingDate: periodEnd,
        });
        logger.info(`📧 Upgrade email sent to ${user.email}`);
      }
    } catch (emailErr) {
      // Don't fail webhook if email fails
      logger.error('Failed to send upgrade email:', emailErr.message);
    }
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

    // Also keep User in sync
    await User.findByIdAndUpdate(userId, {
      'subscription.status': 'active',
      'subscription.currentPeriodEnd': new Date(sub.current_period_end * 1000),
    });

    logger.info(`Payment succeeded for subscription ${invoice.subscription}`);
  }

  async _handlePaymentFailed(invoice) {
    if (!invoice.subscription) return;
    const sub = await stripe.subscriptions.retrieve(invoice.subscription);
    const userId = sub.metadata?.userId;
    if (!userId) return;

    await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: invoice.subscription },
      { status: 'past_due' }
    );
    await User.findByIdAndUpdate(userId, { 'subscription.status': 'past_due' });
    logger.warn(`Payment failed for user ${userId}`);
  }

  async _handleSubscriptionDeleted(stripeSub) {
    const userId = stripeSub.metadata?.userId;

    await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: stripeSub.id },
      { status: 'cancelled', cancelledAt: new Date() }
    );

    if (userId) {
      await User.findByIdAndUpdate(userId, {
        plan: 'basic',
        'subscription.status': 'cancelled',
        'subscription.cancelledAt': new Date(),
      });
    }
    logger.info(`Subscription cancelled: ${stripeSub.id}`);
  }
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = new PaymentService();
