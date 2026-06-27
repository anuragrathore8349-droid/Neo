// server/src/services/email.service.js
const nodemailer = require('nodemailer');
const config = require('../config');
const { logger } = require('../api/middlewares/logger.middleware');

class EmailService {
  constructor() {
    logger.debug('Email: Initializing email service...');

    if (!config.email.host || !config.email.user || !config.email.password) {
      console.warn('📧 SMTP not fully configured - emails will not be sent');
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.password
      }
    });
  }

  async sendEmail({ to, subject, template, context }) {
    if (!this.transporter) {
      console.warn('📧 Email not sent: SMTP not configured');
      return;
    }

    const templates = {
      emailVerification: (ctx) => `
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin:0;padding:0;background:#0f0f14;font-family:'Segoe UI',Arial,sans-serif;">
        <div style="max-width:600px;margin:40px auto;background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid #2a2a3e;">
          <div style="background:linear-gradient(135deg,#7c3aed,#3b82f6);padding:40px 32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;">NeoFin</h1>
            <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Next-Gen Financial Intelligence</p>
          </div>
          <div style="padding:40px 32px;">
            <h2 style="color:#fff;font-size:22px;margin:0 0 16px;">Welcome, ${ctx.name}! 👋</h2>
            <p style="color:#a0a0b8;line-height:1.6;margin:0 0 24px;">Please verify your email address to activate your NeoFin account and start your financial journey.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${ctx.verificationUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#3b82f6);color:#fff;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:600;font-size:16px;">Verify Email Address</a>
            </div>
            <p style="color:#6b7280;font-size:13px;text-align:center;">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
          </div>
          <div style="background:#12121f;padding:20px 32px;text-align:center;border-top:1px solid #2a2a3e;">
            <p style="color:#4b5563;font-size:12px;margin:0;">© ${new Date().getFullYear()} NeoFin. All rights reserved.</p>
          </div>
        </div>
        </body></html>
      `,

      passwordReset: (ctx) => `
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"></head>
        <body style="margin:0;padding:0;background:#0f0f14;font-family:'Segoe UI',Arial,sans-serif;">
        <div style="max-width:600px;margin:40px auto;background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid #2a2a3e;">
          <div style="background:linear-gradient(135deg,#7c3aed,#3b82f6);padding:40px 32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;">NeoFin</h1>
          </div>
          <div style="padding:40px 32px;">
            <h2 style="color:#fff;font-size:22px;margin:0 0 16px;">Password Reset Request 🔐</h2>
            <p style="color:#a0a0b8;line-height:1.6;">Hello ${ctx.name},</p>
            <p style="color:#a0a0b8;line-height:1.6;">We received a request to reset your password. Click below to choose a new one:</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${ctx.resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#3b82f6);color:#fff;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:600;font-size:16px;">Reset My Password</a>
            </div>
            <p style="color:#6b7280;font-size:13px;text-align:center;">This link expires in 1 hour. If you didn't request this, your account is safe — just ignore this email.</p>
          </div>
          <div style="background:#12121f;padding:20px 32px;text-align:center;border-top:1px solid #2a2a3e;">
            <p style="color:#4b5563;font-size:12px;margin:0;">© ${new Date().getFullYear()} NeoFin. All rights reserved.</p>
          </div>
        </div>
        </body></html>
      `,

      priceAlert: (ctx) => `
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"></head>
        <body style="margin:0;padding:0;background:#0f0f14;font-family:'Segoe UI',Arial,sans-serif;">
        <div style="max-width:600px;margin:40px auto;background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid #2a2a3e;">
          <div style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:40px 32px;text-align:center;">
            <div style="font-size:48px;margin-bottom:8px;">🔔</div>
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">Price Alert Triggered</h1>
          </div>
          <div style="padding:40px 32px;">
            <p style="color:#a0a0b8;">Hello ${ctx.name},</p>
            <p style="color:#a0a0b8;">Your price alert for <strong style="color:#fff;">${ctx.symbol}</strong> has been triggered!</p>
            <div style="background:#12121f;border:1px solid #2a2a3e;border-radius:12px;padding:24px;margin:24px 0;">
              <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
                <span style="color:#6b7280;">Condition</span><span style="color:#fff;">Price ${ctx.condition}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
                <span style="color:#6b7280;">Target Price</span><span style="color:#f59e0b;font-weight:600;">$${ctx.targetPrice}</span>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span style="color:#6b7280;">Current Price</span><span style="color:#10b981;font-weight:600;">$${ctx.currentPrice}</span>
              </div>
            </div>
            <div style="text-align:center;">
              <a href="${ctx.actionUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#3b82f6);color:#fff;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:600;">View Trading Page</a>
            </div>
          </div>
          <div style="background:#12121f;padding:20px 32px;text-align:center;border-top:1px solid #2a2a3e;">
            <p style="color:#4b5563;font-size:12px;margin:0;">© ${new Date().getFullYear()} NeoFin. All rights reserved.</p>
          </div>
        </div>
        </body></html>
      `,

      // ✅ NEW: Beautiful subscription upgrade email
      subscriptionUpgrade: (ctx) => {
        const planColors = {
          pro: { gradient: 'linear-gradient(135deg,#7c3aed,#3b82f6)', badge: '#7c3aed', name: 'Pro' },
          enterprise: { gradient: 'linear-gradient(135deg,#f59e0b,#ef4444)', badge: '#f59e0b', name: 'Enterprise' }
        };
        const colors = planColors[ctx.planId] || planColors.pro;

        const featureRows = ctx.features.map(f => `
          <tr>
            <td style="padding:10px 16px;border-bottom:1px solid #2a2a3e;">
              <span style="color:#10b981;margin-right:10px;">✓</span>
              <span style="color:#d1d5db;">${f}</span>
            </td>
          </tr>
        `).join('');

        return `
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
        <title>Welcome to NeoFin ${colors.name}!</title></head>
        <body style="margin:0;padding:0;background:#0f0f14;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">

        <div style="max-width:620px;margin:40px auto;background:#1a1a2e;border-radius:20px;overflow:hidden;border:1px solid #2a2a3e;box-shadow:0 25px 50px rgba(0,0,0,0.5);">

          <!-- Header -->
          <div style="background:${colors.gradient};padding:48px 40px;text-align:center;position:relative;">
            <div style="font-size:56px;margin-bottom:16px;">🚀</div>
            <h1 style="color:#fff;margin:0 0 8px;font-size:32px;font-weight:800;letter-spacing:-0.5px;">You're now on ${colors.name}!</h1>
            <p style="color:rgba(255,255,255,0.85);margin:0;font-size:16px;">Welcome to a new level of financial intelligence</p>
          </div>

          <!-- Greeting -->
          <div style="padding:40px 40px 0;">
            <p style="color:#e5e7eb;font-size:17px;line-height:1.6;margin:0 0 8px;">Hi ${ctx.name}, 👋</p>
            <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 32px;">
              Your subscription upgrade to <strong style="color:#fff;">${colors.name} Plan</strong> was successful!
              Your account has been fully activated with all premium features. Here's what you now have access to:
            </p>
          </div>

          <!-- Features Table -->
          <div style="margin:0 40px;">
            <div style="background:#12121f;border:1px solid #2a2a3e;border-radius:12px;overflow:hidden;">
              <div style="background:${colors.gradient};padding:12px 16px;">
                <span style="color:#fff;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:1px;">✨ Your ${colors.name} Features</span>
              </div>
              <table style="width:100%;border-collapse:collapse;">
                ${featureRows}
              </table>
            </div>
          </div>

          <!-- Plan Details -->
          <div style="margin:24px 40px 0;">
            <div style="background:#12121f;border:1px solid #2a2a3e;border-radius:12px;padding:20px;">
              <h3 style="color:#fff;margin:0 0 16px;font-size:15px;font-weight:600;">📋 Subscription Details</h3>
              <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                <span style="color:#6b7280;font-size:14px;">Plan</span>
                <span style="color:#fff;font-weight:600;font-size:14px;">${colors.name} — $${ctx.price}/month</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                <span style="color:#6b7280;font-size:14px;">Status</span>
                <span style="color:#10b981;font-weight:600;font-size:14px;">● Active</span>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span style="color:#6b7280;font-size:14px;">Next Billing</span>
                <span style="color:#fff;font-size:14px;">${ctx.nextBillingDate}</span>
              </div>
            </div>
          </div>

          <!-- CTA Button -->
          <div style="padding:32px 40px;text-align:center;">
            <a href="${ctx.dashboardUrl}" style="display:inline-block;background:${colors.gradient};color:#fff;text-decoration:none;padding:16px 48px;border-radius:10px;font-weight:700;font-size:16px;letter-spacing:0.3px;box-shadow:0 4px 15px rgba(124,58,237,0.4);">
              Go to Dashboard →
            </a>
            <p style="color:#6b7280;font-size:13px;margin:16px 0 0;">
              Manage your subscription anytime in
              <a href="${ctx.settingsUrl}" style="color:#7c3aed;text-decoration:none;">Account Settings</a>
            </p>
          </div>

          <!-- Help Box -->
          <div style="margin:0 40px 32px;">
            <div style="background:#0f172a;border:1px solid #1e3a5f;border-radius:12px;padding:20px;text-align:center;">
              <p style="color:#9ca3af;font-size:14px;margin:0 0 8px;">💬 Need help getting started?</p>
              <a href="mailto:support@neofin.com" style="color:#3b82f6;text-decoration:none;font-size:14px;">support@neofin.com</a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background:#0c0c18;padding:24px 40px;text-align:center;border-top:1px solid #1e1e2e;">
            <p style="color:#374151;font-size:12px;margin:0 0 4px;">
              <strong style="color:#4b5563;">NeoFin</strong> — Next-Gen Financial Intelligence Platform
            </p>
            <p style="color:#374151;font-size:11px;margin:0;">
              © ${new Date().getFullYear()} NeoFin. All rights reserved. |
              <a href="${ctx.settingsUrl}" style="color:#4b5563;text-decoration:none;">Manage Subscription</a>
            </p>
          </div>
        </div>

        </body></html>
        `;
      }
    };

    const htmlContent = templates[template] ? templates[template](context) : `<p>${JSON.stringify(context)}</p>`;

    try {
      const result = await this.transporter.sendMail({
        from: config.email.from,
        to,
        subject,
        html: htmlContent
      });
      logger.info(`Email sent: ${subject} → ${to}`);
      return result;
    } catch (error) {
      logger.error('Email sending failed:', error.message);
      throw error;
    }
  }

  async sendPriceAlertEmail({ to, name, symbol, condition, alertPrice, currentPrice }) {
    if (!to) return;
    const actionUrl = process.env.APP_URL ? `${process.env.APP_URL}/trading` : 'http://localhost:5173/trading';
    return this.sendEmail({
      to,
      subject: `🔔 Price Alert: ${symbol} triggered at $${currentPrice.toFixed(2)}`,
      template: 'priceAlert',
      context: { name, symbol, condition, targetPrice: alertPrice, currentPrice: currentPrice.toFixed(2), actionUrl }
    });
  }

  // ✅ NEW: Send upgrade confirmation email
  async sendSubscriptionUpgradeEmail({ to, name, planId, planName, price, nextBillingDate }) {
    if (!to) return;

    const appUrl = process.env.APP_URL || 'http://localhost:5173';

    const featuresByPlan = {
      pro: [
        'Real-time market data & live price feeds',
        'AI-powered portfolio insights & predictions',
        'Advanced analytics & performance reports',
        'Up to 5 portfolios & 10 watchlists',
        'Up to 50 price alerts',
        'Unlimited daily transactions',
        '1,000 API calls per day',
        '1 year data retention',
      ],
      enterprise: [
        'Everything in Pro, plus...',
        'DeFi protocol integration (staking, yield farming)',
        'Custom API integrations & webhooks',
        'Unlimited portfolios, watchlists & alerts',
        'Unlimited API calls & data retention',
        'Dedicated account manager',
        'Priority support with SLA guarantee',
        'White-label reporting capabilities',
      ]
    };

    return this.sendEmail({
      to,
      subject: `🎉 You're now on NeoFin ${planName}! Your upgrade is confirmed`,
      template: 'subscriptionUpgrade',
      context: {
        name,
        planId,
        planName,
        price,
        features: featuresByPlan[planId] || featuresByPlan.pro,
        nextBillingDate: nextBillingDate
          ? new Date(nextBillingDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : 'Next month',
        dashboardUrl: `${appUrl}/dashboard`,
        settingsUrl: `${appUrl}/settings`,
      }
    });
  }
}

module.exports = new EmailService();
