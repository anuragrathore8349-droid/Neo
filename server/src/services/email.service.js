const nodemailer = require('nodemailer');
const config = require('../config');
const { logger } = require('../api/middlewares/logger.middleware');

class EmailService {
  constructor() {
    logger.debug('Email: Initializing email service...');
    logger.debug('Email: SMTP Config:', {
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      user: config.email.user ? '***configured***' : 'NOT SET',
      from: config.email.from
    });

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

    logger.debug('Email: Email transporter created successfully');
  }

  async sendEmail({ to, subject, template, context }) {
    if (!this.transporter) {
      console.warn('📧 Email not sent: SMTP not configured');
      return;
    }

    logger.debug('Email: Preparing to send email...');
    logger.debug('Email: Email details:', {
      to,
      subject,
      template,
      contextKeys: Object.keys(context)
    });

    const templates = {
      emailVerification: (context) => `
        <h1>Welcome to NeoFin, ${context.name}!</h1>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${context.verificationUrl}">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
      `,
      passwordReset: (context) => `
        <h1>Password Reset Request</h1>
        <p>Hello ${context.name},</p>
        <p>You requested to reset your password. Click the link below to proceed:</p>
        <a href="${context.resetUrl}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
      priceAlert: (context) => `
        <h1>🔔 Price Alert: ${context.symbol}</h1>
        <p>Hello ${context.name},</p>
        <p>Your price alert for <strong>${context.symbol}</strong> has been triggered!</p>
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 8px 0;"><strong>Condition:</strong> Price ${context.condition}</p>
          <p style="margin: 8px 0;"><strong>Target Price:</strong> $${context.targetPrice}</p>
          <p style="margin: 8px 0;"><strong>Current Price:</strong> $${context.currentPrice}</p>
        </div>
        <p>
          <a href="${context.actionUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">
            View Trading Page
          </a>
        </p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
          You received this email because you enabled email notifications for price alerts in your NeoFin account settings.
        </p>
      `
    };

    logger.debug('Email: Generating email template content...');
    const htmlContent = templates[template](context);
    logger.debug('Email: Template generated, content length:', htmlContent.length);

    logger.debug('Email: Sending email via SMTP...');
    try {
      const result = await this.transporter.sendMail({
        from: config.email.from,
        to,
        subject,
        html: htmlContent
      });

      logger.info('Email sent successfully');
      logger.debug('Email: Send result:', {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        response: result.response
      });

      return result;
    } catch (error) {
      console.error('❌ Email sending failed!');
      console.error('📧 Error details:', {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response
      });
      throw error;
    }
  }

  getEmailVerificationTemplate(context) {
    return `
      <h1>Welcome to NeoFin, ${context.name}!</h1>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${context.verificationUrl}">Verify Email</a>
      <p>This link will expire in 24 hours.</p>
    `;
  }

  getPasswordResetTemplate(context) {
    return `
      <h1>Password Reset Request</h1>
      <p>Hello ${context.name},</p>
      <p>You requested to reset your password. Click the link below to proceed:</p>
      <a href="${context.resetUrl}">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;
  }

  /**
   * Send price alert email when an alert is triggered
   */
  async sendPriceAlertEmail({ to, name, symbol, condition, alertPrice, currentPrice }) {
    if (!to) {
      console.warn('📧 Price alert email: no recipient email provided');
      return;
    }

    const actionUrl = process.env.APP_URL ? `${process.env.APP_URL}/trading` : 'http://localhost:5173/trading';
    
    try {
      return await this.sendEmail({
        to,
        subject: `🔔 Price Alert: ${symbol} triggered at $${currentPrice.toFixed(2)}`,
        template: 'priceAlert',
        context: {
          name,
          symbol,
          condition,
          targetPrice: alertPrice,
          currentPrice: currentPrice.toFixed(2),
          actionUrl
        }
      });
    } catch (error) {
      console.error('❌ Failed to send price alert email:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();