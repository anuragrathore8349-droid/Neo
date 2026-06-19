const User = require('../../models/user.model');
const Subscription = require('../../models/subscription.model');
const { PLANS, getPlanById } = require('../../config/plans.config');

// Initialize Stripe only if key is provided
const stripe = process.env.STRIPE_SECRET_KEY 
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

/**
 * Get all available plans
 */
exports.getAvailablePlans = async (req, res) => {
  try {
    const plans = Object.values(PLANS);
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get user's current subscription
 */
exports.getUserSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const subscription = await Subscription.findOne({ userId });
    const user = await User.findById(userId);
    
    res.json({
      success: true,
      data: {
        subscription,
        currentPlan: user.plan,
        features: user.subscription
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create checkout session for plan upgrade
 */
exports.createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId } = req.body;
    
    // Validate plan
    const plan = getPlanById(planId);
    
    // Free plan - no payment needed
    if (planId === 'basic') {
      // Set user to basic plan
      const user = await User.findByIdAndUpdate(
        userId,
        {
          plan: 'basic',
          'subscription.status': 'active',
          'subscription.planId': 'basic'
        },
        { new: true }
      );
      
      // Create subscription record
      await Subscription.create({
        userId,
        planId: 'basic',
        planName: 'Basic',
        price: 0,
        status: 'active',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        features: plan.features,
        isTrialActive: false
      });
      
      return res.json({
        success: true,
        message: 'Successfully activated Basic plan',
        data: user
      });
    }

    // Check if Stripe is configured for paid plans
    if (!stripe) {
      return res.status(503).json({
        success: false,
        message: 'Payment system is not configured. Please contact support.',
        requiresSupport: true
      });
    }
    
    const user = await User.findById(userId);
    
    // Get or create Stripe customer
    let customerId = user.subscription?.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId }
      });
      customerId = customer.id;
      
      // Update user with stripe customer ID
      user.subscription = user.subscription || {};
      user.subscription.stripeCustomerId = customerId;
      await user.save();
    }
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1
        }
      ],
      success_url: `${process.env.FRONTEND_URL}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription-cancelled`,
      metadata: {
        userId,
        planId
      }
    });
    
    res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Handle Stripe webhook for subscription events
 */
exports.handleStripeWebhook = async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ 
      success: false, 
      message: 'Payment system not configured' 
    });
  }

  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
    }
    
    res.json({ received: true });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Handle successful checkout
 */
async function handleCheckoutSessionCompleted(session) {
  const userId = session.metadata.userId;
  const planId = session.metadata.planId;
  const plan = getPlanById(planId);
  
  const user = await User.findById(userId);
  
  // Update user plan
  user.plan = planId;
  user.subscription.stripeCustomerId = session.customer;
  user.subscription.stripeSubscriptionId = session.subscription;
  user.subscription.status = 'active';
  user.subscription.planId = planId;
  user.subscription.currentPeriodStart = new Date();
  user.subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await user.save();
  
  // Create or update subscription record
  await Subscription.findOneAndUpdate(
    { userId },
    {
      userId,
      planId,
      planName: plan.name,
      price: plan.price,
      status: 'active',
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      startDate: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      features: plan.features
    },
    { upsert: true, new: true }
  );
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(subscription) {
  const subscription_db = await Subscription.findOne({
    stripeSubscriptionId: subscription.id
  });
  
  if (subscription_db) {
    subscription_db.status = subscription.status;
    subscription_db.currentPeriodStart = new Date(subscription.current_period_start * 1000);
    subscription_db.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    await subscription_db.save();
    
    // Update user
    await User.findByIdAndUpdate(subscription_db.userId, {
      'subscription.status': subscription.status,
      'subscription.currentPeriodStart': new Date(subscription.current_period_start * 1000),
      'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000)
    });
  }
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscription) {
  const subscription_db = await Subscription.findOne({
    stripeSubscriptionId: subscription.id
  });
  
  if (subscription_db) {
    subscription_db.status = 'cancelled';
    subscription_db.cancelledAt = new Date();
    await subscription_db.save();
    
    // Downgrade user to basic plan
    await User.findByIdAndUpdate(subscription_db.userId, {
      plan: 'basic',
      'subscription.status': 'cancelled',
      'subscription.cancelledAt': new Date()
    });
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice) {
  const subscription_db = await Subscription.findOne({
    stripeSubscriptionId: invoice.subscription
  });
  
  if (subscription_db) {
    subscription_db.payments.push({
      stripePaymentIntentId: invoice.payment_intent,
      amount: invoice.amount_paid / 100, // Convert from cents
      date: new Date(invoice.created * 1000),
      status: 'succeeded',
      invoiceUrl: invoice.hosted_invoice_url
    });
    await subscription_db.save();
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice) {
  const subscription_db = await Subscription.findOne({
    stripeSubscriptionId: invoice.subscription
  });
  
  if (subscription_db) {
    subscription_db.payments.push({
      stripePaymentIntentId: invoice.payment_intent,
      amount: invoice.amount_due / 100,
      date: new Date(invoice.created * 1000),
      status: 'failed'
    });
    await subscription_db.save();
  }
}

/**
 * Cancel subscription
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const subscription = await Subscription.findOne({ userId });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }
    
    // Cancel in Stripe (only if Stripe is configured and subscription exists)
    if (stripe && subscription.stripeSubscriptionId) {
      await stripe.subscriptions.del(subscription.stripeSubscriptionId);
    }
    
    // Update database
    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.autoRenew = false;
    await subscription.save();
    
    // Downgrade user to basic
    await User.findByIdAndUpdate(userId, {
      plan: 'basic',
      'subscription.status': 'cancelled',
      'subscription.autoRenew': false
    });
    
    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update payment method
 */
exports.updatePaymentMethod = async (req, res) => {
  try {
    const userId = req.user.id;
    const { paymentMethodId } = req.body;
    
    if (!stripe) {
      return res.status(503).json({
        success: false,
        message: 'Payment system is not configured'
      });
    }
    
    const user = await User.findById(userId);
    const subscription = await Subscription.findOne({ userId });
    
    if (!subscription || !subscription.stripeSubscriptionId) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }
    
    // Update in Stripe
    await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        default_payment_method: paymentMethodId
      }
    );
    
    // Update in database
    subscription.stripePaymentMethodId = paymentMethodId;
    await subscription.save();
    
    res.json({
      success: true,
      message: 'Payment method updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get billing history
 */
exports.getBillingHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const subscription = await Subscription.findOne({ userId });
    
    if (!subscription) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    res.json({
      success: true,
      data: subscription.payments || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
