// server/src/services/email.service.js
const nodemailer = require('nodemailer');
const config = require('../config');
const { logger } = require('../api/middlewares/logger.middleware');

class EmailService {
  constructor() {
    logger.debug('Email: Initializing email service...');

    const { host, port, secure, user, password } = config.email;
    if (!host || !user || !password) {
      logger.warn('📧 SMTP not fully configured - emails will not be sent');
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass: password
      }
    });

    this.transporter.verify()
      .then(() => logger.info('📧 SMTP transporter verified successfully'))
      .catch((verifyError) => {
        logger.error('📧 SMTP transporter verification failed:', verifyError.message);
        this.transporter = null;
      });
  }

  async sendEmail({ to, subject, template, context }) {
    if (!this.transporter) {
      const error = new Error('SMTP transporter not configured');
      logger.warn('📧 Email not sent: SMTP transporter is not configured');
      throw error;
    }

    const templates = {
      emailVerification: (ctx) => `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          </head>
          <body style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <div style="max-width:680px;margin:0 auto;padding:32px 16px;">
              <div style="background:#ffffff;border-radius:24px;border:1px solid rgba(15,23,42,0.08);overflow:hidden;box-shadow:0 24px 80px rgba(15,23,42,0.08);">
                <div style="background:#0f172a;color:#ffffff;padding:40px 32px;text-align:center;">
                  <p style="margin:0;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;">NeoFinAI</p>
                  <h1 style="margin:16px 0 0;font-size:32px;line-height:1.1;font-weight:800;">Verify your email address</h1>
                </div>
                <div style="padding:32px 34px 40px;background:#ffffff;">
                  <p style="margin:0 0 20px;color:#334155;font-size:16px;line-height:1.75;">Hi ${ctx.name},</p>
                  <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.8;">Please confirm your email to complete your NeoFinAI account setup and unlock premium insights.</p>
                  <div style="text-align:center;margin-bottom:32px;">
                    <a href="${ctx.verificationUrl}" style="display:inline-block;background:#4361ee;color:#ffffff;text-decoration:none;padding:14px 38px;border-radius:999px;font-weight:700;font-size:15px;">Verify email</a>
                  </div>
                  <p style="margin:0 0 16px;color:#64748b;font-size:13px;line-height:1.7;">This link expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>
                  <div style="margin-top:28px;padding-top:24px;border-top:1px solid rgba(148,163,184,0.18);">
                    <p style="margin:0;color:#475569;font-size:15px;line-height:1.7;">Best regards,<br /><strong>Anurag Rathore</strong><br />Co-founder, NeofinAI</p>
                  </div>
                </div>
              </div>
              <p style="margin:24px 0 0;text-align:center;color:#667085;font-size:13px;">© ${new Date().getFullYear()} NeoFinAI. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,

      passwordReset: (ctx) => `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          </head>
          <body style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <div style="max-width:680px;margin:0 auto;padding:32px 16px;">
              <div style="background:#ffffff;border-radius:24px;border:1px solid rgba(15,23,42,0.08);overflow:hidden;box-shadow:0 24px 80px rgba(15,23,42,0.08);">
                <div style="background:#0f172a;color:#ffffff;padding:40px 32px;text-align:center;">
                  <p style="margin:0;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;">NeoFinAI</p>
                  <h1 style="margin:16px 0 0;font-size:32px;line-height:1.1;font-weight:800;">Password reset requested</h1>
                </div>
                <div style="padding:32px 34px 40px;background:#ffffff;">
                  <p style="margin:0 0 20px;color:#334155;font-size:16px;line-height:1.75;">Hello ${ctx.name},</p>
                  <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.8;">We received a request to reset your NeoFinAI password. Click the button below to set a new one.</p>
                  <div style="text-align:center;margin-bottom:32px;">
                    <a href="${ctx.resetUrl}" style="display:inline-block;background:#4361ee;color:#ffffff;text-decoration:none;padding:14px 38px;border-radius:999px;font-weight:700;font-size:15px;">Reset password</a>
                  </div>
                  <p style="margin:0 0 16px;color:#64748b;font-size:13px;line-height:1.7;">This link expires in 1 hour. If you did not request a password reset, you can ignore this email.</p>
                  <div style="margin-top:28px;padding-top:24px;border-top:1px solid rgba(148,163,184,0.18);">
                    <p style="margin:0;color:#475569;font-size:15px;line-height:1.7;">Warm regards,<br /><strong>Anurag Rathore</strong><br />Co-founder, NeofinAI</p>
                  </div>
                </div>
              </div>
              <p style="margin:24px 0 0;text-align:center;color:#667085;font-size:13px;">© ${new Date().getFullYear()} NeoFinAI. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,

      priceAlert: (ctx) => `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          </head>
          <body style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <div style="max-width:680px;margin:0 auto;padding:32px 16px;">
              <div style="background:#ffffff;border-radius:24px;border:1px solid rgba(15,23,42,0.08);overflow:hidden;box-shadow:0 24px 80px rgba(15,23,42,0.08);">
                <div style="background:#111827;color:#ffffff;padding:34px 30px;text-align:center;">
                  <div style="font-size:48px;line-height:1;">🔔</div>
                  <h1 style="margin:18px 0 0;font-size:28px;font-weight:800;">Price alert triggered</h1>
                </div>
                <div style="padding:32px 34px 40px;background:#ffffff;">
                  <p style="margin:0 0 20px;color:#334155;font-size:16px;line-height:1.75;">Hi ${ctx.name},</p>
                  <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.8;">Your price alert for <strong>${ctx.symbol}</strong> has been triggered. Here are the latest details.</p>
                  <div style="background:#f8fafc;border:1px solid rgba(148,163,184,0.35);border-radius:18px;padding:24px;margin-bottom:28px;">
                    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;">
                      <div>
                        <p style="margin:0 0 6px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Condition</p>
                        <p style="margin:0;color:#0f172a;font-size:16px;font-weight:700;">Price ${ctx.condition}</p>
                      </div>
                      <div>
                        <p style="margin:0 0 6px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Target price</p>
                        <p style="margin:0;color:#0f172a;font-size:16px;font-weight:700;">$${ctx.targetPrice}</p>
                      </div>
                      <div style="grid-column:1 / -1;">
                        <p style="margin:0 0 6px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Current price</p>
                        <p style="margin:0;color:#0f172a;font-size:16px;font-weight:700;">$${ctx.currentPrice}</p>
                      </div>
                    </div>
                  </div>
                  <div style="text-align:center;margin-bottom:28px;">
                    <a href="${ctx.actionUrl}" style="display:inline-block;background:#4361ee;color:#ffffff;text-decoration:none;padding:14px 38px;border-radius:999px;font-weight:700;font-size:15px;">View trading page</a>
                  </div>
                  <div style="padding-top:24px;border-top:1px solid rgba(148,163,184,0.18);">
                    <p style="margin:0;color:#475569;font-size:15px;line-height:1.7;">Stay on top of your strategy,<br /><strong>Anurag Rathore</strong><br />Co-founder, NeofinAI</p>
                  </div>
                </div>
              </div>
              <p style="margin:24px 0 0;text-align:center;color:#667085;font-size:13px;">© ${new Date().getFullYear()} NeoFinAI. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,

      // ✅ NEW: Beautiful subscription upgrade email
      subscriptionUpgrade: (ctx) => {
        const planColors = {
          pro: { accent: '#4361ee', label: 'Pro' },
          enterprise: { accent: '#f97316', label: 'Enterprise' }
        };
        const colors = planColors[ctx.planId] || planColors.pro;

        const featureRows = ctx.features.map(f => `
          <tr>
            <td style="padding:14px 0;border-bottom:1px solid rgba(148,163,184,0.18);">
              <span style="font-size:14px;color:#0f172a;">✓ ${f}</span>
            </td>
          </tr>
        `).join('');

        return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>NeoFinAI ${ctx.planName} Upgrade</title>
          </head>
          <body style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <div style="max-width:700px;margin:0 auto;padding:32px 16px;">
              <div style="background:#ffffff;border-radius:28px;border:1px solid rgba(15,23,42,0.08);overflow:hidden;box-shadow:0 24px 90px rgba(15,23,42,0.08);">
                <div style="background:${colors.accent};padding:44px 36px;text-align:center;color:#ffffff;">
                  <p style="margin:0;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;opacity:0.85;">NeoFinAI</p>
                  <h1 style="margin:18px 0 10px;font-size:34px;line-height:1.05;font-weight:800;">Your ${ctx.planName} upgrade is complete</h1>
                  <p style="margin:0;font-size:16px;line-height:1.75;opacity:0.92;">Your premium capabilities are now active. Welcome to elevated financial intelligence.</p>
                </div>
                <div style="padding:38px 36px 24px;background:#ffffff;">
                  <p style="margin:0 0 22px;color:#334155;font-size:16px;line-height:1.75;">Hi ${ctx.name},</p>
                  <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.8;">Your NeoFinAI ${ctx.planName} subscription is active. Below are your upgraded benefits and next billing details.</p>
                  <div style="background:#f8fafc;border:1px solid rgba(148,163,184,0.35);border-radius:22px;padding:24px;margin-bottom:28px;">
                    <div style="display:flex;flex-wrap:wrap;gap:18px;">
                      <div style="min-width:160px;">
                        <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Plan</p>
                        <p style="margin:0;color:#0f172a;font-size:16px;font-weight:700;">${ctx.planName}</p>
                      </div>
                      <div style="min-width:160px;">
                        <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Price</p>
                        <p style="margin:0;color:#0f172a;font-size:16px;font-weight:700;">$${ctx.price}/month</p>
                      </div>
                      <div style="min-width:160px;">
                        <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Next billing</p>
                        <p style="margin:0;color:#0f172a;font-size:16px;font-weight:700;">${ctx.nextBillingDate}</p>
                      </div>
                    </div>
                  </div>
                  <div style="background:#f8fafc;border:1px solid rgba(148,163,184,0.35);border-radius:22px;padding:24px;">
                    <p style="margin:0 0 14px;color:#0f172a;font-size:15px;font-weight:700;">Your premium feature set</p>
                    <table style="width:100%;border-collapse:collapse;">${featureRows}</table>
                  </div>
                  <div style="text-align:center;margin-top:32px;">
                    <a href="${ctx.dashboardUrl}" style="display:inline-block;background:${colors.accent};color:#ffffff;text-decoration:none;padding:15px 44px;border-radius:999px;font-weight:700;font-size:15px;">View dashboard</a>
                  </div>
                  <p style="margin:28px 0 0;color:#475569;font-size:15px;line-height:1.8;">Manage your subscription anytime in <a href="${ctx.settingsUrl}" style="color:#4361ee;text-decoration:none;">account settings</a>.</p>
                  <div style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(148,163,184,0.18);">
                    <p style="margin:0;color:#475569;font-size:15px;line-height:1.8;">Thank you for choosing NeoFinAI.<br /><strong>Anurag Rathore</strong><br />Co-founder, NeofinAI</p>
                  </div>
                </div>
                <div style="background:#f8fafc;padding:24px 36px;text-align:center;border-top:1px solid rgba(148,163,184,0.18);">
                  <p style="margin:0;color:#64748b;font-size:13px;">Need help? Contact <a href="mailto:support@neofin.com" style="color:#4361ee;text-decoration:none;">support@neofin.com</a>.</p>
                </div>
                <div style="background:#ffffff;padding:20px 36px;text-align:center;border-top:1px solid rgba(15,23,42,0.06);">
                  <p style="margin:0;color:#94a3b8;font-size:12px;">© ${new Date().getFullYear()} NeoFinAI. All rights reserved.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
    }    };

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
